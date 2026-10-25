/**
 * Sinkronisasi isi dokumen K3: Prosedur Kerja ⇄ JSA ⇄ PTW.
 *
 * Dokumen disusun paralel, jadi perubahan di satu dokumen ikut mengalir ke yang
 * lain:
 *   Prosedur → JSA (langkah/judul + kebutuhan) dan PTW (pekerja, alat, bahaya, APD)
 *   JSA      → Prosedur (kebutuhan saja) dan PTW
 *   PTW      → Prosedur & JSA (hanya PENAMBAHAN; PTW adalah subset per jenis izin,
 *              jadi penghapusan di satu PTW tidak boleh menghapus dari dokumen hulu)
 * Yang dikirim adalah delta perubahan, bukan menimpa isi. Dokumen yang berubah
 * otomatis diberi penanda `needs_review_since` ("perlu ditinjau ulang") dan dicatat
 * di riwayat; status approval TIDAK direset. PTW yang sudah terbit (Aktif dst.)
 * tidak diubah isinya — hanya diberi penanda.
 *
 * Asal-bintang: tiap sinkron menulis langsung ke dokumen tujuan (tanpa memicu
 * sinkron lain), jadi tidak ada loop. Memakai admin client karena pengubah (vendor /
 * reviewer) tidak selalu punya hak tulis ke dokumen lain.
 */
import { createAdminClient } from '@/utils/supabase/admin';
import { notifyAssignees, notifyOrgMembers } from '@/app/dashboard/inbox/actions';
import { logDocumentEvent } from '@/lib/document-logs';
import { recordDocumentChange } from '@/lib/document-changes';
import {
  diffList, diffProsedurContent, summarizeChanges, readChangeLog, type ChangeLogEntry, type FieldChange,
} from '@/lib/prosedur-diff';
import {
  aggregateKebutuhan, aggregatePointNeeds, aggregateStepNeeds, deriveDocumentSections,
  normalizeTahapanPekerjaan, type StepKebutuhan, type TahapanSection,
} from '@/lib/procedure-kebutuhan';
import { parseJsaStepRow, serializeJsaStep, diffJsaSteps, syncApdControl, blankJsaStep } from '@/lib/jsa-steps';
import { pickPtwEditable, diffPtw, type PtwEditable } from '@/lib/ptw-diff';
import { APD_ITEMS, hazardSourcesFor, type PtwType } from '@/lib/ptw-types';
import { PROCEDURE_STAGE_SEQUENCE } from '@/lib/procedure-status';
import { JSA_STAGE_SEQUENCE } from '@/lib/jsa-status';
import { PTW_STAGE_SEQUENCE, PTW_STATUS } from '@/lib/ptw-status';
import {
  kebutuhanDelta, isDeltaEmpty, addsOf, applyKDelta, applyDeltaToSection, type KDelta,
} from '@/lib/kebutuhan-delta';
import type { JsaStepData } from '@/app/vendor/dashboard/jsa/create/[id]/JsaStepCard';

type Kind = 'procedure' | 'jsa' | 'ptw';
const TABLE: Record<Kind, string> = { procedure: 'procedures', jsa: 'jsa', ptw: 'ptw' };
const SEQ = { procedure: PROCEDURE_STAGE_SEQUENCE, jsa: JSA_STAGE_SEQUENCE, ptw: PTW_STAGE_SEQUENCE } as const;
const DOC_NAME: Record<Kind, string> = { procedure: 'Prosedur Kerja', jsa: 'JSA', ptw: 'PTW' };

interface Ctx {
  admin: any;
  projectId: string;
  projectName: string;
  vendorId: string | null;
  actorId: string | null;
  actorName: string;
}

async function makeCtx(projectId: string, actorId: string | null): Promise<Ctx> {
  const admin = createAdminClient();
  const [{ data: proj }, { data: prof }] = await Promise.all([
    admin.from('projects').select('name, vendor_id').eq('id', projectId).maybeSingle(),
    actorId ? admin.from('profiles').select('full_name').eq('id', actorId).maybeSingle() : Promise.resolve({ data: null as any }),
  ]);
  return { admin, projectId, projectName: proj?.name ?? '', vendorId: proj?.vendor_id ?? null, actorId, actorName: prof?.full_name || 'Sistem' };
}

const PTW_ISSUED = new Set<string>([PTW_STATUS.aktif, PTW_STATUS.expired, PTW_STATUS.stoppedSwa, PTW_STATUS.penutupanDiajukan, PTW_STATUS.selesai]);

const vendorLink = (kind: Kind, projectId: string, ptwType?: string) =>
  kind === 'procedure' ? `/vendor/dashboard/projects/${projectId}/prosedur`
    : kind === 'jsa' ? `/vendor/dashboard/jsa/create/${projectId}`
    : `/vendor/dashboard/ptw/create/${projectId}/${ptwType ?? ''}`;

/** Beri penanda "perlu review ulang" + log + notifikasi; fail-soft kalau kolom penanda belum dimigrasi. */
async function markDerived(c: Ctx, p: {
  kind: Kind; id: string; status?: string | null; source: string; changes?: FieldChange[]; ptwType?: string; recordChange?: boolean;
}) {
  const reason = `Berubah otomatis mengikuti ${p.source}`;
  try {
    const { error } = await c.admin.from(TABLE[p.kind])
      .update({ needs_review_since: new Date().toISOString(), needs_review_reason: reason }).eq('id', p.id);
    if (error) console.error('markDerived flag error:', error.message);
  } catch (e) { console.error('markDerived flag error:', e); }

  if (p.recordChange && p.changes?.length && p.kind !== 'procedure' && c.actorId) {
    try {
      await recordDocumentChange(c.admin, {
        docType: p.kind, docId: p.id, projectId: c.projectId, actorId: c.actorId, actorName: c.actorName,
        actorLabel: `Sinkron dari ${p.source}`, summary: summarizeChanges(p.changes), changes: p.changes,
      });
    } catch (e) { console.error('markDerived change error:', e); }
  }
  await logDocumentEvent(c.admin, {
    docType: p.kind, docId: p.id, projectId: c.projectId, actorId: c.actorId,
    action: `Disinkronkan dari ${p.source}`,
    notes: p.changes?.length ? summarizeChanges(p.changes) : 'Dokumen turunan berubah; perlu ditinjau ulang.',
  });

  const label = DOC_NAME[p.kind];
  const message = `${label} untuk proyek "${c.projectName}" berubah otomatis mengikuti ${p.source} dan perlu ditinjau ulang.`;
  try {
    if (c.vendorId) {
      await notifyOrgMembers({ orgId: c.vendorId, type: 'info', title: `${label} Disinkronkan`, message, link: vendorLink(p.kind, c.projectId, p.ptwType) });
    }
    const stage = (SEQ[p.kind] as readonly { key: string; status: string }[]).find((s) => s.status === p.status);
    if (stage) {
      await notifyAssignees({
        projectId: c.projectId, docType: p.kind, stageKey: stage.key, type: 'warning',
        title: `${label} Berubah — Tinjau Ulang`, message, link: `/dashboard/projects/${c.projectId}`,
      });
    }
  } catch (e) { console.error('markDerived notify error:', e); }
}

/** Hapus penanda "perlu review ulang" (dipanggil saat reviewer memutuskan / vendor mengajukan ulang). */
export async function clearReviewFlag(kind: Kind, id: string) {
  try {
    await createAdminClient().from(TABLE[kind]).update({ needs_review_since: null, needs_review_reason: null }).eq('id', id);
  } catch { /* kolom belum dimigrasi — abaikan */ }
}

// ------------------------------------------------------------------ roster

async function loadRosterMaps(admin: any, vendorId: string | null) {
  const workers = new Map<string, PtwEditable['workers'][number]>();
  const equipment = new Map<string, PtwEditable['equipment'][number]>();
  if (!vendorId) return { workers, equipment };
  const [w, e] = await Promise.all([
    admin.from('vendor_workers').select('id, full_name, position, vendor_worker_competencies ( title )').eq('vendor_id', vendorId),
    admin.from('vendor_equipment').select('id, name, category, certificate_number').eq('vendor_id', vendorId),
  ]);
  (w.data || []).forEach((x: any) => workers.set(x.id, {
    id: x.id, worker_name: x.full_name, worker_role: x.position || '',
    certification: (x.vendor_worker_competencies || []).map((cmp: any) => cmp.title).join(', ') || null,
  }));
  (e.data || []).forEach((x: any) => equipment.set(x.id, { id: x.id, name: x.name, type: x.category || '', certificate_number: x.certificate_number || null }));
  return { workers, equipment };
}

function applyDeltaToPtw(before: PtwEditable, type: PtwType, d: KDelta, rosters: Awaited<ReturnType<typeof loadRosterMaps>>): PtwEditable {
  const next: PtwEditable = { ...before, apd: { ...before.apd } };

  let workers = before.workers.filter((w) => !d.workers.remove.includes(w.id));
  for (const r of d.workers.add) {
    const info = rosters.workers.get(r.id);
    if (info && !workers.some((w) => w.id === r.id)) workers = [...workers, info];
  }
  let equipment = before.equipment.filter((e) => !d.equipment.remove.includes(e.id));
  for (const r of d.equipment.add) {
    const info = rosters.equipment.get(r.id);
    if (info && !equipment.some((e) => e.id === r.id)) equipment = [...equipment, info];
  }
  // PTW wajib punya minimal satu pekerja/peralatan — jangan kosongkan lewat sinkron.
  if (workers.length + equipment.length > 0) { next.workers = workers; next.equipment = equipment; }

  const allowed = new Set(hazardSourcesFor(type));
  next.hazards = [
    ...before.hazards.filter((h) => !d.hazards.remove.includes(h)),
    ...d.hazards.add.filter((h) => allowed.has(h) && !before.hazards.includes(h)),
  ];
  for (const [cat, dd] of Object.entries(d.apd)) {
    const valid = (APD_ITEMS as Record<string, string[]>)[cat];
    if (!valid) continue;
    const cur = (before.apd[cat] || []).filter((x) => !dd.remove.includes(x));
    const merged = [...cur, ...dd.add.filter((x) => valid.includes(x) && !cur.includes(x))];
    if (merged.length) next.apd[cat] = merged; else delete next.apd[cat];
  }
  return next;
}

/** Terapkan delta kebutuhan tingkat-proyek ke semua PTW proyek (sebelum terbit diubah isinya; yang sudah terbit hanya diberi penanda). */
async function syncPtws(c: Ctx, d: KDelta, source: string, opts: { skipPtwId?: string } = {}) {
  if (isDeltaEmpty(d)) return;
  const { data: ptws } = await c.admin.from('ptw').select('*').eq('project_id', c.projectId);
  if (!ptws || ptws.length === 0) return;
  const needsRoster = d.workers.add.length > 0 || d.equipment.add.length > 0;
  const rosters = needsRoster ? await loadRosterMaps(c.admin, c.vendorId) : { workers: new Map(), equipment: new Map() };

  for (const row of ptws) {
    if (row.id === opts.skipPtwId) continue;
    if (PTW_ISSUED.has(row.status)) {
      await markDerived(c, { kind: 'ptw', id: row.id, status: row.status, source, ptwType: row.ptw_type });
      continue;
    }
    const before = pickPtwEditable(row);
    const after = applyDeltaToPtw(before, row.ptw_type, d, rosters);
    const changes = diffPtw(before, after);
    if (changes.length === 0) continue;
    const { error } = await c.admin.from('ptw').update({
      workers: after.workers, equipment: after.equipment, hazards: after.hazards, apd: after.apd,
    }).eq('id', row.id);
    if (error) { console.error('syncPtws update error:', error.message); continue; }
    await markDerived(c, { kind: 'ptw', id: row.id, status: row.status, source, changes, ptwType: row.ptw_type, recordChange: true });
  }
}

// -------------------------------------------------------------- JSA writer

async function writeJsaSteps(admin: any, jsaId: string, oldSteps: JsaStepData[], next: JsaStepData[]) {
  await admin.from('jsa_steps').delete().eq('jsa_id', jsaId);
  const { error } = await admin.from('jsa_steps').insert(next.map((s, i) => serializeJsaStep(s, jsaId, i)));
  if (error) {
    await admin.from('jsa_steps').insert(oldSteps.map((s, i) => serializeJsaStep(s, jsaId, i)));
    throw new Error(error.message);
  }
}

async function loadJsa(c: Ctx) {
  const { data: jsa } = await c.admin.from('jsa').select('id, status').eq('project_id', c.projectId).limit(1).maybeSingle();
  if (!jsa) return null;
  const { data: rows } = await c.admin.from('jsa_steps').select('*').eq('jsa_id', jsa.id).order('step_number', { ascending: true });
  return { jsa, steps: (rows || []).map((r: any, i: number) => parseJsaStepRow(r, i)) as JsaStepData[] };
}

async function loadProcedure(c: Ctx) {
  const { data } = await c.admin.from('procedures').select('id, status, content').eq('project_id', c.projectId).maybeSingle();
  return data as { id: string; status: string; content: any } | null;
}

const sectionNeeds = (sec: TahapanSection) => aggregatePointNeeds(sec.points);

async function writeProcedureSections(c: Ctx, proc: { id: string; status: string; content: any }, secs: TahapanSection[], source: string) {
  const old = proc.content || {};
  const derived = deriveDocumentSections(secs);
  const next = { ...old, tahapanPekerjaan: secs, tools: derived.tools, selectedApd: derived.apd, perlengkapanLainnya: derived.perlengkapanLainnya };
  const changes = diffProsedurContent(old, next);
  if (changes.length === 0) return false;
  const entry: ChangeLogEntry = {
    id: crypto.randomUUID(), at: new Date().toISOString(), actorId: c.actorId, actorName: c.actorName,
    actorLabel: `Sinkron dari ${source}`, summary: summarizeChanges(changes), note: null, changes,
  };
  const { error } = await c.admin.from('procedures').update({ content: { ...next, changeLog: [...readChangeLog(old), entry] } }).eq('id', proc.id);
  if (error) { console.error('writeProcedureSections error:', error.message); return false; }
  await markDerived(c, { kind: 'procedure', id: proc.id, status: proc.status, source, changes });
  return true;
}

// ------------------------------------------------------------- entry points

/** Prosedur berubah → perbarui JSA (langkah + kebutuhan) dan PTW. */
export async function syncFromProcedure(projectId: string, oldContent: any, newContent: any, actorId: string | null) {
  try {
    const c = await makeCtx(projectId, actorId);
    const oldSecs = normalizeTahapanPekerjaan(oldContent?.tahapanPekerjaan);
    const newSecs = normalizeTahapanPekerjaan(newContent?.tahapanPekerjaan);

    const loaded = await loadJsa(c);
    if (loaded) {
      const { jsa, steps: oldSteps } = loaded;
      const out: JsaStepData[] = [];
      let oi = 0;
      for (const p of diffList(oldSecs, newSecs, (s) => s.title.trim())) {
        if (p.t === 'del') { oi++; continue; }
        if (p.t === 'add') { out.push(blankJsaStep(p.b.title, sectionNeeds(p.b))); continue; }
        const step = oldSteps[oi++];
        if (!step) { out.push(blankJsaStep(p.b.title, sectionNeeds(p.b))); continue; }
        const k = applyKDelta(step.kebutuhan, kebutuhanDelta(sectionNeeds(p.a), sectionNeeds(p.b)));
        out.push({
          ...step,
          langkah: p.t === 'change' ? p.b.title : step.langkah,
          kebutuhan: k,
          faktorPositif: { ...step.faktorPositif, apd: syncApdControl(step.kebutuhan, k, step.faktorPositif.apd) },
        });
      }
      for (let i = oldSecs.length; i < oldSteps.length; i++) out.push(oldSteps[i]);

      const changes = diffJsaSteps(oldSteps, out);
      if (changes.length > 0) {
        await writeJsaSteps(c.admin, jsa.id, oldSteps, out);
        await markDerived(c, { kind: 'jsa', id: jsa.id, status: jsa.status, source: 'Prosedur Kerja', changes, recordChange: true });
      }
    }

    const projDelta = kebutuhanDelta(
      aggregateKebutuhan(oldSecs.map(sectionNeeds)), aggregateKebutuhan(newSecs.map(sectionNeeds)),
    );
    await syncPtws(c, projDelta, 'Prosedur Kerja');
  } catch (e) {
    console.error('syncFromProcedure error:', e);
  }
}

/** JSA berubah → kebutuhan Prosedur ikut menyesuaikan (per tahapan) dan PTW diperbarui. */
export async function syncFromJsa(projectId: string, oldSteps: JsaStepData[], newSteps: JsaStepData[], actorId: string | null) {
  try {
    const c = await makeCtx(projectId, actorId);

    const proc = await loadProcedure(c);
    if (proc) {
      const secs = normalizeTahapanPekerjaan(proc.content?.tahapanPekerjaan);
      let oi = 0;
      for (const p of diffList(oldSteps, newSteps, (s) => s.langkah.trim())) {
        if (p.t === 'add') continue;
        const j = oi++;
        if (p.t === 'del') continue;
        const d = kebutuhanDelta(p.a.kebutuhan, p.b.kebutuhan);
        if (isDeltaEmpty(d) || !secs[j]) continue;
        secs[j] = applyDeltaToSection(secs[j], d);
      }
      await writeProcedureSections(c, proc, secs, 'JSA');
    }

    const projDelta = kebutuhanDelta(
      aggregateStepNeeds(oldSteps.map((s) => ({ kebutuhan: s.kebutuhan }))),
      aggregateStepNeeds(newSteps.map((s) => ({ kebutuhan: s.kebutuhan }))),
    );
    await syncPtws(c, projDelta, 'JSA');
  } catch (e) {
    console.error('syncFromJsa error:', e);
  }
}

/** PTW berubah → hanya PENAMBAHAN yang mengalir ke JSA (langkah pertama) dan Prosedur (tahapan pertama). */
export async function syncFromPtw(projectId: string, ptwId: string, before: PtwEditable, after: PtwEditable, actorId: string | null) {
  try {
    const empty: StepKebutuhan = { workers: [], equipment: [], materials: [], apd: {}, hazards: [] };
    const addedKeb: StepKebutuhan = {
      ...empty,
      workers: after.workers.filter((w) => !before.workers.some((b) => b.id === w.id)).map((w) => ({ id: w.id, label: w.worker_name || w.id })),
      equipment: after.equipment.filter((e) => !before.equipment.some((b) => b.id === e.id)).map((e) => ({ id: e.id, label: e.name || e.id })),
      hazards: after.hazards.filter((h) => !before.hazards.includes(h)),
      apd: Object.fromEntries(
        Object.keys(after.apd).map((cat) => [cat, (after.apd[cat] || []).filter((x) => !(before.apd[cat] || []).includes(x))]).filter(([, v]) => (v as string[]).length > 0),
      ) as Record<string, string[]>,
    };
    const d = addsOf(kebutuhanDelta(empty, addedKeb));
    if (isDeltaEmpty(d)) return;

    const c = await makeCtx(projectId, actorId);

    const proc = await loadProcedure(c);
    if (proc) {
      const secs = normalizeTahapanPekerjaan(proc.content?.tahapanPekerjaan);
      if (secs.length > 0) {
        secs[0] = applyDeltaToSection(secs[0], d);
        await writeProcedureSections(c, proc, secs, 'PTW');
      }
    }

    const loaded = await loadJsa(c);
    if (loaded && loaded.steps.length > 0) {
      const { jsa, steps } = loaded;
      const first = steps[0];
      const k = applyKDelta(first.kebutuhan, d);
      const next = [{ ...first, kebutuhan: k, faktorPositif: { ...first.faktorPositif, apd: syncApdControl(first.kebutuhan, k, first.faktorPositif.apd) } }, ...steps.slice(1)];
      const changes = diffJsaSteps(steps, next);
      if (changes.length > 0) {
        await writeJsaSteps(c.admin, jsa.id, steps, next);
        await markDerived(c, { kind: 'jsa', id: jsa.id, status: jsa.status, source: 'PTW', changes, recordChange: true });
      }
    }
    void ptwId;
  } catch (e) {
    console.error('syncFromPtw error:', e);
  }
}

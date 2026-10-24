/**
 * Patch + diff isi PTW yang boleh diubah reviewer (sama dengan field yang
 * disimpan savePtw, kecuali baris uji gas). Pure function.
 */
import { APD_ITEMS, PTW_MAX_VALID_DAYS } from '@/lib/ptw-types';
import { clip, type FieldChange } from '@/lib/prosedur-diff';

export interface PtwEditable {
  workers: { id: string; worker_name?: string; worker_role?: string; certification?: string | null }[];
  equipment: { id: string; name?: string; type?: string; certificate_number?: string | null }[];
  hazards: string[];
  apd: Record<string, string[]>;
  valid_from: string | null;
  valid_to: string | null;
  work_start: string | null;
  work_end: string | null;
  hot_work_types: string[];
  gas_test_frequency: { o2?: string; toxic?: string; combustible?: string };
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Ambil bagian yang bisa diubah dari baris ptw. */
export function pickPtwEditable(row: any): PtwEditable {
  return {
    workers: Array.isArray(row?.workers) ? row.workers : [],
    equipment: Array.isArray(row?.equipment) ? row.equipment : [],
    hazards: list(row?.hazards),
    apd: row?.apd && typeof row.apd === 'object' ? row.apd : {},
    valid_from: row?.valid_from ?? null,
    valid_to: row?.valid_to ?? null,
    work_start: row?.work_start ?? null,
    work_end: row?.work_end ?? null,
    hot_work_types: list(row?.hot_work_types),
    gas_test_frequency: row?.gas_test_frequency && typeof row.gas_test_frequency === 'object' ? row.gas_test_frequency : {},
  };
}

/** Sanitasi patch dari klien; melempar Error untuk masa berlaku yang tidak valid. */
export function sanitizePtwPatch(raw: any, current: PtwEditable): PtwEditable {
  const next: PtwEditable = { ...current };
  if (Array.isArray(raw?.workers)) next.workers = raw.workers.filter((w: any) => w && typeof w.id === 'string').map((w: any) => ({
    id: w.id, worker_name: s(w.worker_name), worker_role: s(w.worker_role), certification: w.certification ? s(w.certification) : null,
  }));
  if (Array.isArray(raw?.equipment)) next.equipment = raw.equipment.filter((e: any) => e && typeof e.id === 'string').map((e: any) => ({
    id: e.id, name: s(e.name), type: s(e.type), certificate_number: e.certificate_number ? s(e.certificate_number) : null,
  }));
  if ('hazards' in (raw || {})) next.hazards = list(raw.hazards);
  if (raw?.apd && typeof raw.apd === 'object') {
    const apd: Record<string, string[]> = {};
    for (const cat of Object.keys(APD_ITEMS)) {
      const items = list(raw.apd[cat]);
      if (items.length) apd[cat] = items;
    }
    next.apd = apd;
  }
  for (const k of ['valid_from', 'valid_to', 'work_start', 'work_end'] as const) {
    if (k in (raw || {})) next[k] = raw[k] ? s(raw[k]) : null;
  }
  if ('hot_work_types' in (raw || {})) next.hot_work_types = list(raw.hot_work_types);
  if (raw?.gas_test_frequency && typeof raw.gas_test_frequency === 'object') {
    next.gas_test_frequency = { o2: s(raw.gas_test_frequency.o2), toxic: s(raw.gas_test_frequency.toxic), combustible: s(raw.gas_test_frequency.combustible) };
  }

  if (next.workers.length === 0 && next.equipment.length === 0) throw new Error('Pilih minimal satu pekerja atau peralatan.');
  if (!next.valid_from || !next.valid_to) throw new Error('Masa berlaku izin wajib diisi.');
  const dari = new Date(next.valid_from).getTime(), sampai = new Date(next.valid_to).getTime();
  if (Number.isNaN(dari) || Number.isNaN(sampai)) throw new Error('Format tanggal masa berlaku tidak valid.');
  const hari = Math.floor((sampai - dari) / 86_400_000) + 1;
  if (hari < 1) throw new Error('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
  if (hari > PTW_MAX_VALID_DAYS) throw new Error(`Masa berlaku maksimal ${PTW_MAX_VALID_DAYS} hari.`);
  return next;
}

function diffSet(label: string, a: string[], b: string[], out: FieldChange[]) {
  const removed = a.filter((x) => !b.includes(x)), added = b.filter((x) => !a.includes(x));
  if (removed.length) out.push({ label, kind: 'remove', before: clip(removed.join(', ')) });
  if (added.length) out.push({ label, kind: 'add', after: clip(added.join(', ')) });
}

export function diffPtw(a: PtwEditable, b: PtwEditable): FieldChange[] {
  const out: FieldChange[] = [];
  const scalar = (label: string, x: string | null, y: string | null) => {
    if ((x || '') !== (y || '')) out.push({ label, kind: 'edit', before: x || '—', after: y || '—' });
  };
  scalar('Masa berlaku · mulai', a.valid_from, b.valid_from);
  scalar('Masa berlaku · selesai', a.valid_to, b.valid_to);
  scalar('Jam kerja · mulai', a.work_start, b.work_start);
  scalar('Jam kerja · selesai', a.work_end, b.work_end);

  const names = (w: PtwEditable['workers']) => w.map((x) => x.worker_name || x.id);
  const eqNames = (e: PtwEditable['equipment']) => e.map((x) => x.name || x.id);
  diffSet('Pekerja', names(a.workers), names(b.workers), out);
  diffSet('Peralatan', eqNames(a.equipment), eqNames(b.equipment), out);
  diffSet('Sumber bahaya', a.hazards, b.hazards, out);
  for (const cat of Object.keys(APD_ITEMS)) diffSet(`APD · ${cat}`, a.apd[cat] || [], b.apd[cat] || [], out);
  diffSet('Jenis pekerjaan panas', a.hot_work_types, b.hot_work_types, out);
  for (const k of ['o2', 'toxic', 'combustible'] as const) {
    scalar(`Frekuensi uji gas · ${k.toUpperCase()}`, a.gas_test_frequency[k] || '', b.gas_test_frequency[k] || '');
  }
  return out;
}

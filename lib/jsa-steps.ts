/**
 * Parse / serialize / diff langkah JSA (baris jsa_steps). Satu sumber untuk
 * editor reviewer dan server action; form vendor tetap punya parser sendiri.
 */
import type { JsaStepData, ControlDetail } from '@/app/vendor/dashboard/jsa/create/[id]/JsaStepCard';
import { DEFAULT_RISK, type JsaRisk } from '@/lib/jsa-risk';
import { emptyKebutuhan, hasStoredKebutuhan, kebutuhanSummary, type StepKebutuhan } from '@/lib/procedure-kebutuhan';
import { diffList, clip, type FieldChange } from '@/lib/prosedur-diff';

const json = (v: unknown): any => {
  if (typeof v !== 'string') return v ?? {};
  try { return JSON.parse(v); } catch { return {}; }
};

const emptyControl = (): ControlDetail => ({ eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' });

function parseControl(val: any): ControlDetail {
  if (typeof val === 'string') return { ...emptyControl(), administrasi: val };
  if (!val || typeof val !== 'object') return emptyControl();
  return {
    eliminasi: val.eliminasi || '', substitusi: val.substitusi || '', rekayasa: val.rekayasa || '',
    administrasi: val.administrasi || '', apd: val.apd || '',
  };
}

export function parseJsaStepRow(row: any, index: number): JsaStepData {
  const hazards = json(row.bahaya), risks = json(row.risiko), controls = json(row.tindakan);
  const stored = json(row.kebutuhan);
  return {
    id: index + 1,
    langkah: row.pekerjaan ?? row.description ?? '',
    kebutuhan: hasStoredKebutuhan(stored) ? { ...emptyKebutuhan(), ...(stored as StepKebutuhan) } : emptyKebutuhan(),
    jenisBahaya: hazards.jenisBahaya || 'Fisika',
    sebab: hazards.sebab || '',
    potensiBahaya: hazards.potensiBahaya || '',
    faktorPositif: parseControl(risks.faktorPositif),
    inherentRisk: risks.inherentRisk || { ...DEFAULT_RISK },
    mitigasi: parseControl(controls.mitigasi),
    residualRisk: controls.residualRisk || { ...DEFAULT_RISK },
  };
}

/** Bentuk baris jsa_steps — identik dengan saveJsa di app/vendor/dashboard/jsa/create/[id]/actions.ts. */
export function serializeJsaStep(step: JsaStepData, jsaId: string, index: number) {
  return {
    jsa_id: jsaId,
    step_number: index + 1,
    pekerjaan: step.langkah,
    kebutuhan: step.kebutuhan ?? {},
    bahaya: JSON.stringify({ jenisBahaya: step.jenisBahaya, sebab: step.sebab, potensiBahaya: step.potensiBahaya }),
    risiko: JSON.stringify({ faktorPositif: step.faktorPositif, inherentRisk: step.inherentRisk }),
    tindakan: JSON.stringify({ mitigasi: step.mitigasi, residualRisk: step.residualRisk }),
  };
}

/** Sanitasi langkah dari klien sebelum disimpan. */
export function sanitizeJsaSteps(raw: unknown): JsaStepData[] {
  const list = Array.isArray(raw) ? raw : [];
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const risk = (r: any): JsaRisk => ({
    severity: num(r?.severity, 1), intensitas: num(r?.intensitas, 1), kapabilitas: num(r?.kapabilitas, 1), history: num(r?.history, 1),
    total: num(r?.total, 3), probability: num(r?.probability, 1), rpn: num(r?.rpn, 1),
  });
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return list.map((st: any, i: number) => ({
    id: i + 1,
    langkah: s(st?.langkah),
    kebutuhan: { ...emptyKebutuhan(), ...(st?.kebutuhan || {}) },
    jenisBahaya: s(st?.jenisBahaya) || 'Fisika',
    sebab: s(st?.sebab),
    potensiBahaya: s(st?.potensiBahaya),
    faktorPositif: parseControl(st?.faktorPositif),
    inherentRisk: risk(st?.inherentRisk),
    mitigasi: parseControl(st?.mitigasi),
    residualRisk: risk(st?.residualRisk),
  })).filter((st) => st.langkah.trim());
}

const CONTROL_LABEL: Record<keyof ControlDetail, string> = {
  eliminasi: 'Eliminasi', substitusi: 'Substitusi', rekayasa: 'Rekayasa Alat', administrasi: 'Administrasi', apd: 'APD',
};
const riskText = (r: JsaRisk) => `RPN ${r.rpn} (Severity ${r.severity} · Intensitas ${r.intensitas} · Kapabilitas ${r.kapabilitas} · History ${r.history})`;

function diffStep(label: string, a: JsaStepData, b: JsaStepData, out: FieldChange[]) {
  const text = (name: string, x: string, y: string) => {
    if ((x || '').trim() !== (y || '').trim()) out.push({ label: `${label} · ${name}`, kind: 'edit', before: clip((x || '').trim()) || '—', after: clip((y || '').trim()) || '—' });
  };
  text('Jenis bahaya', a.jenisBahaya, b.jenisBahaya);
  text('Sebab / sumber bahaya', a.sebab, b.sebab);
  text('Potensi bahaya', a.potensiBahaya, b.potensiBahaya);
  (Object.keys(CONTROL_LABEL) as (keyof ControlDetail)[]).forEach((k) => {
    text(`Faktor positif · ${CONTROL_LABEL[k]}`, a.faktorPositif[k], b.faktorPositif[k]);
    text(`Mitigasi · ${CONTROL_LABEL[k]}`, a.mitigasi[k], b.mitigasi[k]);
  });
  const risk = (name: string, x: JsaRisk, y: JsaRisk) => {
    if (x.severity !== y.severity || x.intensitas !== y.intensitas || x.kapabilitas !== y.kapabilitas || x.history !== y.history) {
      out.push({ label: `${label} · ${name}`, kind: 'edit', before: riskText(x), after: riskText(y) });
    }
  };
  risk('Inherent risk', a.inherentRisk, b.inherentRisk);
  risk('Residual risk', a.residualRisk, b.residualRisk);
  const ka = kebutuhanSummary(a.kebutuhan) || '', kb = kebutuhanSummary(b.kebutuhan) || '';
  if (ka !== kb) out.push({ label: `${label} · Kebutuhan`, kind: 'edit', before: clip(ka) || '—', after: clip(kb) || '—' });
}

export function diffJsaSteps(a: JsaStepData[], b: JsaStepData[]): FieldChange[] {
  const out: FieldChange[] = [];
  let n = 0;
  for (const p of diffList(a, b, (s) => s.langkah.trim())) {
    if (p.t === 'del') out.push({ label: 'Langkah JSA', kind: 'remove', before: `"${p.a.langkah}"` });
    else if (p.t === 'add') { n++; out.push({ label: 'Langkah JSA', kind: 'add', after: `"${p.b.langkah}"` }); }
    else {
      n++;
      const label = `Langkah ${n} "${p.b.langkah.length > 40 ? `${p.b.langkah.slice(0, 40)}…` : p.b.langkah}"`;
      if (p.t === 'change') out.push({ label: `Langkah ${n} · Nama langkah`, kind: 'edit', before: p.a.langkah, after: p.b.langkah });
      diffStep(label, p.a, p.b, out);
    }
  }
  return out;
}

const flatApd = (k?: StepKebutuhan) => Object.values(k?.apd || {}).flat();

/**
 * Sinkronkan kolom APD pada "Faktor Positif" dengan APD di Kebutuhan langkah:
 * butir yang baru dicentang ditambahkan, yang dilepas dihapus, teks yang
 * diketik manual tetap dipertahankan.
 */
export function syncApdControl(prev: StepKebutuhan | undefined, next: StepKebutuhan | undefined, current: string): string {
  const before = flatApd(prev), after = flatApd(next);
  const removed = before.filter((x) => !after.includes(x));
  const added = after.filter((x) => !before.includes(x));
  const tokens = (current || '').split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean).filter((t) => !removed.includes(t));
  for (const a of added) if (!tokens.includes(a)) tokens.push(a);
  return tokens.join(', ');
}

/** Isi awal: kalau kolom APD faktor positif masih kosong tapi kebutuhan punya APD, isi dari kebutuhan. */
export function seedApdControl(step: JsaStepData): JsaStepData {
  if ((step.faktorPositif?.apd || '').trim()) return step;
  const items = flatApd(step.kebutuhan);
  return items.length ? { ...step, faktorPositif: { ...step.faktorPositif, apd: items.join(', ') } } : step;
}

/** Langkah JSA kosong bernama `langkah`, dengan kebutuhan awal (APD ikut mengisi Faktor Positif). */
export function blankJsaStep(langkah: string, kebutuhan?: StepKebutuhan): JsaStepData {
  return seedApdControl({
    id: 0,
    langkah,
    kebutuhan: { ...emptyKebutuhan(), ...(kebutuhan || {}) },
    jenisBahaya: 'Fisika',
    sebab: '',
    potensiBahaya: '',
    faktorPositif: emptyControl(),
    inherentRisk: { ...DEFAULT_RISK },
    mitigasi: emptyControl(),
    residualRisk: { ...DEFAULT_RISK },
  });
}

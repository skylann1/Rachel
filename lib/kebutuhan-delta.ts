/**
 * Delta kebutuhan (pekerja/alat/material/APD/bahaya) antara dua versi, dan
 * penerapannya ke versi lain. Dipakai sinkronisasi dua arah Prosedur ⇄ JSA ⇄ PTW:
 * yang disinkronkan adalah PERUBAHANNYA (bukan menimpa seluruh isi), supaya
 * isian khusus di dokumen tujuan tidak hilang. Pure function.
 */
import {
  emptyKebutuhan, type KebutuhanResource, type StepKebutuhan, type TahapanSection,
} from '@/lib/procedure-kebutuhan';

export interface ResDelta { add: KebutuhanResource[]; remove: string[] }
export interface KDelta {
  workers: ResDelta;
  equipment: ResDelta;
  materials: ResDelta;
  apd: Record<string, { add: string[]; remove: string[] }>;
  hazards: { add: string[]; remove: string[] };
}

const norm = (k?: Partial<StepKebutuhan>): StepKebutuhan => ({ ...emptyKebutuhan(), ...(k || {}) });

function resDelta(prev: KebutuhanResource[], next: KebutuhanResource[]): ResDelta {
  const pIds = new Set(prev.map((r) => r.id)), nIds = new Set(next.map((r) => r.id));
  return { add: next.filter((r) => !pIds.has(r.id)), remove: prev.filter((r) => !nIds.has(r.id)).map((r) => r.id) };
}
function strDelta(prev: string[], next: string[]) {
  return { add: next.filter((x) => !prev.includes(x)), remove: prev.filter((x) => !next.includes(x)) };
}

export function kebutuhanDelta(prevRaw?: Partial<StepKebutuhan>, nextRaw?: Partial<StepKebutuhan>): KDelta {
  const prev = norm(prevRaw), next = norm(nextRaw);
  const apd: KDelta['apd'] = {};
  for (const cat of new Set([...Object.keys(prev.apd), ...Object.keys(next.apd)])) {
    const d = strDelta(prev.apd[cat] || [], next.apd[cat] || []);
    if (d.add.length || d.remove.length) apd[cat] = d;
  }
  return {
    workers: resDelta(prev.workers, next.workers),
    equipment: resDelta(prev.equipment, next.equipment),
    materials: resDelta(prev.materials, next.materials),
    apd,
    hazards: strDelta(prev.hazards, next.hazards),
  };
}

export function isDeltaEmpty(d: KDelta): boolean {
  const r = (x: ResDelta) => x.add.length === 0 && x.remove.length === 0;
  return r(d.workers) && r(d.equipment) && r(d.materials) && Object.keys(d.apd).length === 0 && d.hazards.add.length === 0 && d.hazards.remove.length === 0;
}

/** Hanya bagian penambahan / hanya bagian penghapusan dari sebuah delta. */
export function addsOf(d: KDelta): KDelta {
  return {
    workers: { add: d.workers.add, remove: [] }, equipment: { add: d.equipment.add, remove: [] }, materials: { add: d.materials.add, remove: [] },
    apd: Object.fromEntries(Object.entries(d.apd).filter(([, v]) => v.add.length).map(([k, v]) => [k, { add: v.add, remove: [] }])),
    hazards: { add: d.hazards.add, remove: [] },
  };
}
export function removesOf(d: KDelta): KDelta {
  return {
    workers: { add: [], remove: d.workers.remove }, equipment: { add: [], remove: d.equipment.remove }, materials: { add: [], remove: d.materials.remove },
    apd: Object.fromEntries(Object.entries(d.apd).filter(([, v]) => v.remove.length).map(([k, v]) => [k, { add: [], remove: v.remove }])),
    hazards: { add: [], remove: d.hazards.remove },
  };
}

function applyRes(list: KebutuhanResource[], d: ResDelta): KebutuhanResource[] {
  const kept = list.filter((r) => !d.remove.includes(r.id));
  const have = new Set(kept.map((r) => r.id));
  return [...kept, ...d.add.filter((r) => !have.has(r.id))];
}
function applyStr(list: string[], d: { add: string[]; remove: string[] }): string[] {
  const kept = list.filter((x) => !d.remove.includes(x));
  return [...kept, ...d.add.filter((x) => !kept.includes(x))];
}

export function applyKDelta(baseRaw: Partial<StepKebutuhan> | undefined, d: KDelta): StepKebutuhan {
  const base = norm(baseRaw);
  const apd: Record<string, string[]> = { ...base.apd };
  for (const [cat, dd] of Object.entries(d.apd)) {
    const next = applyStr(apd[cat] || [], dd);
    if (next.length) apd[cat] = next; else delete apd[cat];
  }
  return {
    workers: applyRes(base.workers, d.workers),
    equipment: applyRes(base.equipment, d.equipment),
    materials: applyRes(base.materials, d.materials),
    apd,
    hazards: applyStr(base.hazards, d.hazards),
  };
}

/**
 * Terapkan delta ke satu bagian Tahapan Prosedur: penghapusan berlaku di SEMUA
 * langkahnya, penambahan masuk ke langkah PERTAMA (kebutuhan prosedur per langkah,
 * sedangkan JSA/PTW hanya mengenal agregat per tahapan).
 */
export function applyDeltaToSection(sec: TahapanSection, d: KDelta): TahapanSection {
  if (sec.points.length === 0) return sec;
  const rm = removesOf(d), ad = addsOf(d);
  return {
    ...sec,
    points: sec.points.map((p, i) => {
      let k = applyKDelta(p.kebutuhan, rm);
      if (i === 0) k = applyKDelta(k, ad);
      return { ...p, kebutuhan: k };
    }),
  };
}

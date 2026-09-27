/**
 * Kebutuhan sumber daya per sub-langkah (bullet point) TAHAPAN PEKERJAAN pada
 * prosedur kerja, yang diagregat ke langkah JSA lalu dipakai sebagai prefill
 * (auto-check) form PTW. Murni pure function — tidak menyentuh Supabase,
 * supaya dipakai konsisten dari form prosedur, PDF, getJsa, dan form PTW.
 *
 * Alur data:
 *   prosedur content.tahapanPekerjaan[].points[].kebutuhan  (per bullet)
 *     → aggregatePointNeeds()                                (per tahapan/JSA step)
 *       → jsa_steps.kebutuhan                                (kolom JSONB)
 *         → aggregateStepNeeds()                             (per proyek)
 *           → prefill worker/equipment/apd di form PTW
 *
 * Material sengaja DIBAWA sampai JSA (dokumentasi) tapi TIDAK ikut prefill PTW
 * — PTW belum punya slot material. Lihat spec
 * docs/superpowers/specs/2026-09-23-prosedur-kebutuhan-ptw-prefill-design.md.
 */

/** Referensi ke baris master data (vendor_workers / vendor_equipment /
 * vendor_materials) — snapshot { id, label } supaya prosedur tetap kebaca
 * walau baris master-nya diubah/dihapus. PTW mencocokkan ulang lewat id
 * terhadap roster yang SEGAR waktu bikin PTW. */
export interface KebutuhanResource {
  id: string;
  label: string;
}

/** Kebutuhan satu titik/sub-langkah — atau hasil agregasi per step/per proyek. */
export interface StepKebutuhan {
  workers: KebutuhanResource[];
  equipment: KebutuhanResource[];
  materials: KebutuhanResource[];
  /** Bentuk persis kolom `ptw.apd`: { kategori: [butir, ...] } dari APD_ITEMS. */
  apd: Record<string, string[]>;
}

/** Satu bullet point TAHAPAN PEKERJAAN — menggantikan `string` legacy. */
export interface TahapanPoint {
  text: string;
  kebutuhan?: StepKebutuhan;
}

export interface TahapanSection {
  title: string;
  points: TahapanPoint[];
}

/** Bentuk-kosong yang aman untuk diisi chart slot. */
export function emptyKebutuhan(): StepKebutuhan {
  return { workers: [], equipment: [], materials: [], apd: {} };
}

function isTahapanPoint(p: unknown): p is TahapanPoint {
  return typeof p === 'object' && p !== null && 'text' in p;
}

/**
 * SATU-SATUNYA tempat menormalkan `tahapanPekerjaan` dari content prosedur —
 * dipakai form prosedur, ProsedurPDF, dan getJsa supaya data lama (points
 * masih string[]) dan data baru selalu dibaca dengan bentuk yang sama.
 */
export function normalizeTahapanPekerjaan(raw: unknown): TahapanSection[] {
  const sections = Array.isArray(raw) ? raw : [];
  return sections.map((section): TahapanSection => {
    const title: string =
      typeof section?.title === 'string' ? section.title : '';
    const rawPoints: unknown = Array.isArray(section?.points) ? section.points : [];
    const pointList: unknown[] = Array.isArray(rawPoints) ? rawPoints : [];
    const points: TahapanPoint[] = pointList.map((p: unknown): TahapanPoint => {
      if (isTahapanPoint(p)) {
        return {
          text: typeof p.text === 'string' ? p.text : '',
          kebutuhan: p.kebutuhan ? { ...emptyKebutuhan(), ...p.kebutuhan } : emptyKebutuhan(),
        };
      }
      // Legacy: points masih array string.
      return { text: typeof p === 'string' ? p : String(p || ''), kebutuhan: emptyKebutuhan() };
    });
    return { title, points };
  });
}

function dedupeResources(list: KebutuhanResource[]): KebutuhanResource[] {
  const seen = new Set<string>();
  const out: KebutuhanResource[] = [];
  for (const item of list) {
    if (!item || !item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, label: item.label });
  }
  return out;
}

function mergeApd(a: Record<string, string[]> | undefined, b: Record<string, string[]> | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const categories = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const cat of categories) {
    const merged = [];
    const seen = new Set<string>();
    for (const item of [...(a?.[cat] || []), ...(b?.[cat] || [])]) {
      if (seen.has(item)) continue;
      seen.add(item);
      merged.push(item);
    }
    if (merged.length > 0) out[cat] = merged;
  }
  return out;
}

/**
 * Agregasi kebutuhan SEMUA bullet point sebuah tahapan (atau semua step JSA)
 * — union per kategori, di-dedupe by id / by (kategori, butir).
 */
export function aggregateKebutuhan(list: StepKebutuhan[]): StepKebutuhan {
  let workers: KebutuhanResource[] = [];
  let equipment: KebutuhanResource[] = [];
  let materials: KebutuhanResource[] = [];
  let apd: Record<string, string[]> = {};
  for (const k of list) {
    if (!k) continue;
    workers = [...workers, ...(k.workers || [])];
    equipment = [...equipment, ...(k.equipment || [])];
    materials = [...materials, ...(k.materials || [])];
    apd = mergeApd(apd, k.apd);
  }
  return {
    workers: dedupeResources(workers),
    equipment: dedupeResources(equipment),
    materials: dedupeResources(materials),
    apd,
  };
}

/** Kebutuhan sebuah tahapan = union dari kebutuhan semua bullet point-nya. */
export function aggregatePointNeeds(points: TahapanPoint[]): StepKebutuhan {
  return aggregateKebutuhan((points || []).map((p) => p?.kebutuhan || emptyKebutuhan()));
}

/** Kebutuhan seluruh proyek = union kebutuhan semua langkah JSA. */
export function aggregateStepNeeds(
  steps: Array<{ kebutuhan?: Partial<StepKebutuhan> }>
): StepKebutuhan {
  return aggregateKebutuhan(
    (steps || []).map((s) => (s?.kebutuhan ? { ...emptyKebutuhan(), ...s.kebutuhan } : emptyKebutuhan()))
  );
}

/** Label ringkas kebutuhan untuk ditampilkan sebagai satu baris chip/teks. */
export function kebutuhanSummary(k: StepKebutuhan | undefined): string | null {
  if (!k) return null;
  const parts: string[] = [];
  if (k.workers?.length) parts.push(`Pekerja: ${k.workers.map((w) => w.label).join(', ')}`);
  if (k.equipment?.length) parts.push(`Peralatan: ${k.equipment.map((e) => e.label).join(', ')}`);
  if (k.materials?.length) parts.push(`Material: ${k.materials.map((m) => m.label).join(', ')}`);
  const apdItems = Object.values(k.apd || {}).flat();
  if (apdItems.length) parts.push(`APD: ${apdItems.join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
}

/** true kalau sebuah kebutuhan tidak memuat referensi apa pun. */
export function isKebutuhanEmpty(k: StepKebutuhan | undefined): boolean {
  if (!k) return true;
  return (
    !k.workers?.length &&
    !k.equipment?.length &&
    !k.materials?.length &&
    !Object.values(k.apd || {}).some((list) => list.length > 0)
  );
}
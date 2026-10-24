/**
 * Pelacakan perubahan isi Prosedur Kerja — murni pure function (tanpa Supabase),
 * dipakai server action (hitung diff + simpan ke content.changeLog) dan UI
 * (render riwayat). Disimpan di `procedures.content.changeLog` (JSONB) sehingga
 * tidak butuh migrasi skema.
 */
import { normalizeTahapanPekerjaan, kebutuhanSummary, type TahapanSection } from '@/lib/procedure-kebutuhan';

export interface FieldChange {
  label: string;
  kind: 'edit' | 'add' | 'remove';
  before?: string;
  after?: string;
  /** before/after berisi URL gambar, bukan teks. */
  isImage?: boolean;
}

export interface ChangeLogEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  /** Peran/tahap pengubah saat itu, mis. "HSE PGSOL" atau "Vendor (pengajuan ulang)". */
  actorLabel: string;
  summary: string;
  note?: string | null;
  changes: FieldChange[];
}

/** Field isi dokumen yang boleh diubah lewat jalur "ubah langsung". contractNo sengaja tidak ada (turunan proyek). */
export const EDITABLE_CONTENT_KEYS = [
  'docNo', 'submissionDate', 'umum', 'scopeOfWork', 'tools', 'selectedApd',
  'perlengkapanLainnya', 'tahapanPekerjaan', 'penyelesaianAkhir', 'requiredPtwTypes',
] as const;

const MAX_TEXT = 600;
export const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const lines = (v: unknown) => str(v).split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);

type Op<T> = { t: 'same' | 'del' | 'add'; a?: T; b?: T };
type Paired<T> =
  | { t: 'same'; a: T; b: T }
  | { t: 'change'; a: T; b: T }
  | { t: 'del'; a: T }
  | { t: 'add'; b: T };

/** Diff berbasis LCS; baris yang dihapus lalu ditambah di celah yang sama dipasangkan jadi "change". */
export function diffList<T>(a: T[], b: T[], key: (x: T) => string): Paired<T>[] {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = key(a[i]) === key(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op<T>[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) { ops.push({ t: 'same', a: a[i], b: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: 'del', a: a[i] }); i++; }
    else { ops.push({ t: 'add', b: b[j] }); j++; }
  }
  while (i < n) ops.push({ t: 'del', a: a[i++] });
  while (j < m) ops.push({ t: 'add', b: b[j++] });

  const out: Paired<T>[] = [];
  let dels: T[] = [], adds: T[] = [];
  const flush = () => {
    const pairs = Math.min(dels.length, adds.length);
    for (let k = 0; k < pairs; k++) out.push({ t: 'change', a: dels[k], b: adds[k] });
    for (let k = pairs; k < dels.length; k++) out.push({ t: 'del', a: dels[k] });
    for (let k = pairs; k < adds.length; k++) out.push({ t: 'add', b: adds[k] });
    dels = []; adds = [];
  };
  for (const op of ops) {
    if (op.t === 'same') { flush(); out.push({ t: 'same', a: op.a as T, b: op.b as T }); }
    else if (op.t === 'del') dels.push(op.a as T);
    else adds.push(op.b as T);
  }
  flush();
  return out;
}

function diffStringList(label: string, a: string[], b: string[], out: FieldChange[]) {
  for (const p of diffList(a, b, (x) => x)) {
    if (p.t === 'change') out.push({ label, kind: 'edit', before: clip(p.a), after: clip(p.b) });
    else if (p.t === 'del') out.push({ label, kind: 'remove', before: clip(p.a) });
    else if (p.t === 'add') out.push({ label, kind: 'add', after: clip(p.b) });
  }
}

function diffScalar(label: string, a: string, b: string, out: FieldChange[]) {
  if (a.trim() === b.trim()) return;
  out.push({ label, kind: 'edit', before: clip(a.trim()) || '—', after: clip(b.trim()) || '—' });
}

const short = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);

function diffPoints(secLabel: string, a: TahapanSection['points'], b: TahapanSection['points'], out: FieldChange[]) {
  for (const p of diffList(a, b, (x) => x.text.trim())) {
    if (p.t === 'del') out.push({ label: `${secLabel} · langkah`, kind: 'remove', before: clip(p.a.text) });
    else if (p.t === 'add') out.push({ label: `${secLabel} · langkah`, kind: 'add', after: clip(p.b.text) });
    else {
      if (p.t === 'change') out.push({ label: `${secLabel} · langkah`, kind: 'edit', before: clip(p.a.text), after: clip(p.b.text) });
      const ref = `${secLabel} · "${short(p.b.text)}"`;
      if ((p.a.imageUrl || '') !== (p.b.imageUrl || '')) {
        out.push({
          label: `${ref} · gambar`,
          kind: !p.a.imageUrl ? 'add' : !p.b.imageUrl ? 'remove' : 'edit',
          before: p.a.imageUrl, after: p.b.imageUrl, isImage: true,
        });
      }
      const ka = kebutuhanSummary(p.a.kebutuhan) || '', kb = kebutuhanSummary(p.b.kebutuhan) || '';
      if (ka !== kb) out.push({ label: `${ref} · kebutuhan`, kind: 'edit', before: clip(ka) || '—', after: clip(kb) || '—' });
    }
  }
}

/** Daftar perubahan isi dokumen dari `oldC` ke `newC` (keduanya bentuk content prosedur). */
export function diffProsedurContent(oldC: any, newC: any): FieldChange[] {
  const o = oldC || {}, n = newC || {};
  const out: FieldChange[] = [];

  diffScalar('Nomor Dokumen', str(o.docNo), str(n.docNo), out);
  diffScalar('Tanggal Pengajuan', str(o.submissionDate), str(n.submissionDate), out);
  diffScalar('1. Umum', str(o.umum), str(n.umum), out);
  diffStringList('2. Ruang Lingkup', lines(o.scopeOfWork), lines(n.scopeOfWork), out);

  const ptwA = strList(o.requiredPtwTypes), ptwB = strList(n.requiredPtwTypes);
  if (ptwA.slice().sort().join('|') !== ptwB.slice().sort().join('|')) {
    out.push({ label: 'Jenis PTW yang Dibutuhkan', kind: 'edit', before: ptwA.join(', ') || '—', after: ptwB.join(', ') || '—' });
  }

  const secA = normalizeTahapanPekerjaan(o.tahapanPekerjaan), secB = normalizeTahapanPekerjaan(n.tahapanPekerjaan);
  let nIdx = 0;
  for (const p of diffList(secA, secB, (s) => s.title.trim())) {
    if (p.t === 'del') {
      out.push({ label: '6. Tahapan Pekerjaan', kind: 'remove', before: `Tahapan "${p.a.title}" (${p.a.points.length} langkah)` });
    } else if (p.t === 'add') {
      nIdx++;
      out.push({ label: '6. Tahapan Pekerjaan', kind: 'add', after: `Tahapan "${p.b.title}" (${p.b.points.length} langkah)` });
    } else {
      nIdx++;
      const secLabel = `6.${nIdx} ${p.b.title}`;
      if (p.t === 'change') out.push({ label: `6.${nIdx} Judul tahapan`, kind: 'edit', before: p.a.title, after: p.b.title });
      diffPoints(secLabel, p.a.points, p.b.points, out);
    }
  }

  diffStringList('7. Penyelesaian Akhir', strList(o.penyelesaianAkhir), strList(n.penyelesaianAkhir), out);
  return out;
}

/** Gabungkan patch (whitelist field) ke content lama; field lain (revisions, changeLog, contractNo, …) tetap. */
export function applyContentPatch(content: any, patch: Record<string, unknown>): any {
  const next = { ...(content || {}) };
  for (const key of EDITABLE_CONTENT_KEYS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (key === 'tahapanPekerjaan') next[key] = normalizeTahapanPekerjaan(v);
    else if (['docNo', 'submissionDate', 'umum', 'scopeOfWork'].includes(key)) next[key] = str(v);
    else next[key] = strList(v);
  }
  return next;
}

export function summarizeChanges(changes: FieldChange[]): string {
  const labels = Array.from(new Set(changes.map((c) => c.label.split(' · ')[0])));
  const head = `${changes.length} perubahan`;
  return `${head}: ${labels.slice(0, 4).join('; ')}${labels.length > 4 ? '; …' : ''}`;
}

export function readChangeLog(content: any): ChangeLogEntry[] {
  return Array.isArray(content?.changeLog) ? (content.changeLog as ChangeLogEntry[]) : [];
}

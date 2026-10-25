/**
 * Logika murni News & Pengumuman: kategori, audiens, status terbit, dan parser
 * konten ringan (markup mirip Markdown, dirender sebagai elemen React — bukan
 * HTML mentah — sehingga aman dari XSS).
 */

export const NEWS_CATEGORIES = ['Info', 'Info K3', 'Regulasi', 'Insiden & Pelajaran', 'Kegiatan', 'Pengumuman Sistem'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const CATEGORY_TONE: Record<string, string> = {
  'Info': 'bg-slate-100 text-slate-700 border-slate-200',
  'Info K3': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Regulasi': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Insiden & Pelajaran': 'bg-rose-50 text-rose-700 border-rose-200',
  'Kegiatan': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pengumuman Sistem': 'bg-sky-50 text-sky-700 border-sky-200',
};
export const categoryTone = (c: string) => CATEGORY_TONE[c] ?? CATEGORY_TONE['Info'];

export type NewsAudience = 'pgn' | 'pgsol' | 'vendor';
export const AUDIENCE_OPTIONS: { value: NewsAudience; label: string }[] = [
  { value: 'pgn', label: 'PGN' },
  { value: 'pgsol', label: 'PGAS Solution' },
  { value: 'vendor', label: 'Vendor' },
];
export const ALL_AUDIENCES: NewsAudience[] = ['pgn', 'pgsol', 'vendor'];

export interface NewsAttachment { name: string; url: string }

export interface NewsItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  image_url: string;
  category: string;
  audience: string[];
  is_active: boolean;
  is_pinned: boolean;
  is_mandatory: boolean;
  display_order: number;
  publish_at: string | null;
  expires_at: string | null;
  attachments: NewsAttachment[];
  created_at: string;
  /** Diisi untuk pembaca (bukan halaman kelola). */
  is_read?: boolean;
  is_acknowledged?: boolean;
}

export type NewsState = 'draft' | 'scheduled' | 'live' | 'expired';

/** Status terbit sebuah pengumuman pada waktu `now`. */
export function newsState(n: Pick<NewsItem, 'is_active' | 'publish_at' | 'expires_at'>, now = new Date()): NewsState {
  if (!n.is_active) return 'draft';
  if (n.publish_at && new Date(n.publish_at) > now) return 'scheduled';
  if (n.expires_at && new Date(n.expires_at) <= now) return 'expired';
  return 'live';
}

export const STATE_META: Record<NewsState, { label: string; tone: string }> = {
  draft: { label: 'Nonaktif', tone: 'bg-slate-100 text-slate-500 border-slate-200' },
  scheduled: { label: 'Terjadwal', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  live: { label: 'Tayang', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expired: { label: 'Kedaluwarsa', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export function normalizeAttachments(raw: unknown): NewsAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => a && typeof a.url === 'string' && /^https?:\/\//i.test(a.url))
    .map((a: any) => ({ name: String(a.name || 'Lampiran').slice(0, 120), url: a.url }));
}

// --------------------------------------------------------------- konten

export type InlineToken = { t: 'text'; v: string } | { t: 'bold'; v: string } | { t: 'link'; v: string; href: string };
export type NewsBlock =
  | { t: 'h2' | 'h3' | 'p'; inline: InlineToken[] }
  | { t: 'ul' | 'ol'; items: InlineToken[][] }
  | { t: 'quote'; inline: InlineToken[] };

/** **tebal** dan [teks](https://tautan). Tautan hanya http(s) — selain itu dirender sebagai teks. */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] });
    else if (/^https?:\/\//i.test(m[3])) out.push({ t: 'link', v: m[2], href: m[3] });
    else out.push({ t: 'text', v: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/**
 * Blok didukung: `## judul`, `### sub`, `- butir`, `1. butir`, `> kutipan`,
 * paragraf (baris berurutan digabung, baris kosong memisahkan).
 */
export function parseNewsContent(src: string | null | undefined): NewsBlock[] {
  const blocks: NewsBlock[] = [];
  const lines = (src ?? '').replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: InlineToken[][] } | null = null;

  const flushPara = () => { if (para.length) { blocks.push({ t: 'p', inline: parseInline(para.join(' ')) }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ t: list.kind, items: list.items }); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)$/))) { flushPara(); flushList(); blocks.push({ t: 'h3', inline: parseInline(m[1]) }); continue; }
    if ((m = line.match(/^##\s+(.*)$/))) { flushPara(); flushList(); blocks.push({ t: 'h2', inline: parseInline(m[1]) }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); blocks.push({ t: 'quote', inline: parseInline(m[1]) }); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.kind !== 'ul') { flushList(); list = { kind: 'ul', items: [] }; }
      list.items.push(parseInline(m[1]));
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || list.kind !== 'ol') { flushList(); list = { kind: 'ol', items: [] }; }
      list.items.push(parseInline(m[1]));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

/** Ringkasan teks polos dari konten (untuk cuplikan di daftar). */
export function plainExcerpt(src: string | null | undefined, max = 160): string {
  const text = (src ?? '')
    .replace(/^#{2,3}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

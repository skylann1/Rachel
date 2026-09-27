/**
 * Shared helpers for the field-facing "site ops" trio (Toolbox Meeting,
 * QR Check-in, Stop Work Authority). Kept outside any "use server" action
 * file — see lib/document-logs.ts for why a type/helper-only module has to
 * live separately from "use server" files (Turbopack re-export gotcha).
 */
export function buildCheckinUrl(fieldToken: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || '';
  return `${base}/checkin/${fieldToken}`;
}

/**
 * "Hari ini" menurut kalender Asia/Jakarta, bukan timezone server.
 *
 * Server (Vercel et al.) umumnya berjalan di UTC; kalau pakai `new Date()`
 * langsung, di sekitar tengah malam WIB hasilnya bisa berbeda satu hari dari
 * `CURRENT_DATE` di Postgres — bikin cek "berlaku sampai hari ini", PTW
 * expired, dan `meeting_date` drift. Semua perbandingan tanggal harian di
 * kode domain ini wajib lewat helper ini.
 */
export function todayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Versi "hari ini" yang bisa diurai kembali dengan aman oleh `new Date(...)`
 * tanpa netralisasi zona waktu: nilai tengah hari UTC. Dipakai oleh kode yang
 * menghitung selisih hari (misal masa berlaku dokumen).
 */
export function todayNoonUtc(): Date {
  return new Date(`${todayDateString()}T12:00:00Z`);
}

export async function getTodayToolboxMeeting(supabase: any, ptwId: string) {
  const { data } = await supabase
    .from('toolbox_meetings')
    .select('*')
    .eq('ptw_id', ptwId)
    .eq('meeting_date', todayDateString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

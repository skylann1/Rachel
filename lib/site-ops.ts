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

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

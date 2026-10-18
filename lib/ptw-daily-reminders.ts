import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectivePtwStatus, PTW_STATUS } from '@/lib/ptw-status';
import { PTW_TRACK_MAX_DAYS, PTW_TYPES } from '@/lib/ptw-types';
import { dayIndexForDate, FIELD_PERAN_LABEL, type FieldPeran } from '@/lib/ptw-field';
import { todayDateString } from '@/lib/site-ops';

export interface DailyCheckReminder {
  userId: string;
  ptwId: string;
  peran: FieldPeran;
  hariKe: number;
  title: string;
  message: string;
  link: string;
}

/**
 * Pemegang/Pengawas aktif pada PTW yang sedang berlaku hari ini dan BELUM
 * mengirim daily check untuk perannya. Murni baca — pengiriman notifikasi
 * ada di route cron. Dipanggil dengan klien service-role (tanpa sesi user).
 */
export async function findPendingDailyChecks(supabase: SupabaseClient): Promise<DailyCheckReminder[]> {
  const today = todayDateString();

  const { data: ptws } = await supabase
    .from('ptw')
    .select('id, ptw_type, ptw_number, status, valid_from, valid_to, project_id, projects ( name, end_date )')
    .eq('status', PTW_STATUS.aktif);

  const running = (ptws || [])
    .map((p: any) => {
      const proj = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      const effective = getEffectivePtwStatus(p.status, p.valid_to ?? proj?.end_date);
      const hariKe = dayIndexForDate(p.valid_from, p.valid_to, today, PTW_TRACK_MAX_DAYS);
      return { ptw: p, proj, effective, hariKe };
    })
    .filter(x => x.effective === PTW_STATUS.aktif && x.hariKe !== null);
  if (running.length === 0) return [];

  const ptwIds = running.map(x => x.ptw.id);
  const [{ data: assignments }, { data: checks }] = await Promise.all([
    supabase.from('ptw_field_assignments').select('ptw_id, peran, user_id').in('ptw_id', ptwIds).is('aktif_sampai', null),
    supabase.from('ptw_daily_checks').select('ptw_id, hari_ke, peran').in('ptw_id', ptwIds),
  ]);

  const done = new Set((checks || []).map((c: any) => `${c.ptw_id}:${c.hari_ke}:${c.peran}`));
  const byPtw = new Map(running.map(x => [x.ptw.id as string, x]));

  const reminders: DailyCheckReminder[] = [];
  for (const a of (assignments || []) as { ptw_id: string; peran: FieldPeran; user_id: string }[]) {
    const x = byPtw.get(a.ptw_id);
    if (!x || x.hariKe === null) continue;
    if (done.has(`${a.ptw_id}:${x.hariKe}:${a.peran}`)) continue;

    const typeTitle = PTW_TYPES.find(t => t.id === x.ptw.ptw_type)?.title.split('(')[0].trim() || x.ptw.ptw_type;
    const label = `${typeTitle}${x.ptw.ptw_number ? ` (${x.ptw.ptw_number})` : ''}`;
    reminders.push({
      userId: a.user_id,
      ptwId: a.ptw_id,
      peran: a.peran,
      hariKe: x.hariKe,
      title: 'Daily Check PTW Belum Diisi',
      message: `Anda ${FIELD_PERAN_LABEL[a.peran]} untuk PTW ${label} pada proyek "${x.proj?.name ?? '-'}". Daily check hari ke-${x.hariKe} belum diisi hari ini.`,
      // Pemegang = staf vendor (realm vendor); Pengawas = staf PGN (realm internal).
      link: a.peran === 'pemegang'
        ? `/vendor/dashboard/projects/${x.ptw.project_id}`
        : `/dashboard/projects/${x.ptw.project_id}`,
    });
  }
  return reminders;
}

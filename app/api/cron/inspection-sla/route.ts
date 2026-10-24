import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { insertNotificationsWithPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Eskalasi SLA Inspeksi Temuan: temuan belum Closed yang due_date-nya sudah
 * lewat (terlambat) atau jatuh tempo hari ini/besok diingatkan harian lewat
 * notifikasi in-app + push. Dipicu Vercel Cron (vercel.json), pola sama dengan
 * /api/cron/ptw-daily-reminders — fail-closed tanpa CRON_SECRET.
 *
 * Penerima:
 *  - status Open        -> staff organisasi vendor (target_vendor) + petugas internal
 *  - status In Progress -> petugas internal (menunggu validasi)
 * Temuan terlambat > 3 hari juga dieskalasi ke pelapor.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // "Hari ini" menurut Asia/Jakarta (UTC+7, tanpa DST).
  const jakartaNow = new Date(Date.now() + 7 * 3600 * 1000);
  const todayStr = jakartaNow.toISOString().slice(0, 10);
  const startOfTodayUtc = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()) - 7 * 3600 * 1000);
  const tomorrow = new Date(jakartaNow); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const dayDiff = (due: string) => Math.round((Date.parse(todayStr) - Date.parse(due)) / 86400000);

  const { data: rows, error } = await supabase
    .from('inspections')
    .select('id, title, location, status, due_date, target_vendor, assigned_to, reported_by')
    .neq('status', 'Closed')
    .not('due_date', 'is', null)
    .lte('due_date', tomorrowStr);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ pending: 0, sent: 0 });

  // Staff per organisasi vendor, sekali query.
  const orgIds = Array.from(new Set(rows.map((r) => r.target_vendor).filter(Boolean))) as string[];
  const orgMembers = new Map<string, string[]>();
  if (orgIds.length > 0) {
    const { data: members } = await supabase.from('profiles').select('id, org_id').in('org_id', orgIds);
    (members || []).forEach((m: any) => orgMembers.set(m.org_id, [...(orgMembers.get(m.org_id) ?? []), m.id]));
  }

  const candidates: { user_id: string; type: 'action_required' | 'warning'; title: string; message: string; link: string }[] = [];
  for (const r of rows) {
    const late = dayDiff(r.due_date);
    const overdue = late > 0;
    const title = overdue ? 'Temuan K3 Melewati Batas Waktu' : 'Temuan K3 Segera Jatuh Tempo';
    const when = overdue ? `terlambat ${late} hari` : r.due_date === todayStr ? 'jatuh tempo hari ini' : 'jatuh tempo besok';
    const message = `Temuan "${r.title}" di lokasi "${r.location}" ${when}.`;

    const internalIds = [r.assigned_to, late > 3 ? r.reported_by : null].filter(Boolean) as string[];
    const vendorIds = r.status === 'Open' && r.target_vendor ? orgMembers.get(r.target_vendor) ?? [] : [];
    const type = overdue ? 'warning' : 'action_required';

    for (const uid of new Set(internalIds)) candidates.push({ user_id: uid, type, title, message, link: `/dashboard/inspection/${r.id}` });
    for (const uid of new Set(vendorIds)) candidates.push({ user_id: uid, type, title, message, link: `/vendor/dashboard/inspection/${r.id}` });
  }

  // Dedup per hari: job yang dijalankan ulang tidak mengirim dobel.
  const { data: already } = await supabase
    .from('notifications')
    .select('user_id, link, title')
    .in('title', ['Temuan K3 Melewati Batas Waktu', 'Temuan K3 Segera Jatuh Tempo'])
    .gte('created_at', startOfTodayUtc.toISOString());
  const sentKeys = new Set((already || []).map((n: any) => `${n.user_id}:${n.link}:${n.title}`));
  const fresh = candidates.filter((c) => !sentKeys.has(`${c.user_id}:${c.link}:${c.title}`));

  // Satu push per notifikasi (isi push diambil dari baris pertama batch).
  for (const c of fresh) await insertNotificationsWithPush(supabase, [c]);

  return NextResponse.json({ pending: rows.length, sent: fresh.length });
}

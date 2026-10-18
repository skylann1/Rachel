import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { insertNotificationsWithPush } from '@/lib/push';
import { findPendingDailyChecks } from '@/lib/ptw-daily-reminders';

export const dynamic = 'force-dynamic';

/**
 * Pengingat harian: Pemegang/Pengawas PTW yang belum mengirim daily check hari
 * ini menerima notifikasi (in-app + push). Dipicu Vercel Cron (vercel.json).
 *
 * Fail-closed: tanpa CRON_SECRET di environment, atau header Authorization
 * tidak cocok, request ditolak. Vercel mengirim `Authorization: Bearer
 * <CRON_SECRET>` otomatis begitu variabel itu diset di project.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const pending = await findPendingDailyChecks(supabase);
  if (pending.length === 0) return NextResponse.json({ sent: 0, pending: 0 });

  // Dedup per hari: jangan kirim ulang kalau job dijalankan lebih dari sekali.
  // Awal "hari ini" menurut Asia/Jakarta (UTC+7, tanpa DST).
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + 7 * 3600 * 1000);
  const startOfTodayUtc = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()) - 7 * 3600 * 1000);

  const userIds = Array.from(new Set(pending.map(p => p.userId)));
  const { data: already } = await supabase
    .from('notifications')
    .select('user_id, link')
    .eq('title', pending[0].title)
    .in('user_id', userIds)
    .gte('created_at', startOfTodayUtc.toISOString());
  const sentKeys = new Set((already || []).map((n: any) => `${n.user_id}:${n.link}`));

  const fresh = pending.filter(p => !sentKeys.has(`${p.userId}:${p.link}`));
  // Satu push per user per batch: insertNotificationsWithPush memakai baris
  // pertama sebagai isi push, jadi kirim per notifikasi agar isinya tepat.
  for (const p of fresh) {
    await insertNotificationsWithPush(supabase, [{
      user_id: p.userId,
      type: 'action_required',
      title: p.title,
      message: p.message,
      link: p.link,
    }]);
  }

  return NextResponse.json({ pending: pending.length, sent: fresh.length });
}

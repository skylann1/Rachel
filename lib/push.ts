// lib/push.ts
//
// Pengiriman Web Push (notifikasi perangkat) untuk RACHEL K3.
//
// Alur lengkapnya:
//   1. Klien mengaktifkan notifikasi → app/dashboard/inbox/push-actions.ts
//      menyimpan langganan (endpoint + kunci) ke tabel push_subscriptions.
//   2. Setiap kali notifikasi in-app dibuat (lib/assignment-notify.ts,
//      app/dashboard/inbox/actions.ts, app/checkin/[token]/actions.ts),
//      helper `insertNotificationsWithPush()` di file ini menyisipkan baris
//      notifikasi LALU menjadwalkan push ke perangkat tiap penerima.
//   3. Pengiriman betulan dilakukan oleh `sendPush()` lewat package web-push.
//
// Semua best-effort: tanpa kunci VAPID, tanpa langganan, atau kegagalan
// jaringan TIDAK boleh menggagalkan alur pemanggil (insert notifikasi dulu
// sudah tersimpan sebelum push dijadwalkan).
//
// Bukan Server Action — dipanggil dari dalam file yang sudah "use server".

import { after } from "next/server";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  /** Path relatif di aplikasi yang dibuka saat notifikasi ditap. */
  url?: string | null;
  /** notifications.type — dipakai untuk menghormati tipe yang di-mute. */
  type?: string;
  /** Menimpa notifikasi lain dengan tag sama di perangkat (bukan menumpuk). */
  tag?: string;
};

export type NotifyRow = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

let vapidReady: boolean | null = null;

/**
 * Siapkan kunci VAPID sekali saja. Return false kalau env belum diisi, supaya
 * seluruh fitur push diam-diam nonaktif (sama polanya dengan lib/email.ts).
 */
function configureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:no-reply@rachel-k3.app",
    publicKey,
    privateKey,
  );
  vapidReady = true;
  return true;
}

/** True kalau kunci VAPID sudah ada — dipakai untuk tes/telemetri. */
export function isPushConfigured(): boolean {
  return configureVapid();
}

/**
 * Sisipkan notifikasi in-app lalu jadwalkan push ke perangkat penerimanya.
 *
 * Semua helper notifikasi bermuara ke sini supaya push otomatis ikut tanpa
 * perlu diulang di tiap call site. Push dijalankan lewat next/server `after`
 * sehingga tidak memperlambat respons Server Action.
 */
export async function insertNotificationsWithPush(
  supabase: SupabaseClient,
  rows: NotifyRow[],
) {
  if (rows.length === 0) return;

  const deduped = rows.filter((row) => row.user_id);
  if (deduped.length === 0) return;

  await supabase.from("notifications").insert(deduped);

  const first = deduped[0];
  schedulePush(
    deduped.map((row) => row.user_id),
    {
      title: first.title,
      body: first.message,
      url: first.link ?? null,
      type: first.type,
      tag: first.type,
    },
  );
}

/**
 * Jadwalkan pengiriman SETELAH respons Server Action dikirim. Best-effort:
 * kalau dipanggil di luar request scope (mis. saat build), cukup dilewati.
 */
export function schedulePush(userIds: string[], payload: PushPayload) {
  if (!configureVapid()) return;

  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    after(() => sendPush(ids, payload));
  } catch {
    // Tidak ada request context (mis. dipanggil saat prerender) — lewati.
  }
}

/** Kirim ke semua perangkat milik userIds; hapus langganan yang sudah mati. */
export async function sendPush(userIds: string[], payload: PushPayload) {
  if (!configureVapid() || userIds.length === 0) return;

  try {
    const admin = createAdminClient();

    const targets = await withoutMutedUsers(admin, userIds, payload.type);
    if (targets.length === 0) return;

    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", targets);
    if (!subscriptions || subscriptions.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || payload.type || "rachel-k3",
    });

    const staleEndpoints: string[] = [];
    await Promise.all(
      subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // 404/410 = langganan sudah tidak valid (app di-uninstall, izin
          // dicabut). Buang supaya tidak dicoba lagi tiap kali.
          if (status === 404 || status === 410) staleEndpoints.push(sub.endpoint);
        }
      }),
    );

    if (staleEndpoints.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }
  } catch (err) {
    console.warn("[push] gagal mengirim:", err);
  }
}

/**
 * Buang penerima yang mematikan tipe notifikasi ini di notification_preferences
 * (kolom muted_types). Kalau preferensi tidak terbaca, jangan blokir apa pun.
 */
async function withoutMutedUsers(
  admin: { from: (table: string) => any },
  userIds: string[],
  type?: string,
): Promise<string[]> {
  if (!type) return userIds;

  try {
    const { data } = await admin
      .from("notification_preferences")
      .select("user_id, muted_types")
      .in("user_id", userIds);

    const muted = new Set(
      (data || [])
        .filter(
          (row: { muted_types?: string[] }) =>
            Array.isArray(row.muted_types) && row.muted_types.includes(type),
        )
        .map((row: { user_id: string }) => row.user_id),
    );

    return muted.size === 0 ? userIds : userIds.filter((id) => !muted.has(id));
  } catch {
    return userIds;
  }
}

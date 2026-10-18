"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Server Action untuk mengelola langganan Web Push milik perangkat yang
// sedang dipakai (lihat supabase/schema_push_subscriptions.sql + lib/push.ts).
//
// Ditulis lewat service role, bukan client ber-RLS, karena satu `endpoint`
// bisa dipakai ulang oleh akun lain di perangkat/browser yang sama: aktivasi
// harus boleh memindahkan kepemilikan baris endpoint tersebut. Identitas tetap
// diverifikasi dari sesi (auth.getUser()) lebih dulu.

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(
  subscription: PushSubscriptionInput,
  userAgent?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak ditemukan." };

  const { endpoint, keys } = subscription ?? ({} as PushSubscriptionInput);
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { error: "Data langganan tidak lengkap." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.warn("[push] gagal menyimpan langganan:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * True kalau endpoint ini tercatat milik pengguna yang sedang login.
 *
 * Dipakai push-toggle.tsx untuk menentukan status "Aktif" — subscription
 * browser (pushManager.getSubscription()) itu level PERANGKAT, bukan level
 * akun, jadi di device yang sama dipakai gantian beberapa akun, subscription
 * lama tetap "ada" di mata browser walau pemiliknya di tabel sudah akun
 * lain. RLS ("Users can read own push subscriptions") sudah membatasi baris
 * yang terbaca ke milik auth.uid() sendiri, jadi query ini otomatis kosong
 * kalau endpoint itu tercatat milik akun lain.
 */
export async function isMyPushSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !endpoint) return false;

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  return !!data;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !endpoint) return;

  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
}

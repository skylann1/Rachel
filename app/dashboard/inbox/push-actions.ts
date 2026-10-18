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

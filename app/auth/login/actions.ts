"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { logFailedLogin, logRejectedLogin, logSuccessfulLogin } from "@/lib/login-audit";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    await logFailedLogin(data.email, error.message);
    redirect("/auth/login?error=" + error.message);
  }

  // Cek Role di tabel profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', authData.user.id)
    .single();

  if (profile?.type !== 'pgn' && profile?.type !== 'pgsol') {
    // PGN dan PGSOL sekarang berbagi realm /dashboard yang sama, dibedakan
    // lewat roles.permissions — bukan lagi lewat portal/login terpisah
    // (docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md).
    // Vendor tetap ditolak di sini (punya /vendor/login sendiri).
    await logRejectedLogin(authData.user.id, data.email, 'Akun bukan PGN/PGSOL');
    await supabase.auth.signOut();
    const debugMsg = `Data profil: ${JSON.stringify(profile) || 'Kosong'}. Error: ${profileError?.message || 'Tidak ada error DB'}`;
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }

  await logSuccessfulLogin(supabase, authData.user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  // Ambil user SEBELUM signOut — setelahnya sesi sudah tidak ada.
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity(supabase, { actorId: user?.id ?? null, action: 'Logout', entityType: 'auth' });
  await supabase.auth.signOut();
  redirect("/auth/login");
}

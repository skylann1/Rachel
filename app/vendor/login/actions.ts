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
    redirect("/vendor/login?error=" + error.message);
  }

  // Cek Role di tabel profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', authData.user.id)
    .single();

  if (profile?.type !== 'vendor') {
    // Kalau bukan vendor, sign out paksa dan tolak
    await logRejectedLogin(authData.user.id, data.email, 'Akun bukan Vendor');
    await supabase.auth.signOut();
    redirect("/vendor/login?error=Akses ditolak. Akun ini bukan akun Vendor.");
  }

  await logSuccessfulLogin(supabase, authData.user.id);

  revalidatePath("/", "layout");
  redirect("/vendor/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity(supabase, { actorId: user?.id ?? null, action: 'Logout', entityType: 'auth' });
  await supabase.auth.signOut();
  redirect("/vendor/login");
}

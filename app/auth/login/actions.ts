"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/auth/login?error=" + error.message);
  }

  // Cek Role di tabel profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  const internalRoles = ['admin', 'pm', 'hse', 'pengawas'];
  if (!internalRoles.includes(profile?.role)) {
    // Kalau bukan internal, sign out paksa dan tolak
    await supabase.auth.signOut();
    redirect("/auth/login?error=Akses ditolak. Akun ini tidak memiliki akses Internal PGN.");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

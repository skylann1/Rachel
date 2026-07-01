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
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', authData.user.id)
    .single();

  if (profile?.type !== 'internal') {
    // Kalau bukan internal, sign out paksa dan tolak
    await supabase.auth.signOut();
    const debugMsg = `Data profil: ${JSON.stringify(profile) || 'Kosong'}. Error: ${profileError?.message || 'Tidak ada error DB'}`;
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

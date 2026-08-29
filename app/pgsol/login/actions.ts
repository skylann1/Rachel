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
    redirect("/pgsol/login?error=" + error.message);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', authData.user.id)
    .single();

  if (profile?.type !== 'pgsol') {
    await supabase.auth.signOut();
    redirect("/pgsol/login?error=Akses ditolak. Akun ini bukan akun PGSOL.");
  }

  revalidatePath("/", "layout");
  redirect("/pgsol/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/pgsol/login");
}

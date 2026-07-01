"use server";

import { createClient } from "@/utils/supabase/server";

export async function getJsaList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jsa')
    .select(`
      id,
      status,
      created_at,
      projects (
        name,
        vendor_id,
        vendor_profiles (
          company_name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function getJsaDetails(jsaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jsa_steps')
    .select('*')
    .eq('jsa_id', jsaId)
    .order('step_number', { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function updateJsaStatus(jsaId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('jsa')
    .update({ status })
    .eq('id', jsaId);

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

"use server";

import { createClient } from "@/utils/supabase/server";

export async function getInternalIncidents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      id,
      type,
      incident_date,
      location,
      status,
      projects (
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

"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function getIncidentDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      projects (
        name,
        vendor_profiles (
          company_name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateIncidentInvestigation(id: string, payload: {
  rca_root_cause: string;
  rca_corrective: string;
  rca_preventive: string;
  status: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Unauthorized");
  
  const { error } = await supabase
    .from('incidents')
    .update({
      ...payload,
      investigated_by: user.id
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/incident/${id}`);
  revalidatePath(`/dashboard/incident`);
}

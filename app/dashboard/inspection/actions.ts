"use server";

import { createClient } from "@/utils/supabase/server";

export async function getInspections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select(`
      id,
      title,
      finding_type,
      location,
      priority,
      status,
      image_url,
      created_at,
      vendor_profiles:target_vendor (
        company_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function createInspection(formData: FormData) {
  const supabase = await createClient();
  
  const target_vendor = formData.get("target_vendor") as string;
  const project_id = formData.get("project_id") as string;
  const finding_type = formData.get("finding_type") as string;
  const priority = formData.get("priority") as string;
  const location = formData.get("location") as string;
  const title = formData.get("title") as string;
  
  // Here we would typically upload the image first using uploadImage utility,
  // but since we are receiving a FormData, we should ideally handle the File object here.
  // For the sake of this migration, we'll assume the URL is either mock or handled in client 
  // before submitting, or we do the upload logic. Let's assume we pass image_url if uploaded client-side.
  const image_url = formData.get("image_url") as string;
  
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('inspections')
    .insert({
      project_id: project_id || null, // project_id might be nullable if not selected
      reported_by: user?.id,
      target_vendor: target_vendor || null,
      title,
      finding_type,
      priority,
      location,
      status: 'Open',
      image_url
    });
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

export async function getVendorsAndProjects() {
  const supabase = await createClient();
  
  const { data: vendors } = await supabase.from('vendor_profiles').select('id, company_name');
  const { data: projects } = await supabase.from('projects').select('id, name, vendor_id');
  
  return { vendors: vendors || [], projects: projects || [] };
}

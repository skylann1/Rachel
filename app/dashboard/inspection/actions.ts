"use server";

import { createClient } from "@/utils/supabase/server";
import { createNotification } from "@/app/dashboard/inbox/actions";

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
      is_project_activity,
      vendor_profiles:target_vendor (
        company_name
      ),
      assigned_to,
      internal_profiles:assigned_to (
        profiles:id ( full_name )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("getInspections error:", error.message);
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
  const is_project_activity = formData.get("is_project_activity") !== 'false';
  const assigned_to = formData.get("assigned_to") as string;
  
  const image_url = formData.get("image_url") as string;
  
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      project_id: project_id || null,
      reported_by: user?.id,
      target_vendor: target_vendor || null,
      title,
      finding_type,
      priority,
      location,
      status: 'Open',
      image_url,
      is_project_activity,
      assigned_to: assigned_to || user?.id // Default to reporter if not explicitly assigned
    })
    .select()
    .single();
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  // Create initial log
  if (data) {
    await supabase.from('inspection_logs').insert({
      inspection_id: data.id,
      actor_id: user?.id,
      action: 'Laporan Temuan Baru Dibuat & Ditugaskan',
      notes: `Prioritas: ${priority}, Lokasi: ${location}`
    });

    if (target_vendor) {
      await createNotification({
        userId: target_vendor,
        type: 'warning',
        title: `Temuan K3 Baru: ${finding_type}`,
        message: `Temuan baru "${title}" dilaporkan di lokasi "${location}" dengan prioritas ${priority}.`,
        link: `/vendor/dashboard/inspection`,
      });
    }

    if (assigned_to && assigned_to !== user?.id) {
      await createNotification({
        userId: assigned_to,
        type: 'action_required',
        title: 'Tugas Inspeksi Baru',
        message: `Anda ditugaskan untuk menindaklanjuti temuan "${title}" di lokasi "${location}".`,
        link: `/dashboard/inspection`,
      });
    }
  }
}

export async function getVendorsAndProjects() {
  const supabase = await createClient();
  
  const { data: vendors } = await supabase.from('vendor_profiles').select('id, company_name');
  const { data: projects } = await supabase.from('projects').select('id, name, vendor_id');
  const { data: internalUsers } = await supabase.from('internal_profiles').select('id, profiles(full_name)');
  
  return { 
    vendors: vendors || [], 
    projects: projects || [],
    internalUsers: internalUsers || []
  };
}

export async function delegateInspection(inspectionId: string, assigneeId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('inspections')
    .update({ assigned_to: assigneeId })
    .eq('id', inspectionId);

  if (error) throw new Error(error.message);

  await supabase.from('inspection_logs').insert({
    inspection_id: inspectionId,
    actor_id: user?.id,
    action: 'Disposisi / Pendelegasian',
    notes: notes || 'Tugas dilimpahkan ke inspektur lain.'
  });

  await createNotification({
    userId: assigneeId,
    type: 'action_required',
    title: 'Tugas Inspeksi Dilimpahkan',
    message: notes || 'Sebuah tugas inspeksi telah dilimpahkan kepada Anda.',
    link: `/dashboard/inspection`,
  });
}

export async function getInspectionLogs(inspectionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspection_logs')
    .select(`
      id,
      action,
      notes,
      created_at,
      profiles (
        full_name,
        role
      )
    `)
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("getInspectionLogs error:", error.message);
    return [];
  }

  return data || [];
}

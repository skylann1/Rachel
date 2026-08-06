"use server";

import { createClient } from "@/utils/supabase/server";
import { createNotification, notifyUsersByRole } from "@/app/dashboard/inbox/actions";

export async function getVendorInspections() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

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
      vendor_response,
      vendor_evidence_url,
      created_at
    `)
    .eq('target_vendor', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function submitVendorResponse(inspectionId: string, formData: FormData) {
  const supabase = await createClient();
  
  const vendor_response = formData.get("vendor_response") as string;
  const vendor_evidence_url = formData.get("vendor_evidence_url") as string;

  const { error } = await supabase
    .from('inspections')
    .update({
      vendor_response,
      vendor_evidence_url,
      status: 'In Progress' // change status to In Progress (or Closed if auto)
    })
    .eq('id', inspectionId);

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('title, location, assigned_to')
    .eq('id', inspectionId)
    .single();

  if (inspection?.assigned_to) {
    await createNotification({
      userId: inspection.assigned_to,
      type: 'action_required',
      title: 'Bukti Perbaikan Diterima — Perlu Validasi',
      message: `Vendor telah mengirimkan bukti perbaikan untuk temuan "${inspection.title}" di lokasi "${inspection.location}". Mohon validasi penutupan.`,
      link: `/dashboard/inspection`,
    });
  } else {
    await notifyUsersByRole({
      role: 'hse',
      type: 'action_required',
      title: 'Bukti Perbaikan Diterima — Perlu Validasi',
      message: `Vendor telah mengirimkan bukti perbaikan untuk temuan "${inspection?.title}" di lokasi "${inspection?.location}". Mohon validasi penutupan.`,
      link: `/dashboard/inspection`,
    });
  }
}

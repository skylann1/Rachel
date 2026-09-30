"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";
import { createNotification, notifyUsersByRole } from "@/app/dashboard/inbox/actions";

export async function getVendorInspections() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // inspections.target_vendor menunjuk vendor_profiles(id), yang sejak
  // schema_org_backfill_vendor.sql berisi id ORGANISASI vendor.
  const vendorOrgId = await getCallerVendorOrgId(supabase);
  if (!vendorOrgId) return [];

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
      created_at,
      inspection_photos ( id, image_url )
    `)
    .eq('target_vendor', vendorOrgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function submitVendorResponse(inspectionId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const vendorOrgId = await getCallerVendorOrgId(supabase);
  if (!vendorOrgId) throw new Error('Organisasi vendor Anda tidak ditemukan.');

  const vendor_response = formData.get("vendor_response") as string;
  const vendor_evidence_url = formData.get("vendor_evidence_url") as string;

  // target_vendor dicocokkan dengan ORGANISASI pemanggil (bukan id user-nya —
  // kolom ini menunjuk vendor_profiles(id) = organizations(id)): tanpa ini
  // vendor mana pun bisa menutup/menimpa temuan milik company lain hanya
  // dengan menebak id-nya, sementara staff lain di company yang sama tetap
  // boleh menindaklanjuti temuan company-nya sendiri.
  // .select() dipakai supaya update yang tidak mengenai baris ikut ketahuan.
  const { data: updated, error } = await supabase
    .from('inspections')
    .update({
      vendor_response,
      vendor_evidence_url,
      status: 'In Progress' // change status to In Progress (or Closed if auto)
    })
    .eq('id', inspectionId)
    .eq('target_vendor', vendorOrgId)
    .select('id');

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
  if (!updated || updated.length === 0) {
    throw new Error('Temuan tidak ditemukan atau bukan ditujukan untuk Anda.');
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

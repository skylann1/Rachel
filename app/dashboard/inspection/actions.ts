"use server";

import { createClient } from "@/utils/supabase/server";
import { createNotification, notifyOrgMembers } from "@/app/dashboard/inbox/actions";
import { hasPermissionForUser } from "@/utils/permissions";

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
      reported_by,
      target_vendor,
      vendor_response,
      vendor_evidence_url,
      vendor_profiles:target_vendor (
        company_name
      ),
      assigned_to,
      internal_profiles:assigned_to (
        profiles:id ( full_name )
      ),
      inspection_photos ( id, image_url )
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
  
  // Multi-foto: satu laporan bisa punya banyak foto (inspection_photos),
  // foto pertama tetap diduplikasi ke inspections.image_url supaya kode
  // lama yang baca item.image_url sebagai thumbnail tidak perlu berubah.
  const imageUrls = (formData.getAll("image_urls") as string[]).filter(Boolean);
  const image_url = imageUrls[0] || null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'create'))) {
    throw new Error("Anda tidak memiliki izin untuk membuat laporan inspeksi.");
  }

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
    if (imageUrls.length > 0) {
      const { error: photoError } = await supabase.from('inspection_photos').insert(
        imageUrls.map((url) => ({ inspection_id: data.id, image_url: url }))
      );
      if (photoError) {
        console.error('inspection_photos insert error:', photoError.message);
      }
    }

    await supabase.from('inspection_logs').insert({
      inspection_id: data.id,
      actor_id: user?.id,
      action: 'Laporan Temuan Baru Dibuat & Ditugaskan',
      notes: `Prioritas: ${priority}, Lokasi: ${location}`
    });

    if (target_vendor) {
      // target_vendor adalah id ORGANISASI vendor (FK ke vendor_profiles(id)),
      // bukan id user — notifikasi dikirim ke seluruh staff company itu.
      await notifyOrgMembers({
        orgId: target_vendor,
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
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'manage'))) {
    throw new Error("Anda tidak memiliki izin untuk mendisposisikan inspeksi.");
  }

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

/**
 * Jalur penutupan buat temuan TANPA target_vendor (non-proyek/internal) —
 * temuan ini tidak pernah bisa sampai ke status 'In Progress' karena
 * cuma submitVendorResponse (vendor-only) yang mengubah status ke situ,
 * jadi tanpa jalur ini temuan semacam ini macet di 'Open' selamanya.
 * Petugas internal menutup langsung dengan catatannya sendiri, tanpa
 * tahap bukti-perbaikan-vendor.
 */
export async function closeInspectionDirectly(inspectionId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'manage'))) {
    throw new Error("Anda tidak memiliki izin untuk menutup temuan.");
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('title, location, target_vendor')
    .eq('id', inspectionId)
    .single();

  if (!inspection) throw new Error('Temuan tidak ditemukan.');
  if (inspection.target_vendor) {
    throw new Error('Temuan ini ditujukan ke vendor — tutup lewat Validasi Perbaikan setelah vendor mengirim bukti.');
  }

  // Guard status: sama seperti validateInspection, mencegah dua petugas
  // yang membuka temuan 'Open' yang sama bersamaan saling menimpa.
  const { data: updated, error } = await supabase
    .from('inspections')
    .update({ status: 'Closed' })
    .eq('id', inspectionId)
    .eq('status', 'Open')
    .select('id');

  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error('Temuan ini sudah tidak berstatus Open — mungkin sudah diproses. Muat ulang halaman.');
  }

  await supabase.from('inspection_logs').insert({
    inspection_id: inspectionId,
    actor_id: user.id,
    action: 'Ditutup Langsung (Tanpa Vendor)',
    notes: notes || `Temuan non-proyek/internal di lokasi "${inspection.location}" ditutup langsung oleh petugas.`
  });
}

export async function validateInspection(inspectionId: string, approved: boolean, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'manage'))) {
    throw new Error("Anda tidak memiliki izin untuk memvalidasi perbaikan temuan.");
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('title, location, reported_by, target_vendor')
    .eq('id', inspectionId)
    .single();

  // Guard status: hanya temuan yang masih 'In Progress' yang boleh divalidasi.
  // Tanpa ini, dua reviewer yang membuka modal validasi bersamaan bisa saling
  // menimpa — reviewer kedua yang telat submit akan membalik status temuan
  // yang baru saja ditutup reviewer pertama kembali ke 'Open' tanpa sadar.
  // .select() dipakai supaya update yang tidak mengenai baris (race / sudah
  // diproses orang lain) ikut ketahuan, pola sama dengan submitVendorResponse.
  const { data: updated, error } = await supabase
    .from('inspections')
    .update({ status: approved ? 'Closed' : 'Open' })
    .eq('id', inspectionId)
    .eq('status', 'In Progress')
    .select('id');

  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error('Temuan ini sudah tidak dalam status menunggu validasi — mungkin sudah diproses reviewer lain. Muat ulang halaman.');
  }

  await supabase.from('inspection_logs').insert({
    inspection_id: inspectionId,
    actor_id: user?.id,
    action: approved ? 'Perbaikan Divalidasi / Temuan Ditutup' : 'Perbaikan Ditolak / Dikembalikan',
    notes: notes || (approved ? 'Bukti perbaikan sesuai dan disetujui.' : 'Bukti perbaikan belum sesuai, perlu diperbaiki ulang.')
  });

  // target_vendor adalah id ORGANISASI vendor, sedangkan reported_by adalah
  // id user — keduanya UUID tapi menunjuk tabel berbeda, jadi tidak boleh
  // dilebur ke satu variabel "userId" seperti sebelumnya.
  const notifyPayload = {
    type: (approved ? 'approval' : 'warning') as 'approval' | 'warning',
    title: approved ? 'Temuan K3 Ditutup' : 'Perbaikan Ditolak — Perlu Ditindaklanjuti Ulang',
    message: approved
      ? `Perbaikan untuk temuan "${inspection?.title}" di lokasi "${inspection?.location}" telah divalidasi dan ditutup.`
      : `Bukti perbaikan untuk temuan "${inspection?.title}" di lokasi "${inspection?.location}" ditolak. ${notes ? `Catatan: ${notes}` : 'Mohon lengkapi ulang perbaikan.'}`,
    link: `/vendor/dashboard/inspection`,
  };

  if (inspection?.target_vendor) {
    await notifyOrgMembers({ orgId: inspection.target_vendor, ...notifyPayload });
  } else if (inspection?.reported_by) {
    await createNotification({ userId: inspection.reported_by, ...notifyPayload });
  }
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

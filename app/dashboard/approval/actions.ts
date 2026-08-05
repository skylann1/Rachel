"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification, notifyUsersByRole } from "@/app/dashboard/inbox/actions";

// =====================================================================
// FETCH FUNCTIONS
// =====================================================================

export async function getAllProjectsWithRelations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, status, created_at,
      vendor_profiles ( company_name ),
      procedures ( id, status ),
      jsa ( id, status ),
      ptw ( id, status, ptw_number )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error("GET PROJECTS ERROR:", error); return []; }

  // 3. PTW Expiry Tracking Logic
  // Check if any active PTW has passed its project's end date
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Compare date only
  let hasUpdates = false;

  const processedData = data?.map(project => {
    const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
    if (ptw && ptw.status === 'PTW Aktif' && project.end_date) {
      const endDate = new Date(project.end_date);
      if (endDate < now) {
        // Mark as expired in memory for immediate UI update
        ptw.status = 'Expired';
        hasUpdates = true;
        // Fire-and-forget DB update
        supabase.from('ptw').update({ status: 'Expired' }).eq('id', ptw.id).then();
      }
    }
    return project;
  });

  return processedData || [];
}

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();
  return data;
}

export async function getPendingProcedures() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select(`
      id, status, created_at, content, project_id,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .in('status', ['Draft', 'Menunggu Review PM'])
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getProcedureById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select(`
      id, status, created_at, content, project_id,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .eq('id', id)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

export async function getPendingJsa() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jsa')
    .select(`
      id, status, created_at, rejection_note, project_id,
      pm_id, pm_approved_at,
      asset_manager_id, asset_manager_approved_at,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getJsaSteps(jsaId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jsa_steps')
    .select('*')
    .eq('jsa_id', jsaId)
    .order('step_number', { ascending: true });
  return data || [];
}

export async function getPendingPtw() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ptw')
    .select(`
      id, status, created_at, rejection_note, ptw_number, project_id,
      workers, equipment,
      authority_id, authority_approved_at,
      issuer_id, issuer_approved_at,
      hsse_id,
      projects ( name, location, vendor_profiles ( company_name ) )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

// =====================================================================
// UPDATE FUNCTIONS
// =====================================================================

export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const { error } = await supabase
    .from('procedures')
    .update({ status: 'Prosedur Disetujui', reviewed_by: profile?.id })
    .eq('id', procedureId);
  if (error) throw new Error(error.message);

  // Notify: Get vendor (project owner) about approval
  const { data: proc } = await supabase.from('procedures').select('project_id, projects ( name, vendor_id )').eq('id', procedureId).single();
  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'approval',
      title: `Prosedur Kerja Disetujui`,
      message: `Prosedur Kerja untuk proyek "${proj.name}" telah disetujui. Silakan lanjutkan pengajuan JSA.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function rejectProcedure(procedureId: string, note: string) {
  const supabase = await createClient();

  // Fetch current procedure to update its content JSON
  const { data: proc } = await supabase.from('procedures').select('content, project_id, projects ( name, vendor_id )').eq('id', procedureId).single();
  
  let updatedContent = proc?.content || {};
  let revisions = updatedContent.revisions || [];
  
  revisions.push({
    revNo: revisions.length + 1,
    date: new Date().toLocaleDateString('id-ID'),
    note: note
  });
  
  updatedContent.revisions = revisions;

  const { error } = await supabase
    .from('procedures')
    .update({ 
      status: 'Draft',
      content: updatedContent 
    })
    .eq('id', procedureId);

  if (error) throw new Error(error.message);

  // Notify vendor about rejection
  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `Prosedur Kerja Ditolak — Revisi Diperlukan`,
      message: `Prosedur untuk proyek "${proj.name}" ditolak. Catatan: "${note}". Silakan perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function approveJsa(jsaId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let updatePayload: any = {};
  let nextStatus = '';

  if (role === 'pm') {
    updatePayload = { pm_id: user.id, pm_approved_at: new Date().toISOString(), status: 'Review Asset Manager' };
    nextStatus = 'Review Asset Manager';
  } else if (role === 'asset_manager') {
    updatePayload = { asset_manager_id: user.id, asset_manager_approved_at: new Date().toISOString(), status: 'JSA Disetujui' };
    nextStatus = 'JSA Disetujui';
  } else {
    throw new Error("Role tidak berwenang untuk menyetujui JSA.");
  }

  const { error } = await supabase.from('jsa').update(updatePayload).eq('id', jsaId);
  if (error) throw new Error(error.message);

  // Notify vendor about JSA approval
  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === 'JSA Disetujui' ? 'approval' : 'info',
      title: nextStatus === 'JSA Disetujui' ? `JSA Disetujui — Lanjut ke PTW` : `JSA: Tahap ${nextStatus}`,
      message: `JSA untuk proyek "${proj.name}" telah ${nextStatus === 'JSA Disetujui' ? 'disetujui sepenuhnya' : 'memasuki tahap ' + nextStatus}.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function rejectJsa(jsaId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('jsa')
    .update({ status: 'Pembahasan JSA', rejection_note: note, pm_id: null, pm_approved_at: null, asset_manager_id: null, asset_manager_approved_at: null })
    .eq('id', jsaId);
  if (error) throw new Error(error.message);

  // Notify vendor
  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `JSA Ditolak — Perlu Perbaikan`,
      message: `JSA untuk proyek "${proj.name}" ditolak. Catatan: "${note}". Harap perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function approvePtw(ptwId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let updatePayload: any = {};

  if (role === 'ptw_authority') {
    updatePayload = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: 'Review PTW Issuer' };
  } else if (role === 'ptw_issuer') {
    updatePayload = { issuer_id: user.id, issuer_approved_at: new Date().toISOString(), status: 'Menunggu Penomoran HSSE' };
  } else if (role === 'hse') {
    // Generate PTW number: PTW-YYYY-XXX
    const year = new Date().getFullYear();
    const { count } = await supabase.from('ptw').select('*', { count: 'exact', head: true }).like('ptw_number', `PTW-${year}-%`);
    const nextNum = String((count || 0) + 1).padStart(3, '0');
    updatePayload = { hsse_id: user.id, ptw_number: `PTW-${year}-${nextNum}`, status: 'PTW Aktif' };
  } else {
    throw new Error("Role tidak berwenang untuk menyetujui PTW.");
  }

  const { error } = await supabase.from('ptw').update(updatePayload).eq('id', ptwId);
  if (error) throw new Error(error.message);

  // Notify vendor about PTW status
  const { data: ptw } = await supabase.from('ptw').select('project_id, status, ptw_number, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;
  if (proj?.vendor_id) {
    const isPtwActive = ptw?.status === 'PTW Aktif';
    await createNotification({
      userId: proj.vendor_id,
      type: isPtwActive ? 'approval' : 'info',
      title: isPtwActive ? `PTW Diterbitkan: ${ptw?.ptw_number}` : `PTW: Tahap ${ptw?.status}`,
      message: isPtwActive 
        ? `Selamat! PTW ${ptw?.ptw_number} untuk proyek "${proj.name}" telah aktif. Pekerjaan bisa dimulai.` 
        : `PTW untuk proyek "${proj.name}" telah memasuki tahap ${ptw?.status}.`,
      link: `/vendor/dashboard/projects/${ptw?.project_id}`,
    });
  }

  // If PTW is now active, also notify internal HSE team
  if (updatePayload.status === 'PTW Aktif') {
    
    // Auto-assign PM (from JSA) as default inspector for the project
    const { data: jsaData } = await supabase.from('jsa').select('pm_id').eq('project_id', ptw?.project_id).single();
    if (jsaData?.pm_id) {
       await supabase.from('projects').update({ assigned_inspector: jsaData.pm_id }).eq('id', ptw?.project_id);
       
       // Also notify the PM that they have a new monitoring task
       await createNotification({
         userId: jsaData.pm_id,
         type: 'info',
         title: 'Tugas Pengawasan Baru',
         message: `PTW ${updatePayload.ptw_number} telah diterbitkan. Anda ditugaskan sebagai pengawas utama.`,
         link: '/dashboard/my-task'
       });
    }

    await notifyUsersByRole({
      role: 'hse',
      type: 'info',
      title: `PTW Aktif: ${updatePayload.ptw_number}`,
      message: `PTW ${updatePayload.ptw_number} untuk proyek "${proj?.name}" telah diterbitkan dan aktif.`,
      link: `/dashboard/ongoing`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function rejectPtw(ptwId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ptw')
    .update({ status: 'Draft', rejection_note: note, authority_id: null, authority_approved_at: null, issuer_id: null, issuer_approved_at: null })
    .eq('id', ptwId);
  if (error) throw new Error(error.message);

  // Notify vendor
  const { data: ptw } = await supabase.from('ptw').select('project_id, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `PTW Ditolak — Perlu Perbaikan`,
      message: `PTW untuk proyek "${proj.name}" ditolak. Catatan: "${note}". Harap perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${ptw?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

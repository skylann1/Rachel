"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification, notifyUsersByPermission } from "@/app/dashboard/inbox/actions";
import { JSA_STATUS, JSA_STAGE_PERMISSION } from "@/lib/jsa-status";
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION } from "@/lib/procedure-status";
import { PTW_STATUS, PTW_STAGE_PERMISSION } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { hasPermissionForUser } from "@/utils/permissions";

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
      ptw ( id, status, ptw_number, valid_to )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error("GET PROJECTS ERROR:", error); return []; }

  // 3. PTW Expiry Tracking Logic
  // Masa berlaku dihitung dari valid_to milik PTW itu sendiri; baris lama yang
  // belum punya valid_to jatuh kembali ke tanggal selesai proyek.
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Compare date only
  let hasUpdates = false;

  const processedData = data?.map(project => {
    // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — cek expiry tiap baris.
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    for (const ptw of ptws) {
      if (ptw.status !== PTW_STATUS.aktif) continue;
      const batas = ptw.valid_to ?? project.end_date;
      if (!batas) continue;
      if (new Date(batas) < now) {
        // Mark as expired in memory for immediate UI update
        ptw.status = PTW_STATUS.expired;
        hasUpdates = true;
        // Fire-and-forget DB update
        supabase.from('ptw').update({ status: PTW_STATUS.expired }).eq('id', ptw.id).then();
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
    .in('status', [PROCEDURE_STATUS.draft, PROCEDURE_STATUS.menungguReviewPM])
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
      reviewer_id, reviewed_at,
      approver_id, approved_at,
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

/** Full Prosedur/JSA/PTW history for a project, newest first — see document_logs. */
export async function getDocumentLogs(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_logs')
    .select(`
      id, doc_type, doc_id, action, notes, created_at,
      profiles ( full_name, role )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) { console.error("getDocumentLogs error:", error.message); return []; }
  return data || [];
}

// =====================================================================
// UPDATE FUNCTIONS
// =====================================================================

/**
 * Every approve/reject action below re-derives the caller's permission from
 * `profiles` + `roles.permissions` server-side and checks it against the
 * record's *current* status. Never trust a role string passed in from the
 * client — it's fully attacker-controlled since these are server actions
 * callable directly over the wire.
 *
 * Gerbang tiap tahap dibaca dari roles.permissions (lihat utils/permissions.ts
 * dan halaman Role & Permission), bukan role slug yang di-hardcode — admin
 * bisa mengganti siapa yang berhak di tiap tahap tanpa ubah kode.
 */
async function requirePermission(supabase: any, userId: string, permission: { module: string; action: string }, errorMessage: string) {
  const allowed = await hasPermissionForUser(supabase, userId, permission.module, permission.action);
  if (!allowed) {
    throw new Error(errorMessage);
  }
}

export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('procedures').select('status').eq('id', procedureId).single();
  if (current?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa disetujui.");
  await requirePermission(supabase, user.id, PROCEDURE_STAGE_PERMISSION[PROCEDURE_STATUS.menungguReviewPM], "Anda tidak memiliki izin untuk menyetujui Prosedur Kerja.");

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const { error } = await supabase
    .from('procedures')
    .update({ status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id })
    .eq('id', procedureId);
  if (error) throw new Error(error.message);

  // Notify: Get vendor (project owner) about approval
  const { data: proc } = await supabase.from('procedures').select('project_id, projects ( name, vendor_id )').eq('id', procedureId).single();
  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proc?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId: proc.project_id, actorId: user.id,
      action: 'Direview & Disetujui PM',
    });
  }
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: currentCheck } = await supabase.from('procedures').select('status').eq('id', procedureId).single();
  if (currentCheck?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa ditolak.");
  await requirePermission(supabase, user.id, PROCEDURE_STAGE_PERMISSION[PROCEDURE_STATUS.menungguReviewPM], "Anda tidak memiliki izin untuk menolak Prosedur Kerja.");

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
      status: PROCEDURE_STATUS.draft,
      content: updatedContent
    })
    .eq('id', procedureId);

  if (error) throw new Error(error.message);

  if (proc?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId: proc.project_id, actorId: user.id,
      action: 'Ditolak PM — Revisi Diperlukan', notes: note,
    });
  }

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

export async function approveJsa(jsaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase
    .from('jsa')
    .select('status, reviewer_id')
    .eq('id', jsaId)
    .single();

  let updatePayload: any = {};
  let nextStatus = '';

  if (current?.status === JSA_STATUS.reviewPgsol) {
    // Tahap 1 — verifikasi teknis oleh Satker Pemberi Kerja (PGSOL).
    await requirePermission(supabase, user.id, JSA_STAGE_PERMISSION[JSA_STATUS.reviewPgsol], "Anda tidak memiliki izin untuk mereview JSA pada tahap ini.");
    updatePayload = {
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      status: JSA_STATUS.approvalPgn,
    };
    nextStatus = JSA_STATUS.approvalPgn;
  } else if (current?.status === JSA_STATUS.approvalPgn) {
    // Tahap 2 — otorisasi formal oleh Satker Penanggung Jawab (PGN).
    await requirePermission(supabase, user.id, JSA_STAGE_PERMISSION[JSA_STATUS.approvalPgn], "Anda tidak memiliki izin untuk menyetujui JSA pada tahap ini.");
    // Pemisahan wewenang: reviewer dan approver wajib dua orang berbeda.
    if (current.reviewer_id && current.reviewer_id === user.id) {
      throw new Error("JSA harus disetujui oleh orang yang berbeda dari yang melakukan review. Silakan minta Approver PGN lain untuk menyetujui.");
    }
    updatePayload = {
      approver_id: user.id,
      approved_at: new Date().toISOString(),
      status: JSA_STATUS.approved,
    };
    nextStatus = JSA_STATUS.approved;
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa disetujui.");
  }

  const { error } = await supabase.from('jsa').update(updatePayload).eq('id', jsaId);
  if (error) throw new Error(error.message);

  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;

  if (jsa?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'jsa', docId: jsaId, projectId: jsa.project_id, actorId: user.id,
      action: nextStatus === JSA_STATUS.approved ? 'Disetujui PGN' : 'Direview PGSOL',
    });
  }

  // Setelah review PGSOL selesai, giliran PGN yang harus bertindak.
  if (nextStatus === JSA_STATUS.approvalPgn) {
    await notifyUsersByPermission({
      ...JSA_STAGE_PERMISSION[JSA_STATUS.approvalPgn],
      type: 'action_required',
      title: 'JSA Menunggu Persetujuan PGN',
      message: `JSA untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu persetujuan Anda.`,
      link: `/dashboard/projects/${jsa?.project_id}`,
    });
  }

  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === JSA_STATUS.approved ? 'approval' : 'info',
      title: nextStatus === JSA_STATUS.approved ? `JSA Disetujui — Lanjut ke PTW` : `JSA Telah Direview PGSOL`,
      message: nextStatus === JSA_STATUS.approved
        ? `JSA untuk proyek "${proj.name}" telah disetujui PGN. Anda dapat melanjutkan ke pengajuan PTW.`
        : `JSA untuk proyek "${proj.name}" telah direview PGSOL dan kini menunggu persetujuan PGN.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function rejectJsa(jsaId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('jsa').select('status').eq('id', jsaId).single();
  let penolak = '';
  if (current?.status === JSA_STATUS.reviewPgsol) {
    await requirePermission(supabase, user.id, JSA_STAGE_PERMISSION[JSA_STATUS.reviewPgsol], "Anda tidak memiliki izin untuk menolak JSA pada tahap ini.");
    penolak = 'PGSOL';
  } else if (current?.status === JSA_STATUS.approvalPgn) {
    await requirePermission(supabase, user.id, JSA_STAGE_PERMISSION[JSA_STATUS.approvalPgn], "Anda tidak memiliki izin untuk menolak JSA pada tahap ini.");
    penolak = 'PGN';
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa ditolak.");
  }

  // Kembali ke awal: vendor harus memperbaiki, lalu direview ulang dari tahap PGSOL.
  const { error } = await supabase
    .from('jsa')
    .update({
      status: JSA_STATUS.reviewPgsol,
      rejection_note: note,
      reviewer_id: null,
      reviewed_at: null,
      approver_id: null,
      approved_at: null,
    })
    .eq('id', jsaId);
  if (error) throw new Error(error.message);

  // Notify vendor
  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;
  if (jsa?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'jsa', docId: jsaId, projectId: jsa.project_id, actorId: user.id,
      action: `Ditolak ${penolak}`, notes: note,
    });
  }
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `JSA Ditolak ${penolak} — Perlu Perbaikan`,
      message: `JSA untuk proyek "${proj.name}" ditolak oleh ${penolak}. Catatan: "${note}". Harap perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}

export async function approvePtw(ptwId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('ptw').select('status').eq('id', ptwId).single();

  let updatePayload: any = {};

  if (current?.status === PTW_STATUS.menungguApprovalPM) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.menungguApprovalPM], "Anda tidak memiliki izin untuk menyetujui tahap ini.");
    updatePayload = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: PTW_STATUS.reviewPtwIssuer };
  } else if (current?.status === PTW_STATUS.reviewPtwIssuer) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.reviewPtwIssuer], "Anda tidak memiliki izin untuk menyetujui tahap ini.");
    updatePayload = { issuer_id: user.id, issuer_approved_at: new Date().toISOString(), status: PTW_STATUS.menungguPenomoranHSSE };
  } else if (current?.status === PTW_STATUS.menungguPenomoranHSSE) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.menungguPenomoranHSSE], "Anda tidak memiliki izin untuk menerbitkan nomor PTW.");
    // Generate PTW number: PTW-YYYY-XXX
    const year = new Date().getFullYear();
    const { count } = await supabase.from('ptw').select('*', { count: 'exact', head: true }).like('ptw_number', `PTW-${year}-%`);
    const nextNum = String((count || 0) + 1).padStart(3, '0');
    updatePayload = { hsse_id: user.id, ptw_number: `PTW-${year}-${nextNum}`, status: PTW_STATUS.aktif };
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa disetujui.");
  }

  const { error } = await supabase.from('ptw').update(updatePayload).eq('id', ptwId);
  if (error) throw new Error(error.message);

  // Notify vendor about PTW status
  const { data: ptw } = await supabase.from('ptw').select('project_id, status, ptw_number, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;

  if (ptw?.project_id) {
    const stageAction = updatePayload.status === PTW_STATUS.aktif
      ? `Nomor PTW Diterbitkan & Aktif (${updatePayload.ptw_number})`
      : updatePayload.status === PTW_STATUS.reviewPtwIssuer
        ? 'Disetujui PTW Authority (PM)'
        : 'Disetujui PTW Issuer';
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId: ptw.project_id, actorId: user.id,
      action: stageAction,
    });
  }

  if (proj?.vendor_id) {
    const isPtwActive = ptw?.status === PTW_STATUS.aktif;
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
  if (updatePayload.status === PTW_STATUS.aktif) {
    
    // Auto-assign the JSA's PGSOL reviewer as default inspector for the project
    const { data: jsaData } = await supabase.from('jsa').select('reviewer_id').eq('project_id', ptw?.project_id).single();
    if (jsaData?.reviewer_id) {
       await supabase.from('projects').update({ assigned_inspector: jsaData.reviewer_id }).eq('id', ptw?.project_id);

       // Also notify the reviewer that they have a new monitoring task
       await createNotification({
         userId: jsaData.reviewer_id,
         type: 'info',
         title: 'Tugas Pengawasan Baru',
         message: `PTW ${updatePayload.ptw_number} telah diterbitkan. Anda ditugaskan sebagai pengawas utama.`,
         link: '/dashboard/my-task'
       });
    }

    await notifyUsersByPermission({
      ...PTW_STAGE_PERMISSION[PTW_STATUS.menungguPenomoranHSSE],
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('ptw').select('status').eq('id', ptwId).single();
  if (current?.status === PTW_STATUS.menungguApprovalPM) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.menungguApprovalPM], "Anda tidak memiliki izin untuk menolak tahap ini.");
  } else if (current?.status === PTW_STATUS.reviewPtwIssuer) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.reviewPtwIssuer], "Anda tidak memiliki izin untuk menolak tahap ini.");
  } else if (current?.status === PTW_STATUS.menungguPenomoranHSSE) {
    await requirePermission(supabase, user.id, PTW_STAGE_PERMISSION[PTW_STATUS.menungguPenomoranHSSE], "Anda tidak memiliki izin untuk menolak tahap ini.");
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa ditolak.");
  }

  const { error } = await supabase
    .from('ptw')
    .update({ status: PTW_STATUS.draft, rejection_note: note, authority_id: null, authority_approved_at: null, issuer_id: null, issuer_approved_at: null })
    .eq('id', ptwId);
  if (error) throw new Error(error.message);

  // Notify vendor
  const { data: ptw } = await supabase.from('ptw').select('project_id, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;
  if (ptw?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId: ptw.project_id, actorId: user.id,
      action: 'Ditolak — Perlu Perbaikan', notes: note,
    });
  }
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

/**
 * Cabut Stop Work Authority yang dipicu dari halaman lapangan (/checkin/[token])
 * dan kembalikan PTW ke status Aktif. Sengaja hanya bisa dilakukan lewat
 * dashboard internal oleh pemegang izin `ptw.resume_work` — memulai kembali
 * pekerjaan yang sempat dihentikan butuh penilaian, bukan sekadar klik ulang
 * dari lapangan.
 */
export async function resumePtw(ptwId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('ptw').select('status').eq('id', ptwId).single();
  if (current?.status !== PTW_STATUS.stoppedSwa) throw new Error("PTW tidak sedang dalam status Stop Work Authority.");
  await requirePermission(supabase, user.id, { module: 'ptw', action: 'resume_work' }, "Anda tidak memiliki izin untuk mengaktifkan kembali PTW ini.");

  const { error } = await supabase
    .from('ptw')
    .update({ status: PTW_STATUS.aktif, stopped_at: null, stopped_reason: null, stopped_by_name: null })
    .eq('id', ptwId);
  if (error) throw new Error(error.message);

  const { data: ptw } = await supabase.from('ptw').select('project_id, ptw_number, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;

  if (ptw?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId: ptw.project_id, actorId: user.id,
      action: 'Stop Work Authority Dicabut — PTW Aktif Kembali',
    });
  }
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'approval',
      title: `PTW Aktif Kembali`,
      message: `Stop Work Authority untuk PTW ${ptw?.ptw_number ?? ''} pada proyek "${proj.name}" telah dicabut. Pekerjaan dapat dilanjutkan.`,
      link: `/vendor/dashboard/projects/${ptw?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
  revalidatePath(`/dashboard/projects/${ptw?.project_id}`);
}

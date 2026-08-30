"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/dashboard/inbox/actions";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { hasPermissionForUser } from "@/utils/permissions";
import { getStageAssignments, isStageFullyApproved, resetStageAssignments } from '@/lib/stage-assignments';
import { notifyAssignees } from '@/app/dashboard/inbox/actions';

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

/**
 * Setiap tahap approval harus dipegang orang berbeda. Permission kini bisa
 * diberikan bebas per role, jadi satu akun bisa saja memegang seluruh tahap
 * sebuah dokumen — tanpa penjagaan ini, izin kerja bisa lolos dari pengajuan
 * sampai terbit tanpa pernah dilihat pihak kedua.
 */
function requireDistinctApprover(previousApproverId: string | null | undefined, userId: string, stageLabel: string) {
  if (previousApproverId && previousApproverId === userId) {
    throw new Error(`Tahap ini harus diproses oleh orang yang berbeda dari ${stageLabel}. Silakan minta petugas lain untuk melanjutkan.`);
  }
}

export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (current?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa disetujui.");
  if (!current.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  const rows = await getStageAssignments(supabase, current.project_id, 'procedure', 'procedure.review');
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview Prosedur Kerja proyek ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);

  // Re-fetch fresh from the DB rather than patching the stale initial `rows`
  // snapshot locally: if two of the last two pending assignees approve at
  // nearly the same time, each request's local snapshot still shows the
  // other assignee as pending even after both DB rows are `approved`, which
  // would make both calls see isStageFullyApproved === false and leave the
  // document stuck forever. Re-fetching narrows that race window instead of
  // trusting data captured before either write landed.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'procedure', 'procedure.review');
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath('/dashboard/approval');
    return;
  }

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  // .eq('status', current.status) jadi optimistic lock terakhir (pola yang sama
  // dengan approvePtw): kalau seseorang menolak dokumen ini persis di sela-sela
  // antara pembacaan status di atas dan update ini, penolakan itu akan diam-diam
  // ditimpa oleh approve yang balapan. Dengan penjagaan ini update-nya tidak
  // mengenai baris apa pun dan pemanggil mendapat pesan jelas.
  const { data: updated, error } = await supabase
    .from('procedures')
    .update({ status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id })
    .eq('id', procedureId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Prosedur ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

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

  const { data: currentCheck } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (currentCheck?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa ditolak.");
  if (!currentCheck.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  const rows = await getStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review');
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview Prosedur Kerja proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review');

  const { data: proc } = await supabase.from('procedures').select('content, project_id, projects ( name, vendor_id )').eq('id', procedureId).single();

  let updatedContent = proc?.content || {};
  let revisions = updatedContent.revisions || [];
  revisions.push({ revNo: revisions.length + 1, date: new Date().toLocaleDateString('id-ID'), note: note });
  updatedContent.revisions = revisions;

  const { error } = await supabase
    .from('procedures')
    .update({ status: PROCEDURE_STATUS.draft, content: updatedContent })
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

  const { data: current } = await supabase.from('jsa').select('status, reviewer_id, project_id').eq('id', jsaId).single();
  if (!current?.project_id) throw new Error("JSA ini tidak terhubung ke proyek.");

  let stageKey = '';
  let nextStatus = '';

  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    nextStatus = JSA_STATUS.approvalPgn;
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    nextStatus = JSA_STATUS.approved;
    // Pemisahan wewenang: reviewer dan approver wajib dua orang berbeda,
    // terlepas dari siapa yang di-assign ke tahap ini.
    if (current.reviewer_id && current.reviewer_id === user.id) {
      throw new Error("JSA harus disetujui oleh orang yang berbeda dari yang melakukan review. Silakan minta Approver PGN lain untuk menyetujui.");
    }
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa disetujui.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap JSA ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);

  // Re-fetch (bukan patch lokal dari `rows` yang sudah basi) — dua approver
  // terakhir yang approve nyaris bersamaan sama-sama melihat snapshot awal
  // yang belum mencatat approval satu sama lain kalau ini pakai patch lokal,
  // sehingga dokumen bisa macet permanen walau di DB semua baris sudah
  // approved. Lihat ruling di ledger Task 5 untuk detail race-nya.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const stageComplete = isStageFullyApproved(freshRows);

  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;

  if (!stageComplete) {
    revalidatePath('/dashboard/approval');
    return;
  }

  const updatePayload: any = stageKey === 'jsa.review_pgsol'
    ? { reviewer_id: user.id, reviewed_at: new Date().toISOString(), status: JSA_STATUS.approvalPgn }
    : { approver_id: user.id, approved_at: new Date().toISOString(), status: JSA_STATUS.approved };

  // .eq('status', current.status) jadi optimistic lock terakhir (pola yang sama
  // dengan approvePtw): kalau assignee lain menolak JSA ini persis di sela-sela
  // antara pembacaan status di atas dan update ini, penolakan itu akan diam-diam
  // ditimpa oleh approve yang balapan — JSA melompat maju padahal sudah harus
  // kembali ke vendor.
  const { data: updated, error } = await supabase
    .from('jsa')
    .update(updatePayload)
    .eq('id', jsaId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("JSA ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  if (current.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'jsa', docId: jsaId, projectId: current.project_id, actorId: user.id,
      action: nextStatus === JSA_STATUS.approved ? 'Disetujui PGN' : 'Direview PGSOL',
    });
  }

  if (nextStatus === JSA_STATUS.approvalPgn) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'jsa', stageKey: 'jsa.approve_pgn',
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

  const { data: current } = await supabase.from('jsa').select('status, project_id').eq('id', jsaId).single();
  if (!current?.project_id) throw new Error("JSA ini tidak terhubung ke proyek.");

  let stageKey = '';
  let penolak = '';
  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    penolak = 'PGSOL';
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    penolak = 'PGN';
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa ditolak.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap JSA ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  if (stageKey === 'jsa.approve_pgn') {
    // Penolakan PGN mengembalikan dokumen sampai ke tahap review PGSOL (di
    // bawah), sehingga tahap review_pgsol akan berjalan lagi juga — reset
    // baris assignment-nya supaya konsisten dengan status dokumen yang
    // restart penuh, bukan cuma tahap approve_pgn.
    await resetStageAssignments(supabase, current.project_id, 'jsa', 'jsa.review_pgsol');
  }

  // Kembali ke awal: vendor harus memperbaiki, lalu direview ulang dari tahap PGSOL.
  const { error } = await supabase
    .from('jsa')
    .update({
      status: JSA_STATUS.reviewPgsol,
      rejection_note: note,
      reviewer_id: null, reviewed_at: null,
      approver_id: null, approved_at: null,
    })
    .eq('id', jsaId);
  if (error) throw new Error(error.message);

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

  const { data: current } = await supabase.from('ptw').select('status, authority_id, issuer_id, project_id').eq('id', ptwId).single();
  if (!current?.project_id) throw new Error("PTW ini tidak terhubung ke proyek.");

  let stageKey = '';
  let updatePayloadIfComplete: any = {};

  if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
    updatePayloadIfComplete = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: PTW_STATUS.reviewPtwIssuer };
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
    stageKey = 'ptw.review_issuer';
    requireDistinctApprover(current.authority_id, user.id, "PTW Authority (PM)");
    updatePayloadIfComplete = { issuer_id: user.id, issuer_approved_at: new Date().toISOString(), status: PTW_STATUS.menungguPenomoranHSSE };
  } else if (current.status === PTW_STATUS.menungguPenomoranHSSE) {
    stageKey = 'ptw.numbering_hsse';
    requireDistinctApprover(current.authority_id, user.id, "PTW Authority (PM)");
    requireDistinctApprover(current.issuer_id, user.id, "PTW Issuer");
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa disetujui.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap PTW ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);

  // Re-fetch (bukan patch lokal dari `rows` yang sudah basi) — lihat catatan
  // yang sama di Task 5/6: dua approver terakhir yang approve nyaris
  // bersamaan bisa sama-sama melihat snapshot awal yang belum mencatat
  // approval satu sama lain kalau ini pakai patch lokal, sehingga PTW bisa
  // macet permanen walau di DB semua baris sudah approved.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath('/dashboard/approval');
    return;
  }

  if (stageKey === 'ptw.numbering_hsse') {
    const year = new Date().getFullYear();
    const { count } = await supabase.from('ptw').select('*', { count: 'exact', head: true }).like('ptw_number', `PTW-${year}-%`);
    const nextNum = String((count || 0) + 1).padStart(3, '0');
    updatePayloadIfComplete = { hsse_id: user.id, ptw_number: `PTW-${year}-${nextNum}`, status: PTW_STATUS.aktif };
  }

  // .eq('status', current.status) tetap jadi optimistic lock terakhir:
  // kalau dua orang yang sama-sama assignee terakhir suatu tahap
  // menyelesaikan approval mereka nyaris bersamaan, hanya satu yang boleh
  // memajukan status dokumen (dan menomori PTW). Unique index pada
  // ptw_number tetap jaring pengaman lapis kedua.
  const { data: updated, error } = await supabase
    .from('ptw')
    .update(updatePayloadIfComplete)
    .eq('id', ptwId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("PTW ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  const { data: ptw } = await supabase.from('ptw').select('project_id, status, ptw_number, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;

  if (ptw?.project_id) {
    const stageAction = updatePayloadIfComplete.status === PTW_STATUS.aktif
      ? `Nomor PTW Diterbitkan & Aktif (${updatePayloadIfComplete.ptw_number})`
      : updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer
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

  if (updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.review_issuer',
      type: 'action_required', title: 'PTW Menunggu Review Issuer',
      message: `PTW untuk proyek "${proj?.name}" telah disetujui PTW Authority dan menunggu review Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.menungguPenomoranHSSE) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.numbering_hsse',
      type: 'action_required', title: 'PTW Menunggu Penomoran HSSE',
      message: `PTW untuk proyek "${proj?.name}" telah direview PTW Issuer dan menunggu penomoran Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  }

  if (updatePayloadIfComplete.status === PTW_STATUS.aktif) {
    const { data: jsaData } = await supabase.from('jsa').select('reviewer_id').eq('project_id', ptw?.project_id).single();
    if (jsaData?.reviewer_id) {
      await supabase.from('projects').update({ assigned_inspector: jsaData.reviewer_id }).eq('id', ptw?.project_id);
      await createNotification({
        userId: jsaData.reviewer_id,
        type: 'info',
        title: 'Tugas Pengawasan Baru',
        message: `PTW ${updatePayloadIfComplete.ptw_number} telah diterbitkan. Anda ditugaskan sebagai pengawas utama.`,
        link: '/dashboard/my-task'
      });
    }
  }
  revalidatePath('/dashboard/approval');
}

export async function rejectPtw(ptwId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('ptw').select('status, project_id').eq('id', ptwId).single();
  if (!current?.project_id) throw new Error("PTW ini tidak terhubung ke proyek.");

  let stageKey = '';
  if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
    stageKey = 'ptw.review_issuer';
  } else if (current.status === PTW_STATUS.menungguPenomoranHSSE) {
    stageKey = 'ptw.numbering_hsse';
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa ditolak.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap PTW ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  // Penolakan di tahap manapun mengembalikan PTW sampai ke Draft (bukan cuma
  // ke tahap sebelumnya seperti JSA), jadi ketiga tahap PTW harus direset
  // supaya semuanya `pending` lagi saat vendor mengajukan ulang — meniru alur
  // resubmission `savePtw` yang mengembalikan dokumen ke menungguApprovalPM.
  const otherStageKeys = ['ptw.approve_pm', 'ptw.review_issuer', 'ptw.numbering_hsse'].filter(k => k !== stageKey);
  for (const key of otherStageKeys) {
    await resetStageAssignments(supabase, current.project_id, 'ptw', key);
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

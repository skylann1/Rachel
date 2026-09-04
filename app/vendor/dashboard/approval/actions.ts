"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { getStageAssignments, isStageFullyApproved, resetStageAssignments } from "@/lib/stage-assignments";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";

export type VendorReviewDocType = 'procedure' | 'jsa' | 'ptw';

interface VendorReviewConfig {
  table: string;
  stageKey: string;
  externalStageKey: string;
  reviewVendorStatus: string;
  draftStatus: string;
  nextStatus: string;
  nextStatusLabel: string;
}

/**
 * Tahap review-internal-vendor bentuknya identik di ketiga tipe dokumen —
 * selalu tahap pertama, reject selalu balik ke Draft, approve-penuh selalu
 * memajukan ke tahap eksternal pertama yang sudah ada. Beda dari
 * approveProcedure/approveJsa/approvePtw di app/dashboard/approval/actions.ts
 * (yang terpisah karena tahap EKSTERNAL beda jumlah & field per tipe), tahap
 * ini cukup satu fungsi generik, table-driven lewat config di bawah.
 */
const VENDOR_REVIEW_CONFIG: Record<VendorReviewDocType, VendorReviewConfig> = {
  procedure: {
    table: 'procedures',
    stageKey: 'procedure.review_vendor',
    externalStageKey: 'procedure.review_pgsol',
    reviewVendorStatus: PROCEDURE_STATUS.reviewInternalVendor,
    draftStatus: PROCEDURE_STATUS.draft,
    nextStatus: PROCEDURE_STATUS.reviewPgsol,
    nextStatusLabel: 'Prosedur Kerja Menunggu Review PGSOL',
  },
  jsa: {
    table: 'jsa',
    stageKey: 'jsa.review_vendor',
    externalStageKey: 'jsa.review_pgsol',
    reviewVendorStatus: JSA_STATUS.reviewInternalVendor,
    draftStatus: JSA_STATUS.draft,
    nextStatus: JSA_STATUS.reviewPgsol,
    nextStatusLabel: 'JSA Menunggu Review PGSOL',
  },
  ptw: {
    table: 'ptw',
    stageKey: 'ptw.review_vendor',
    externalStageKey: 'ptw.approve_pm',
    reviewVendorStatus: PTW_STATUS.reviewInternalVendor,
    draftStatus: PTW_STATUS.draft,
    nextStatus: PTW_STATUS.menungguApprovalPM,
    nextStatusLabel: 'PTW Menunggu Persetujuan',
  },
};

/**
 * Baris stage_assignments 'pending' milik user yang login untuk tahap
 * review-internal-vendor satu dokumen — dipakai widget approve/reject di
 * halaman form vendor untuk memutuskan apakah tombol ditampilkan sama
 * sekali. Return null kalau tidak login atau tidak ditugaskan.
 */
export async function getMyVendorReviewAssignment(projectId: string, docType: VendorReviewDocType): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const config = VENDOR_REVIEW_CONFIG[docType];
  const rows = await getStageAssignments(supabase, projectId, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  return myRow ? { id: myRow.id } : null;
}

export async function approveVendorInternalReview(docType: VendorReviewDocType, docId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const config = VENDOR_REVIEW_CONFIG[docType];
  const { data: current } = await supabase.from(config.table).select('status, project_id').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  if (current.status !== config.reviewVendorStatus) throw new Error("Dokumen tidak dalam tahap Review Internal Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);

  // Re-fetch fresh dari DB, bukan patch lokal dari `rows` yang sudah basi —
  // dua reviewer terakhir yang approve nyaris bersamaan bisa sama-sama
  // melihat snapshot awal yang belum mencatat approval satu sama lain,
  // sehingga dokumen macet permanen walau di DB semua baris sudah approved.
  // Pola sama dengan approveProcedure di app/dashboard/approval/actions.ts.
  const freshRows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
    return;
  }

  // .eq('status', current.status) jadi optimistic lock: kalau reviewer lain
  // menolak dokumen ini persis di sela antara pembacaan status di atas dan
  // update ini, penolakan itu tidak diam-diam ditimpa oleh approve yang
  // balapan.
  const { data: updated, error } = await supabase
    .from(config.table)
    .update({ status: config.nextStatus })
    .eq('id', docId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Dokumen ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: 'Direview & Disetujui Internal Vendor',
  });

  const { data: project } = await supabase.from('projects').select('name').eq('id', current.project_id).single();
  await notifyAssignees({
    projectId: current.project_id,
    docType,
    stageKey: config.externalStageKey,
    type: 'action_required',
    title: config.nextStatusLabel,
    message: `Dokumen untuk proyek "${project?.name}" telah direview internal vendor dan menunggu tindakan Anda.`,
    link: `/dashboard/projects/${current.project_id}`,
  });

  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
}

export async function rejectVendorInternalReview(docType: VendorReviewDocType, docId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const config = VENDOR_REVIEW_CONFIG[docType];
  // select('*') karena kolom rejection-nya beda per tabel (procedures pakai
  // content.revisions, jsa/ptw pakai kolom rejection_note) — lihat di bawah.
  const { data: current } = await supabase.from(config.table).select('*').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  if (current.status !== config.reviewVendorStatus) throw new Error("Dokumen tidak dalam tahap Review Internal Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, docType, config.stageKey);

  const updatePayload: Record<string, any> = { status: config.draftStatus };
  if (docType === 'procedure') {
    const content = current.content || {};
    const revisions = content.revisions || [];
    revisions.push({ revNo: revisions.length + 1, date: new Date().toLocaleDateString('id-ID'), note });
    updatePayload.content = { ...content, revisions };
  } else {
    updatePayload.rejection_note = note;
  }

  const { error } = await supabase.from(config.table).update(updatePayload).eq('id', docId);
  if (error) throw new Error(error.message);

  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: 'Ditolak Review Internal Vendor — Revisi Diperlukan', notes: note,
  });

  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
}

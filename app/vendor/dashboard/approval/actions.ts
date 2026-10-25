"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { clearReviewFlag } from "@/lib/doc-sync";
import { getStageAssignments, isStageFullyApproved, resetStageAssignments } from "@/lib/stage-assignments";
import { notifyAssignees, notifyOrgMembers } from "@/app/dashboard/inbox/actions";

export type VendorReviewDocType = 'procedure' | 'jsa' | 'ptw';

interface VendorStageConfig {
  stageKey: string;
  /** Status dokumen selama tahap ini berjalan. */
  status: string;
  /** Status berikutnya kalau SEMUA assignee tahap ini approve. */
  nextStatus: string;
  /** stage_key yang assignee-nya diberi notifikasi saat tahap ini selesai. */
  nextStageKey: string;
  nextStatusLabel: string;
  /** true kalau tahap berikutnya sudah di luar vendor (PGSOL) — menentukan link notifikasi. */
  nextStageIsExternal: boolean;
}

interface VendorReviewConfig {
  table: string;
  draftStatus: string;
  /** Urut: HSE Vendor lalu PM Vendor. */
  stages: VendorStageConfig[];
}

/**
 * Review vendor = DUA tahap berurutan di ketiga tipe dokumen: HSE Vendor
 * lalu PM Vendor (stage_key `*.hse_vendor` lalu `*.review_vendor` — nama
 * lama dipertahankan untuk PM Vendor, lihat lib/jsa-status.ts). Reject di
 * tahap manapun selalu balik ke Draft; approve-penuh PM Vendor memajukan
 * ke tahap eksternal pertama (HSE PGSOL). Beda dari approveProcedure/
 * approveJsa/approvePtw di app/dashboard/approval/actions.ts (yang terpisah
 * karena tahap EKSTERNAL beda jumlah & field per tipe), tahap ini cukup
 * satu fungsi generik, table-driven lewat config di bawah.
 */
function buildVendorConfig(
  docType: VendorReviewDocType,
  table: string,
  s: { draft: string; hseVendor: string; pmVendor: string; hsePgsol: string },
  hsePgsolLabel: string,
): VendorReviewConfig {
  return {
    table,
    draftStatus: s.draft,
    stages: [
      {
        stageKey: `${docType}.hse_vendor`, status: s.hseVendor,
        nextStatus: s.pmVendor, nextStageKey: `${docType}.review_vendor`,
        nextStatusLabel: 'Dokumen Menunggu Review PM Vendor', nextStageIsExternal: false,
      },
      {
        stageKey: `${docType}.review_vendor`, status: s.pmVendor,
        nextStatus: s.hsePgsol, nextStageKey: `${docType}.hse_pgsol`,
        nextStatusLabel: hsePgsolLabel, nextStageIsExternal: true,
      },
    ],
  };
}

const VENDOR_REVIEW_CONFIG: Record<VendorReviewDocType, VendorReviewConfig> = {
  procedure: buildVendorConfig('procedure', 'procedures', {
    draft: PROCEDURE_STATUS.draft, hseVendor: PROCEDURE_STATUS.reviewHseVendor,
    pmVendor: PROCEDURE_STATUS.reviewPmVendor, hsePgsol: PROCEDURE_STATUS.reviewHsePgsol,
  }, 'Prosedur Kerja Menunggu Review HSE PGSOL'),
  jsa: buildVendorConfig('jsa', 'jsa', {
    draft: JSA_STATUS.draft, hseVendor: JSA_STATUS.reviewHseVendor,
    pmVendor: JSA_STATUS.reviewPmVendor, hsePgsol: JSA_STATUS.reviewHsePgsol,
  }, 'JSA Menunggu Review HSE PGSOL'),
  ptw: buildVendorConfig('ptw', 'ptw', {
    draft: PTW_STATUS.draft, hseVendor: PTW_STATUS.reviewHseVendor,
    pmVendor: PTW_STATUS.reviewPmVendor, hsePgsol: PTW_STATUS.reviewHsePgsol,
  }, 'PTW Menunggu Review HSE PGSOL'),
};

function stageForStatus(config: VendorReviewConfig, status: string | null | undefined) {
  return config.stages.find(st => st.status === status) ?? null;
}

/**
 * Baris stage_assignments 'pending' milik user yang login untuk tahap
 * review-vendor yang SEDANG berjalan pada satu dokumen — dipakai widget
 * approve/reject di halaman form vendor untuk memutuskan apakah tombol
 * ditampilkan sama sekali. Tahap dicari dari status dokumen (bukan hanya
 * proyek) supaya orang yang ditugaskan di PM Vendor tidak melihat tombol
 * selagi dokumen masih di HSE Vendor. Return null kalau tidak login,
 * dokumen tidak sedang di tahap vendor, atau tidak ditugaskan.
 */
export async function getMyVendorReviewAssignment(
  projectId: string, docType: VendorReviewDocType, docId?: string | null,
): Promise<{ id: string; stageKey: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !docId) return null;

  const config = VENDOR_REVIEW_CONFIG[docType];
  const { data: doc } = await supabase.from(config.table).select('status').eq('id', docId).single();
  const stage = stageForStatus(config, doc?.status);
  if (!stage) return null;

  const rows = await getStageAssignments(supabase, projectId, docType, stage.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  return myRow ? { id: myRow.id, stageKey: stage.stageKey } : null;
}

export async function approveVendorInternalReview(docType: VendorReviewDocType, docId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const config = VENDOR_REVIEW_CONFIG[docType];
  const { data: current } = await supabase.from(config.table).select('status, project_id').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  const stage = stageForStatus(config, current.status);
  if (!stage) throw new Error("Dokumen tidak dalam tahap Review Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, stage.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);
  await clearReviewFlag(docType, docId);

  // Re-fetch fresh dari DB, bukan patch lokal dari `rows` yang sudah basi —
  // dua reviewer terakhir yang approve nyaris bersamaan bisa sama-sama
  // melihat snapshot awal yang belum mencatat approval satu sama lain,
  // sehingga dokumen macet permanen walau di DB semua baris sudah approved.
  // Pola sama dengan approveProcedure di app/dashboard/approval/actions.ts.
  const freshRows = await getStageAssignments(supabase, current.project_id, docType, stage.stageKey);
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
    .update({ status: stage.nextStatus })
    .eq('id', docId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Dokumen ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: stage.stageKey.endsWith('.hse_vendor') ? 'Direview & Disetujui HSE Vendor' : 'Direview & Disetujui PM Vendor',
  });

  const { data: project } = await supabase.from('projects').select('name').eq('id', current.project_id).single();
  await notifyAssignees({
    projectId: current.project_id,
    docType,
    stageKey: stage.nextStageKey,
    type: 'action_required',
    title: stage.nextStatusLabel,
    message: stage.nextStageIsExternal
      ? `Dokumen untuk proyek "${project?.name}" telah direview internal vendor dan menunggu tindakan Anda.`
      : `Dokumen untuk proyek "${project?.name}" telah direview HSE Vendor dan menunggu review PM Vendor Anda.`,
    link: stage.nextStageIsExternal
      ? `/dashboard/projects/${current.project_id}`
      : `/vendor/dashboard/projects/${current.project_id}`,
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
  const stage = stageForStatus(config, current.status);
  if (!stage) throw new Error("Dokumen tidak dalam tahap Review Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, stage.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  // Reject mengembalikan dokumen ke Draft, jadi SEMUA tahap vendor harus
  // pending lagi (HSE Vendor yang sudah lolos ikut diulang) — kalau tidak,
  // resubmit akan langsung meloncati HSE Vendor.
  for (const st of config.stages) {
    await resetStageAssignments(supabase, current.project_id, docType, st.stageKey);
  }

  const updatePayload: Record<string, any> = { status: config.draftStatus };
  if (docType === 'procedure') {
    const content = current.content || {};
    const revisions = content.revisions || [];
    revisions.push({ revNo: revisions.length + 1, date: new Date().toLocaleDateString('id-ID'), note });
    updatePayload.content = { ...content, revisions };
  } else {
    updatePayload.rejection_note = note;
  }

  const { data: updated, error } = await supabase
    .from(config.table)
    .update(updatePayload)
    .eq('id', docId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Dokumen ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  const penolak = stage.stageKey.endsWith('.hse_vendor') ? 'HSE Vendor' : 'PM Vendor';
  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: `Ditolak ${penolak} — Revisi Diperlukan`, notes: note,
  });

  const { data: project } = await supabase.from('projects').select('name, vendor_id').eq('id', current.project_id).single();
  if (project?.vendor_id) {
    await notifyOrgMembers({
      orgId: project.vendor_id,
      type: 'warning',
      title: `Dokumen Ditolak ${penolak} — Perlu Revisi`,
      message: `Dokumen untuk proyek "${project?.name}" ditolak pada review ${penolak}. Catatan: "${note}". Silakan perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${current.project_id}`,
    });
  }

  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
}

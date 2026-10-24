"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { notifyAssignees, notifyOrgMembers } from "@/app/dashboard/inbox/actions";
import { logDocumentEvent } from "@/lib/document-logs";
import { PTW_CLOSURE_CHECKLIST } from "@/lib/ptw-status";

type Result = { success: true } | { success: false; error: string };

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/vendor/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/archive");
  revalidatePath("/vendor/dashboard/projects");
}

async function loadPtw(supabase: any, ptwId: string) {
  const { data } = await supabase
    .from("ptw")
    .select("id, project_id, ptw_number, ptw_type, projects ( id, name, vendor_id )")
    .eq("id", ptwId)
    .maybeSingle();
  if (!data) return null;
  const project = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  return { ...data, project } as any;
}

/** Vendor (pemegang) mengajukan penutupan PTW setelah pekerjaan selesai. */
export async function requestPtwClosure(params: {
  ptwId: string;
  checklist: Record<string, boolean>;
  note: string;
  finishedAt: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  // Semua item checklist wajib dicentang — divalidasi di server, bukan hanya UI.
  const missing = PTW_CLOSURE_CHECKLIST.filter(item => params.checklist?.[item.key] !== true);
  if (missing.length > 0) return { success: false, error: "Semua item checklist penutupan wajib dicentang." };

  const finished = new Date(params.finishedAt);
  if (Number.isNaN(finished.getTime())) return { success: false, error: "Waktu selesai pekerjaan tidak valid." };
  if (finished.getTime() > Date.now() + 5 * 60 * 1000) return { success: false, error: "Waktu selesai pekerjaan tidak boleh di masa depan." };

  const ptw = await loadPtw(supabase, params.ptwId);
  if (!ptw) return { success: false, error: "PTW tidak ditemukan." };

  const checklist = Object.fromEntries(PTW_CLOSURE_CHECKLIST.map(item => [item.key, true]));
  const { error } = await supabase.rpc("ptw_request_closure", {
    p_ptw_id: params.ptwId,
    p_checklist: checklist,
    p_note: params.note,
    p_finished_at: finished.toISOString(),
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: params.ptwId, projectId: ptw.project_id, actorId: user.id,
    action: "Penutupan PTW Diajukan", notes: params.note,
  });
  await notifyAssignees({
    projectId: ptw.project_id,
    docType: "ptw",
    stageKey: "ptw.numbering_hsse",
    type: "action_required",
    title: "Penutupan PTW Menunggu Verifikasi",
    message: `Vendor mengajukan penutupan PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project?.name}". Verifikasi pekerjaan telah selesai.`,
    link: `/dashboard/projects/${ptw.project_id}`,
  });

  refresh(ptw.project_id);
  return { success: true };
}

/** HSSE memverifikasi (atau menolak) penutupan PTW. */
export async function decidePtwClosure(ptwId: string, approve: boolean, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { success: false, error: "PTW tidak ditemukan." };

  const { error } = await supabase.rpc("ptw_decide_closure", {
    p_ptw_id: ptwId,
    p_approve: approve,
    p_note: note?.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: ptwId, projectId: ptw.project_id, actorId: user.id,
    action: approve ? "Penutupan PTW Disetujui — PTW Selesai" : "Penutupan PTW Ditolak",
    notes: note?.trim() || null,
  });
  if (ptw.project?.vendor_id) {
    await notifyOrgMembers({
      orgId: ptw.project.vendor_id,
      type: "approval",
      title: approve ? "PTW Ditutup" : "Penutupan PTW Ditolak",
      message: approve
        ? `PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project.name}" telah diverifikasi dan ditutup (Selesai).`
        : `Penutupan PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project.name}" ditolak: ${note?.trim()}. PTW kembali Aktif.`,
      link: `/vendor/dashboard/projects/${ptw.project_id}`,
    });
  }

  refresh(ptw.project_id);
  return { success: true };
}

/** Vendor mengajukan penyelesaian proyek setelah semua PTW ditutup. */
export async function requestProjectCompletion(projectId: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  const { error } = await supabase.rpc("project_request_completion", {
    p_project_id: projectId,
    p_note: note,
  });
  if (error) return { success: false, error: error.message };

  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
  await notifyAssignees({
    projectId,
    docType: "ptw",
    stageKey: "ptw.approve_pm",
    type: "action_required",
    title: "Penyelesaian Proyek Menunggu Verifikasi",
    message: `Vendor mengajukan penyelesaian proyek "${project?.name}". Seluruh PTW sudah ditutup.`,
    link: `/dashboard/projects/${projectId}`,
  });

  refresh(projectId);
  return { success: true };
}

/** PM memverifikasi (atau menolak) penyelesaian proyek. Setujui -> status proyek 'Selesai'. */
export async function decideProjectCompletion(projectId: string, approve: boolean, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  const { error } = await supabase.rpc("project_decide_completion", {
    p_project_id: projectId,
    p_approve: approve,
    p_note: note?.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  const { data: project } = await supabase.from("projects").select("name, vendor_id").eq("id", projectId).maybeSingle();
  if (project?.vendor_id) {
    await notifyOrgMembers({
      orgId: project.vendor_id,
      type: "approval",
      title: approve ? "Proyek Selesai" : "Penyelesaian Proyek Ditolak",
      message: approve
        ? `Proyek "${project.name}" telah dinyatakan selesai dan masuk arsip.`
        : `Penyelesaian proyek "${project.name}" ditolak: ${note?.trim()}.`,
      link: `/vendor/dashboard/projects/${projectId}`,
    });
  }

  refresh(projectId);
  return { success: true };
}

/** Vendor mengajukan perpanjangan masa berlaku PTW yang masih Aktif. */
export async function requestPtwExtension(params: { ptwId: string; newValidTo: string; reason: string }): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.newValidTo)) return { success: false, error: "Tanggal berlaku baru tidak valid." };

  const ptw = await loadPtw(supabase, params.ptwId);
  if (!ptw) return { success: false, error: "PTW tidak ditemukan." };

  const { error } = await supabase.rpc("ptw_request_extension", {
    p_ptw_id: params.ptwId,
    p_new_valid_to: params.newValidTo,
    p_reason: params.reason,
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: params.ptwId, projectId: ptw.project_id, actorId: user.id,
    action: `Perpanjangan PTW Diajukan (sampai ${params.newValidTo})`, notes: params.reason,
  });
  await notifyAssignees({
    projectId: ptw.project_id,
    docType: "ptw",
    stageKey: "ptw.numbering_hsse",
    type: "action_required",
    title: "Perpanjangan PTW Menunggu Verifikasi",
    message: `Vendor mengajukan perpanjangan PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project?.name}" sampai ${params.newValidTo}.`,
    link: `/dashboard/projects/${ptw.project_id}`,
  });

  refresh(ptw.project_id);
  return { success: true };
}

/** HSSE menyetujui (valid_to diperbarui) atau menolak perpanjangan PTW. */
export async function decidePtwExtension(ptwId: string, approve: boolean, note?: string, number?: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { success: false, error: "PTW tidak ditemukan." };

  if (approve && !number?.trim()) return { success: false, error: "Nomor PTW perpanjangan wajib diisi." };

  const { error } = await supabase.rpc("ptw_decide_extension", {
    p_ptw_id: ptwId,
    p_approve: approve,
    p_note: note?.trim() || null,
    p_number: approve ? number!.trim() : null,
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: ptwId, projectId: ptw.project_id, actorId: user.id,
    action: approve ? "Perpanjangan PTW Disetujui" : "Perpanjangan PTW Ditolak",
    notes: approve ? `Nomor perpanjangan: ${number!.trim()}` : (note?.trim() || null),
  });
  if (ptw.project?.vendor_id) {
    await notifyOrgMembers({
      orgId: ptw.project.vendor_id,
      type: "approval",
      title: approve ? "Perpanjangan PTW Disetujui" : "Perpanjangan PTW Ditolak",
      message: approve
        ? `Perpanjangan PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project.name}" disetujui dengan nomor ${number!.trim()}. Masa berlaku diperbarui.`
        : `Perpanjangan PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project.name}" ditolak: ${note?.trim()}.`,
      link: `/vendor/dashboard/projects/${ptw.project_id}`,
    });
  }

  refresh(ptw.project_id);
  return { success: true };
}

/** Vendor mengajukan lembur (di luar jam kerja normal PTW) untuk satu tanggal. */
export async function requestPtwOvertime(params: {
  ptwId: string; tanggal: string; mulai: string; selesai: string; alasan: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.tanggal)) return { success: false, error: "Tanggal lembur tidak valid." };

  const ptw = await loadPtw(supabase, params.ptwId);
  if (!ptw) return { success: false, error: "PTW tidak ditemukan." };

  const { error } = await supabase.rpc("ptw_request_overtime", {
    p_ptw_id: params.ptwId,
    p_tanggal: params.tanggal,
    p_mulai: params.mulai,
    p_selesai: params.selesai,
    p_alasan: params.alasan,
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: params.ptwId, projectId: ptw.project_id, actorId: user.id,
    action: `Lembur PTW Diajukan (${params.tanggal} ${params.mulai}–${params.selesai})`, notes: params.alasan,
  });
  await notifyAssignees({
    projectId: ptw.project_id,
    docType: "ptw",
    stageKey: "ptw.numbering_hsse",
    type: "action_required",
    title: "Lembur PTW Menunggu Verifikasi",
    message: `Vendor mengajukan lembur PTW ${ptw.ptw_number ?? ""} pada proyek "${ptw.project?.name}" tanggal ${params.tanggal}, ${params.mulai}–${params.selesai}.`,
    link: `/dashboard/projects/${ptw.project_id}`,
  });

  refresh(ptw.project_id);
  return { success: true };
}

/** HSSE menyetujui / menolak pengajuan lembur. */
export async function decidePtwOvertime(overtimeId: string, approve: boolean, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Silakan login terlebih dahulu." };

  const { data: ot } = await supabase
    .from("ptw_overtimes")
    .select("id, ptw_id, project_id, tanggal, jam_mulai, jam_selesai")
    .eq("id", overtimeId)
    .maybeSingle();
  if (!ot) return { success: false, error: "Pengajuan lembur tidak ditemukan." };
  const ptw = await loadPtw(supabase, ot.ptw_id);

  const { error } = await supabase.rpc("ptw_decide_overtime", {
    p_overtime_id: overtimeId,
    p_approve: approve,
    p_note: note?.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  await logDocumentEvent(supabase, {
    docType: "ptw", docId: ot.ptw_id, projectId: ot.project_id, actorId: user.id,
    action: approve ? "Lembur PTW Disetujui" : "Lembur PTW Ditolak",
    notes: `${ot.tanggal} ${ot.jam_mulai}–${ot.jam_selesai}${note?.trim() ? ` — ${note.trim()}` : ""}`,
  });
  if (ptw?.project?.vendor_id) {
    await notifyOrgMembers({
      orgId: ptw.project.vendor_id,
      type: approve ? "approval" : "warning",
      title: approve ? "Lembur PTW Disetujui" : "Lembur PTW Ditolak",
      message: approve
        ? `Lembur PTW ${ptw.ptw_number ?? ""} tanggal ${ot.tanggal} (${ot.jam_mulai}–${ot.jam_selesai}) pada proyek "${ptw.project.name}" disetujui.`
        : `Lembur PTW ${ptw.ptw_number ?? ""} tanggal ${ot.tanggal} pada proyek "${ptw.project.name}" ditolak: ${note?.trim()}.`,
      link: `/vendor/dashboard/projects/${ot.project_id}`,
    });
  }

  refresh(ot.project_id);
  return { success: true };
}

"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyOrgMembers } from "@/app/dashboard/inbox/actions";
import { hasPermissionForUser } from "@/utils/permissions";
import { writeStageAssignment, getStageAssignments, PGN_STAGE_KEYS } from "@/lib/stage-assignments";
import { notifyProjectNeedsAssignment, notifyAddedAssigneesIfActive } from "@/lib/assignment-notify";
import { logActivity } from "@/lib/activity-log";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_project'))) {
    throw new Error("Anda tidak memiliki izin untuk membuat proyek baru.");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const contract_number = formData.get("contract_number") as string;
  const location = formData.get("location") as string;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const vendor_id = formData.get("vendor_id") as string;

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      description,
      contract_number,
      location,
      start_date,
      end_date,
      vendor_id,
      status: 'Menunggu Review',
      progress: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error("Error creating project:", error);
    throw new Error(error.message);
  }

  if (vendor_id) {
    await notifyOrgMembers({
      orgId: vendor_id,
      type: 'action_required',
      title: 'Proyek Baru Ditugaskan',
      message: `Anda ditugaskan pada proyek "${name}". Silakan ajukan Prosedur Kerja untuk memulai.`,
      link: `/vendor/dashboard/projects/${project.id}/prosedur`,
    });
  }

  // Tahap approval baru berjalan kalau ada yang ditugaskan — ingatkan admin
  // tiap pihak (PGN/PGSOL/vendor) sejak proyek dibuat, bukan setelah dokumen tersangkut.
  await notifyProjectNeedsAssignment(supabase, {
    projectId: project.id, projectName: name, vendorOrgId: vendor_id || null, excludeUserId: user.id,
  });

  await logActivity(supabase, { actorId: user.id, action: "Membuat proyek", entityType: "project", entityId: project.id, notes: name });

  revalidatePath("/dashboard/master-data/project");
}

export async function saveStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_project');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola assignment proyek.' };

  if (!(PGN_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini bukan tahap yang dikelola admin PGN.' };
  }

  const docType = stageKey.split('.')[0];
  const beforeIds = (await getStageAssignments(supabase, projectId, docType, stageKey)).map(r => r.assignee_id);

  const result = await writeStageAssignment(supabase, user.id, { projectId, docType, stageKey, assigneeIds });
  if (result.error) return { error: result.error };

  // Penugasan terlambat: kalau dokumennya sudah di tahap ini, orang yang baru
  // ditunjuk tidak akan pernah dapat notifikasi tahap — kirim sekarang.
  await notifyAddedAssigneesIfActive(supabase, {
    projectId, docType, stageKey, addedIds: assigneeIds.filter(id => !beforeIds.includes(id)),
  });

  revalidatePath(`/dashboard/master-data/project/${projectId}`);
  revalidatePath(`/dashboard/master-data/project/${projectId}/assign`);
  revalidatePath('/dashboard/my-task');
  return { success: true };
}

/** Bentuk yang dipakai form penugasan bersama (AssignStagesForm). */
export async function savePgnAssignment(projectId: string, _docType: string, stageKey: string, assigneeIds: string[]) {
  return saveStageAssignment(projectId, stageKey, assigneeIds);
}

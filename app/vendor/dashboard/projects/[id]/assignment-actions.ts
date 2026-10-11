"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPermissionForUser } from "@/utils/permissions";
import { writeStageAssignment, getStageAssignments, VENDOR_STAGE_KEYS } from "@/lib/stage-assignments";
import { notifyAddedAssigneesIfActive } from "@/lib/assignment-notify";

export async function saveVendorStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_org_staff');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola assignment proyek.' };

  if (!(VENDOR_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini bukan tahap yang dikelola vendor.' };
  }

  const docType = stageKey.split('.')[0];
  const beforeIds = (await getStageAssignments(supabase, projectId, docType, stageKey)).map(r => r.assignee_id);

  const result = await writeStageAssignment(supabase, user.id, { projectId, docType, stageKey, assigneeIds });
  if (result.error) return { error: result.error };

  await notifyAddedAssigneesIfActive(supabase, {
    projectId, docType, stageKey, addedIds: assigneeIds.filter(id => !beforeIds.includes(id)),
  });

  revalidatePath(`/vendor/dashboard/projects/${projectId}`);
  return { success: true };
}

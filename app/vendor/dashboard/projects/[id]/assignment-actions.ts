"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPermissionForUser } from "@/utils/permissions";
import { writeStageAssignment, VENDOR_STAGE_KEYS } from "@/lib/stage-assignments";

export async function saveVendorStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_org_staff');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola assignment proyek.' };

  if (!(VENDOR_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini bukan tahap yang dikelola vendor.' };
  }

  const result = await writeStageAssignment(supabase, user.id, { projectId, docType: stageKey.split('.')[0], stageKey, assigneeIds });
  if (result.error) return { error: result.error };

  revalidatePath(`/vendor/dashboard/projects/${projectId}`);
  return { success: true };
}

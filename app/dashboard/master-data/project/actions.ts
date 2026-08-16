"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/dashboard/inbox/actions";
import { hasPermissionForUser } from "@/utils/permissions";

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
    await createNotification({
      userId: vendor_id,
      type: 'action_required',
      title: 'Proyek Baru Ditugaskan',
      message: `Anda ditugaskan pada proyek "${name}". Silakan ajukan Prosedur Kerja untuk memulai.`,
      link: `/vendor/dashboard/projects/${project.id}/prosedur`,
    });
  }

  revalidatePath("/dashboard/master-data/project");
}

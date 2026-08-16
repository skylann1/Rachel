"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/dashboard/inbox/actions";
import { hasPermissionForUser } from "@/utils/permissions";

export async function getInternalIncidents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      id,
      type,
      incident_date,
      location,
      status,
      projects (
        vendor_profiles (
          company_name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function getIncidentDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      projects (
        name,
        vendor_profiles (
          company_name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateIncidentInvestigation(id: string, payload: {
  rca_root_cause: string;
  rca_corrective: string;
  rca_preventive: string;
  status: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'incident', 'investigate'))) {
    throw new Error("Anda tidak memiliki izin untuk menginvestigasi insiden.");
  }

  const { error } = await supabase
    .from('incidents')
    .update({
      ...payload,
      investigated_by: user.id
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (payload.status === 'Investigasi Selesai') {
    const { data: incident } = await supabase
      .from('incidents')
      .select('title, reported_by, projects ( name )')
      .eq('id', id)
      .single();

    const proj: any = Array.isArray(incident?.projects) ? incident?.projects[0] : incident?.projects;
    if (incident?.reported_by) {
      await createNotification({
        userId: incident.reported_by,
        type: 'info',
        title: 'Investigasi Insiden Selesai',
        message: `Investigasi untuk laporan insiden "${incident.title}" pada proyek "${proj?.name || ''}" telah selesai.`,
        link: `/vendor/dashboard/incident`,
      });
    }
  }

  revalidatePath(`/dashboard/incident/${id}`);
  revalidatePath(`/dashboard/incident`);
}

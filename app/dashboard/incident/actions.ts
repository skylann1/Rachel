"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
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

export async function getIncidentReportSigners(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { reporterName: null, investigatorName: null };

  // Nama penandatangan berasal dari profiles lintas organisasi (vendor vs
  // PGN/PGSOL), jadi policy RLS "Org members can read their own
  // organization's profiles" tidak bisa membacanya bagi user internal.
  // Dipakai client service-role biar kedua nama selalu tersedia di PDF.
  const { data: incident } = await supabase
    .from('incidents')
    .select('reported_by, investigated_by')
    .eq('id', id)
    .single();

  if (!incident) return { reporterName: null, investigatorName: null };

  const ids = [incident.reported_by, incident.investigated_by].filter(Boolean);
  if (!ids.length) return { reporterName: null, investigatorName: null };

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);

  const byId: Record<string, string> = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p.full_name])
  );
  return {
    reporterName: incident.reported_by ? byId[incident.reported_by] ?? null : null,
    investigatorName: incident.investigated_by ? byId[incident.investigated_by] ?? null : null,
  };
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

    const proj = Array.isArray(incident?.projects) ? incident?.projects[0] : incident?.projects;
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

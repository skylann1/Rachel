"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { PTW_STATUS } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { createNotification, notifyUsersByPermission } from "@/app/dashboard/inbox/actions";
import { todayDateString } from "@/lib/site-ops";

/**
 * The /checkin/[token] page has no Supabase session — anyone in the field
 * can open it without logging in. Every mutation below re-resolves the PTW
 * from the token itself (never trusts a ptwId passed back from the client)
 * and reads/writes via the service-role admin client, since there's no
 * session to carry RLS. The token is the entire authorization boundary.
 */
async function resolvePtwByToken(token: string) {
  const supabase = createAdminClient();
  const { data: ptw } = await supabase
    .from('ptw')
    .select('id, project_id, status, workers, projects ( id, name, vendor_id, assigned_inspector )')
    .eq('field_token', token)
    .maybeSingle();
  if (!ptw) throw new Error("Token check-in tidak valid.");
  return { supabase, ptw, project: (Array.isArray(ptw.projects) ? ptw.projects[0] : ptw.projects) as any };
}

export async function logToolboxMeeting(token: string, params: { topics: string; attendees: { name: string }[]; conductedByName: string }) {
  const { supabase, ptw, project } = await resolvePtwByToken(token);
  if (ptw.status !== PTW_STATUS.aktif) throw new Error("PTW tidak sedang aktif — toolbox meeting tidak bisa dicatat.");
  if (!params.topics?.trim()) throw new Error("Topik toolbox meeting wajib diisi.");
  if (!params.conductedByName?.trim()) throw new Error("Nama pemimpin briefing wajib diisi.");

  const { error } = await supabase.from('toolbox_meetings').insert({
    ptw_id: ptw.id,
    project_id: ptw.project_id,
    meeting_date: todayDateString(),
    topics: params.topics.trim(),
    attendees: params.attendees.filter(a => a.name?.trim()),
    conducted_by_name: params.conductedByName.trim(),
  });
  if (error) throw new Error(error.message);

  await logDocumentEvent(supabase, {
    docType: 'ptw', docId: ptw.id, projectId: ptw.project_id, actorId: null,
    action: 'Toolbox Meeting Dicatat', notes: `Oleh ${params.conductedByName.trim()} — ${params.topics.trim()}`,
  });

  revalidatePath(`/checkin/${token}`);
  revalidatePath('/dashboard/site-status');
}

export async function checkInWorker(token: string, workerName: string) {
  const { supabase, ptw } = await resolvePtwByToken(token);
  if (ptw.status !== PTW_STATUS.aktif) throw new Error("PTW tidak sedang aktif — check-in tidak bisa dilakukan.");
  if (!workerName?.trim()) throw new Error("Nama pekerja wajib diisi.");

  const { error } = await supabase.from('site_checkins').insert({
    ptw_id: ptw.id,
    worker_name: workerName.trim(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/checkin/${token}`);
  revalidatePath('/dashboard/site-status');
}

export async function checkOutWorker(token: string, checkinId: string) {
  const { supabase, ptw } = await resolvePtwByToken(token);

  const { error } = await supabase
    .from('site_checkins')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', checkinId)
    .eq('ptw_id', ptw.id); // scope the update to this token's PTW, not an arbitrary id

  if (error) throw new Error(error.message);

  revalidatePath(`/checkin/${token}`);
  revalidatePath('/dashboard/site-status');
}

export async function triggerStopWork(token: string, params: { reporterName: string; reason: string }) {
  const { supabase, ptw, project } = await resolvePtwByToken(token);
  if (ptw.status !== PTW_STATUS.aktif) throw new Error("PTW tidak sedang aktif — Stop Work tidak berlaku.");
  if (!params.reporterName?.trim()) throw new Error("Nama pelapor wajib diisi.");
  if (!params.reason?.trim()) throw new Error("Alasan Stop Work wajib diisi.");

  const { error } = await supabase
    .from('ptw')
    .update({
      status: PTW_STATUS.stoppedSwa,
      stopped_at: new Date().toISOString(),
      stopped_reason: params.reason.trim(),
      stopped_by_name: params.reporterName.trim(),
    })
    .eq('id', ptw.id);
  if (error) throw new Error(error.message);

  await logDocumentEvent(supabase, {
    docType: 'ptw', docId: ptw.id, projectId: ptw.project_id, actorId: null,
    action: 'Stop Work Authority Dipicu dari Lapangan',
    notes: `Oleh ${params.reporterName.trim()}: ${params.reason.trim()}`,
  });

  const projectName = project?.name ?? 'proyek';
  const message = `Stop Work Authority dipicu oleh ${params.reporterName.trim()} di proyek "${projectName}". Alasan: "${params.reason.trim()}".`;

  if (project?.vendor_id) {
    await createNotification({
      userId: project.vendor_id, type: 'warning',
      title: 'Stop Work Authority — Pekerjaan Dihentikan',
      message, link: `/vendor/dashboard/projects/${ptw.project_id}`,
    });
  }
  if (project?.assigned_inspector) {
    await createNotification({
      userId: project.assigned_inspector, type: 'warning',
      title: 'Stop Work Authority — Pekerjaan Dihentikan',
      message, link: `/dashboard/projects/${ptw.project_id}`,
    });
  }
  // PM/HSSE — the same permission stage that got PTW to Aktif in the first place.
  await notifyUsersByPermission({
    module: 'ptw', action: 'numbering_hsse',
    type: 'warning',
    title: 'Stop Work Authority — Pekerjaan Dihentikan',
    message, link: `/dashboard/projects/${ptw.project_id}`,
  });

  revalidatePath(`/checkin/${token}`);
  revalidatePath('/dashboard/site-status');
  revalidatePath(`/dashboard/projects/${ptw.project_id}`);
}

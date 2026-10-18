"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { hasPermissionForUser } from "@/utils/permissions";
import { getEligibleAssignees } from "@/lib/stage-assignments";
import { getEffectivePtwStatus, PTW_STATUS } from "@/lib/ptw-status";
import { todayDateString } from "@/lib/site-ops";
import { dayIndexForDate, type FieldPeran, type PtwFieldData, type FieldCandidate } from "@/lib/ptw-field";
import { PTW_TRACK_MAX_DAYS } from "@/lib/ptw-types";

function getProjectPath(projectId: string) {
  return `/dashboard/projects/${projectId}`;
}

async function loadPtwWithProject(supabase: any, ptwId: string) {
  const { data } = await supabase
    .from("ptw")
    .select(
      "id, ptw_type, status, valid_from, valid_to, project_id, projects ( id, name, end_date, vendor_id )"
    )
    .eq("id", ptwId)
    .maybeSingle();

  if (!data) return null;
  const project = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  return { ...data, project } as any;
}

async function loadNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || "Tanpa nama"]));
}

export async function assignFieldRole(
  ptwId: string,
  peran: "pemegang" | "pengawas",
  userId: string,
  alasan?: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." };
  }

  const ptw = await loadPtwWithProject(supabase, ptwId);
  if (!ptw) {
    return { success: false, error: "PTW tidak ditemukan." };
  }

  const { data, error } = await supabase.rpc("ptw_assign_field_role", {
    p_ptw_id: ptwId,
    p_peran: peran,
    p_user_id: userId,
    p_alasan: alasan?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(getProjectPath(ptw.project_id));
  return { success: true, id: data };
}

export async function submitDailyCheck(
  ptwId: string,
  uraian?: string,
  requiredKeys?: string[]
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." };
  }

  const ptw = await loadPtwWithProject(supabase, ptwId);
  if (!ptw) {
    return { success: false, error: "PTW tidak ditemukan." };
  }

  const { data, error } = await supabase.rpc("ptw_submit_daily_check", {
    p_ptw_id: ptwId,
    p_uraian: uraian?.trim() || null,
    p_required_keys: requiredKeys ?? [],
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(getProjectPath(ptw.project_id));
  return { success: true, id: data };
}

export async function getPtwFieldData(ptwId: string): Promise<PtwFieldData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Silakan login terlebih dahulu.");
  }

  const ptw = await loadPtwWithProject(supabase, ptwId);
  if (!ptw) {
    throw new Error("PTW tidak ditemukan.");
  }

  const [{ data: assignmentRows }, { data: checkRows }, { data: profile }] =
    await Promise.all([
      supabase
        .from("ptw_field_assignments")
        .select("*")
        .eq("ptw_id", ptwId)
        .order("aktif_dari", { ascending: false }),
      supabase
        .from("ptw_daily_checks")
        .select("*")
        .eq("ptw_id", ptwId)
        .order("hari_ke", { ascending: true }),
      supabase.from("profiles").select("type").eq("id", user.id).single(),
    ]);

  const ids = new Set<string>();
  (assignmentRows ?? []).forEach((r: any) => {
    ids.add(r.user_id);
    if (r.ditugaskan_oleh) ids.add(r.ditugaskan_oleh);
  });
  (checkRows ?? []).forEach((r: any) => {
    ids.add(r.user_id);
  });
  const names = await loadNames([...ids]);

  const assignments = (assignmentRows ?? []).map((r: any) => ({
    id: r.id,
    ptw_id: r.ptw_id,
    peran: r.peran,
    user_id: r.user_id,
    user_name: names[r.user_id] ?? "Tanpa nama",
    aktif_dari: r.aktif_dari,
    aktif_sampai: r.aktif_sampai,
    ditugaskan_oleh_name: r.ditugaskan_oleh
      ? names[r.ditugaskan_oleh] ?? null
      : null,
    alasan: r.alasan,
  }));

  const checks = (checkRows ?? []).map((r: any) => ({
    id: r.id,
    ptw_id: r.ptw_id,
    hari_ke: r.hari_ke,
    tanggal: r.tanggal,
    peran: r.peran,
    user_id: r.user_id,
    user_name: names[r.user_id] ?? "Tanpa nama",
    diisi_pada: r.diisi_pada,
    inisial: r.inisial,
    uraian_pekerjaan: r.uraian_pekerjaan,
  }));

  const myPeran = assignments.find(
    (a) => a.user_id === user.id && !a.aktif_sampai
  )?.peran ?? null;

  let assignablePeran: FieldPeran | null = null;
  if (profile?.type === "pgn") {
    const hasAssignPengawas = await hasPermissionForUser(
      supabase,
      user.id,
      "ptw",
      "assign_pengawas"
    );
    if (hasAssignPengawas) {
      assignablePeran = "pengawas";
    }
  } else if (profile?.type === "vendor") {
    const hasAssignHolder = await hasPermissionForUser(
      supabase,
      user.id,
      "ptw",
      "assign_holder"
    );
    if (hasAssignHolder) {
      assignablePeran = "pemegang";
    }
  }

  const today = todayDateString();
  const effective = getEffectivePtwStatus(
    ptw.status,
    ptw.valid_to ?? ptw.project?.end_date
  );
  const active = effective === PTW_STATUS.aktif;

  const todayHari = active
    ? dayIndexForDate(ptw.valid_from, ptw.valid_to, today, PTW_TRACK_MAX_DAYS)
    : null;

  return {
    assignments,
    checks,
    viewer: {
      userId: user.id,
      myPeran,
      assignablePeran,
    },
    today,
    todayHari,
    active,
  };
}

/**
 * Kandidat yang bisa ditugaskan sebagai `peran` ini: satu organisasi dengan
 * pemanggil (PGN -> sesama staf PGN; vendor admin -> sesama staf vendornya)
 * dan rolenya punya permission ptw.field_pengawas / ptw.field_holder.
 */
export async function getFieldCandidates(peran: FieldPeran): Promise<FieldCandidate[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!actorProfile?.org_id) return [];

  const action = peran === "pengawas" ? "field_pengawas" : "field_holder";
  const rows = await getEligibleAssignees(supabase, "ptw", action, actorProfile.org_id);
  return rows.map((r: { id: string; full_name: string }) => ({ id: r.id, name: r.full_name }));
}

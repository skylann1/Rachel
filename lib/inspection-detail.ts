// Loader detail satu inspeksi, dipakai halaman detail internal & vendor.
// Bukan Server Action (tanpa "use server") — menerima supabase client dari pemanggil.
// Nama orang diambil lewat query terpisah: embed internal_profiles -> profiles
// ambigu bagi PostgREST (lihat getInspections di app/dashboard/inspection/actions.ts).

export async function loadInspectionDetail(supabase: any, id: string) {
  const { data: row, error } = await supabase
    .from('inspections')
    .select('*, inspection_photos ( id, image_url )')
    .eq('id', id)
    .maybeSingle();
  if (error) return { inspection: null, error: error.message as string };
  if (!row) return { inspection: null, error: null as string | null };

  const personIds = [row.reported_by, row.assigned_to].filter(Boolean) as string[];
  const names = new Map<string, string>();
  if (personIds.length) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', personIds);
    (people || []).forEach((p: any) => names.set(p.id, p.full_name));
  }

  const [{ data: vendor }, { data: project }, { data: logs }] = await Promise.all([
    row.target_vendor
      ? supabase.from('vendor_profiles').select('company_name').eq('id', row.target_vendor).maybeSingle()
      : Promise.resolve({ data: null }),
    row.project_id
      ? supabase.from('projects').select('name').eq('id', row.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('inspection_logs')
      .select('id, action, notes, created_at, profiles ( full_name, role )')
      .eq('inspection_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return {
    inspection: {
      ...row,
      reporter_name: row.reported_by ? names.get(row.reported_by) ?? null : null,
      assignee_name: row.assigned_to ? names.get(row.assigned_to) ?? null : null,
      vendor_name: vendor?.company_name ?? null,
      project_name: project?.name ?? null,
      logs: logs || [],
    },
    error: null as string | null,
  };
}

import { createClient } from '@/utils/supabase/server';
import ProjectClient from './ProjectClient';
import { getProjectStage } from '@/lib/project-stage';

export default async function ProjectManagementPage() {
  const supabase = await createClient();

  // Fetch all projects with their assigned vendor
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      vendor:vendor_profiles(
        id,
        company_name
      )
    `)
    .order('created_at', { ascending: false });

  // Fetch all vendors to populate the "Assign Vendor" dropdown
  const { data: vendors } = await supabase
    .from('vendor_profiles')
    .select('id, company_name');

  // Document status per project, so each card can show which stage the K3
  // paperwork is at and who has to act next.
  type DocRow = { project_id: string; status: string; valid_to?: string | null };
  const projectIds = (projects || []).map(p => p.id);

  let procedures: DocRow[] = [];
  let jsas: DocRow[] = [];
  let ptws: DocRow[] = [];

  if (projectIds.length > 0) {
    const [procRes, jsaRes, ptwRes] = await Promise.all([
      supabase.from('procedures').select('project_id, status').in('project_id', projectIds),
      supabase.from('jsa').select('project_id, status').in('project_id', projectIds),
      supabase.from('ptw').select('project_id, status, valid_to').in('project_id', projectIds),
    ]);
    procedures = (procRes.data || []) as DocRow[];
    jsas = (jsaRes.data || []) as DocRow[];
    ptws = (ptwRes.data || []) as DocRow[];
  }

  const byProject = (rows: DocRow[]) => new Map(rows.map(r => [r.project_id, r.status]));
  // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — kumpulkan semua baris per proyek.
  const byProjectMulti = (rows: DocRow[]) => {
    const map = new Map<string, DocRow[]>();
    for (const r of rows) {
      const list = map.get(r.project_id) ?? [];
      list.push(r);
      map.set(r.project_id, list);
    }
    return map;
  };

  const procMap = byProject(procedures);
  const jsaMap = byProject(jsas);
  const ptwMap = byProjectMulti(ptws);

  const projectsWithStage = (projects || []).map(p => ({
    ...p,
    stage: getProjectStage({
      procedureStatus: procMap.get(p.id),
      jsaStatus: jsaMap.get(p.id),
      ptws: ptwMap.get(p.id) ?? [],
      projectStatus: p.status,
      endDate: p.end_date,
    }),
  }));

  return (
    <ProjectClient
      initialProjects={projectsWithStage}
      vendors={vendors || []}
    />
  );
}

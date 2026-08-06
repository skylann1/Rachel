"use server";

import { createClient } from "@/utils/supabase/server";

export interface DetailRecord {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  href: string;
}

function firstOf<T>(val: T | T[] | null | undefined): T | undefined {
  return Array.isArray(val) ? val[0] : val ?? undefined;
}

export async function getProjectDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, status, created_at, vendor_profiles ( company_name )')
    .order('created_at', { ascending: false })
    .limit(50);

  return (data || []).map((p: any) => ({
    id: p.id,
    title: p.name,
    subtitle: firstOf(p.vendor_profiles)?.company_name || 'Vendor tidak diketahui',
    status: p.status,
    date: p.created_at,
    href: `/dashboard/projects/${p.id}`,
  }));
}

export async function getProjectScheduleDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, status, end_date, vendor_profiles ( company_name )')
    .neq('status', 'Selesai')
    .neq('status', 'Ditolak')
    .order('end_date', { ascending: true })
    .limit(50);

  const now = new Date();
  return (data || []).map((p: any) => {
    const late = new Date(p.end_date) < now;
    return {
      id: p.id,
      title: p.name,
      subtitle: firstOf(p.vendor_profiles)?.company_name || 'Vendor tidak diketahui',
      status: late ? 'Terlambat' : 'On Schedule',
      date: p.end_date,
      href: `/dashboard/projects/${p.id}`,
    };
  });
}

function mapProjectScoped(rows: any[], hrefBase: string): DetailRecord[] {
  return (rows || []).map((r: any) => {
    const proj = firstOf(r.projects);
    const vendor = firstOf(proj?.vendor_profiles);
    return {
      id: r.id,
      title: proj?.name || 'Proyek tidak diketahui',
      subtitle: vendor?.company_name || 'Vendor tidak diketahui',
      status: r.status,
      date: r.created_at,
      href: `${hrefBase}/${r.project_id}`,
    };
  });
}

export async function getProcedureDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('procedures')
    .select('id, project_id, status, created_at, projects ( name, vendor_profiles ( company_name ) )')
    .order('created_at', { ascending: false })
    .limit(50);

  return mapProjectScoped(data || [], '/dashboard/projects');
}

export async function getJsaDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jsa')
    .select('id, project_id, status, created_at, projects ( name, vendor_profiles ( company_name ) )')
    .order('created_at', { ascending: false })
    .limit(50);

  return mapProjectScoped(data || [], '/dashboard/projects');
}

export async function getPtwDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('id, project_id, status, created_at, projects ( name, vendor_profiles ( company_name ) )')
    .order('created_at', { ascending: false })
    .limit(50);

  return mapProjectScoped(data || [], '/dashboard/projects');
}

export async function getInspectionDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('inspections')
    .select('id, title, finding_type, created_at, projects ( name )')
    .order('created_at', { ascending: false })
    .limit(50);

  return (data || []).map((i: any) => ({
    id: i.id,
    title: i.title,
    subtitle: firstOf(i.projects)?.name || 'Proyek tidak diketahui',
    status: i.finding_type,
    date: i.created_at,
    href: `/dashboard/inspection`,
  }));
}

export async function getAnomaliDetails(): Promise<DetailRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('inspections')
    .select('id, title, status, created_at, projects ( name )')
    .in('finding_type', ['Unsafe Act', 'Unsafe Condition'])
    .order('created_at', { ascending: false })
    .limit(50);

  return (data || []).map((i: any) => ({
    id: i.id,
    title: i.title,
    subtitle: firstOf(i.projects)?.name || 'Proyek tidak diketahui',
    status: i.status,
    date: i.created_at,
    href: `/dashboard/inspection`,
  }));
}

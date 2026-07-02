import { createClient } from '@/utils/supabase/server';
import ProjectClient from './ProjectClient';

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

  return (
    <ProjectClient 
      initialProjects={projects || []} 
      vendors={vendors || []} 
    />
  );
}

import { getCurrentUserProfile, getAllProjectsWithRelations } from './actions';
import ApprovalPageClient from './ApprovalPageClient';
import { getUserPermissions } from '@/utils/permissions';

export default async function ApprovalPage() {
  const [profile, projects] = await Promise.all([
    getCurrentUserProfile(),
    getAllProjectsWithRelations(),
  ]);

  const userRole = profile?.role || '';

  return (
    <ApprovalPageClient
      userRole={userRole}
      projects={projects}
    />
  );
}

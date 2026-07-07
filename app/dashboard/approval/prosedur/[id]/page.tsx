import { getProcedureById, getCurrentUserProfile } from '../../actions';
import { getUserPermissions } from '@/utils/permissions';
import { notFound } from 'next/navigation';
import ProsedurDetailClient from './ProsedurDetailClient';

export default async function ProsedurDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [prosedur, profile, permissions] = await Promise.all([
    getProcedureById(params.id),
    getCurrentUserProfile(),
    getUserPermissions()
  ]);

  if (!prosedur) {
    notFound();
  }

  const userRole = profile?.role || 'admin';

  return (
    <ProsedurDetailClient 
      prosedur={prosedur} 
      userRole={userRole} 
      permissions={permissions} 
    />
  );
}

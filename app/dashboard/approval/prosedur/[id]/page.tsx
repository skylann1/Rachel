import { getProcedureById } from '../../actions';
import { getUserPermissions } from '@/utils/permissions';
import { notFound } from 'next/navigation';
import ProsedurDetailClient from './ProsedurDetailClient';

export default async function ProsedurDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [prosedur, permissions] = await Promise.all([
    getProcedureById(params.id),
    getUserPermissions()
  ]);

  if (!prosedur) {
    notFound();
  }

  return (
    <ProsedurDetailClient
      prosedur={prosedur}
      permissions={permissions}
    />
  );
}

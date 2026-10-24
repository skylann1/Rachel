import { getProcedureById, getDocumentLogs } from '../../actions';
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

  const logs = prosedur.project_id ? await getDocumentLogs(prosedur.project_id) : [];

  return (
    <ProsedurDetailClient
      logs={logs}
      prosedur={prosedur}
      permissions={permissions}
    />
  );
}

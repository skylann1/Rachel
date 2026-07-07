import { getCurrentUserProfile, getPendingJsa, getPendingProcedures, getPendingPtw } from './actions';
import ApprovalPageClient from './ApprovalPageClient';
import { getUserPermissions } from '@/utils/permissions';

export default async function ApprovalPage() {
  const [profile, procedures, jsaList, ptwList, permissions] = await Promise.all([
    getCurrentUserProfile(),
    getPendingProcedures(),
    getPendingJsa(),
    getPendingPtw(),
    getUserPermissions(),
  ]);

  const userRole = profile?.role || 'admin';

  return (
    <ApprovalPageClient
      userRole={userRole}
      permissions={permissions}
      procedures={procedures}
      jsaList={jsaList}
      ptwList={ptwList}
    />
  );
}

import { getCurrentUserProfile, getPendingJsa, getPendingProcedures, getPendingPtw } from './actions';
import ApprovalPageClient from './ApprovalPageClient';

export default async function ApprovalPage() {
  const [profile, procedures, jsaList, ptwList] = await Promise.all([
    getCurrentUserProfile(),
    getPendingProcedures(),
    getPendingJsa(),
    getPendingPtw(),
  ]);

  const userRole = profile?.role || 'admin';

  return (
    <ApprovalPageClient
      userRole={userRole}
      procedures={procedures}
      jsaList={jsaList}
      ptwList={ptwList}
    />
  );
}

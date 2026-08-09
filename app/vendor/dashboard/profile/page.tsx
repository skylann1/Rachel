import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EditableVendorProfile } from "./EditableVendorProfile";
import { getEffectivePtwStatus, PTW_STATUS, PTW_PENDING_STATUSES } from "@/lib/ptw-status";
import { isJsaPending } from "@/lib/jsa-status";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";

export const metadata = {
  title: 'Profil Vendor | Portal Vendor K3',
};

export default async function VendorProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch from profiles and vendor_profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, status')
    .eq('id', user.id)
    .single();

  const { data: vendorProfile } = await supabase
    .from('vendor_profiles')
    .select('company_name, address')
    .eq('id', user.id)
    .single();

  // Real stats for the summary panel — scoped to this vendor's own projects
  const { count: activeProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', user.id)
    .neq('status', 'Selesai')
    .neq('status', 'Ditolak');

  const { data: vendorProjectIds } = await supabase
    .from('projects')
    .select('id')
    .eq('vendor_id', user.id);
  const projectIds = (vendorProjectIds || []).map(p => p.id);

  let ptwApproved = 0;
  let pendingReview = 0;
  let incidentCount = 0;

  if (projectIds.length > 0) {
    const [{ data: procedures }, { data: jsas }, { data: ptws }, { count: incCount }] = await Promise.all([
      supabase.from('procedures').select('status').in('project_id', projectIds),
      supabase.from('jsa').select('status').in('project_id', projectIds),
      supabase.from('ptw').select('status, valid_to, projects ( end_date )').in('project_id', projectIds),
      supabase.from('incidents').select('*', { count: 'exact', head: true }).in('project_id', projectIds),
    ]);
    ptwApproved = (ptws || []).filter(p => {
      const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      return getEffectivePtwStatus(p.status, p.valid_to ?? proj?.end_date) === PTW_STATUS.aktif;
    }).length;
    incidentCount = incCount || 0;
    pendingReview =
      (procedures || []).filter(p => p.status === PROCEDURE_STATUS.menungguReviewPM).length +
      (jsas || []).filter(j => isJsaPending(j.status)).length +
      (ptws || []).filter(p => PTW_PENDING_STATUSES.includes(p.status)).length;
  }

  // K3 compliance ratio — same anomaly/positive split used by the internal
  // vendor safety scorecard (see app/dashboard/page.tsx), but scoped to this
  // vendor's own inspection findings and framed positively for the vendor.
  const ANOMALI_TYPES = ['Unsafe Act', 'Unsafe Condition'];
  const POSITIF_TYPES = ['Safe Act', 'Safe Condition'];
  const { data: inspections } = await supabase
    .from('inspections')
    .select('status, finding_type')
    .eq('target_vendor', user.id);

  const anomaliCount = (inspections || []).filter(i => ANOMALI_TYPES.includes(i.finding_type)).length;
  const positifCount = (inspections || []).filter(i => POSITIF_TYPES.includes(i.finding_type)).length;
  const openAnomali = (inspections || []).filter(i => ANOMALI_TYPES.includes(i.finding_type) && i.status !== 'Closed').length;
  const totalFindings = anomaliCount + positifCount;

  const stats = {
    activeProjects: activeProjects || 0,
    ptwApproved,
    pendingReview,
    incidents: incidentCount,
  };

  const compliance = {
    rate: totalFindings > 0 ? Math.round((positifCount / totalFindings) * 100) : null,
    anomaliCount,
    positifCount,
    openAnomali,
    totalFindings,
  };

  // Data relevant to Vendor in K3 System
  const vendorData = {
    companyName: vendorProfile?.company_name || user.user_metadata?.company_name || 'Belum diisi',
    picName: profile?.full_name || user.user_metadata?.pic_name || 'Belum diisi',
    phone: user.user_metadata?.phone || 'Belum diisi',
    address: vendorProfile?.address || user.user_metadata?.address || 'Belum diisi',
    status: profile?.status === 'Inactive' ? 'Nonaktif' : 'Aktif',
    joinedDate: new Date(user.created_at || Date.now()).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };

  return <EditableVendorProfile user={user} initialVendorData={vendorData} stats={stats} compliance={compliance} />;
}

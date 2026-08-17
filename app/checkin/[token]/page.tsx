import { createAdminClient } from "@/utils/supabase/admin";
import { PTW_STATUS, getEffectivePtwStatus } from "@/lib/ptw-status";
import { PTW_TYPES } from "@/lib/ptw-types";
import { todayDateString } from "@/lib/site-ops";
import { ShieldAlert } from "lucide-react";
import CheckinClient from "./CheckinClient";

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: ptw } = await supabase
    .from('ptw')
    .select('id, project_id, status, ptw_number, ptw_type, valid_to, workers, stopped_at, stopped_reason, stopped_by_name, projects ( id, name, location, end_date, vendor_profiles ( company_name ) )')
    .eq('field_token', token)
    .maybeSingle();

  if (!ptw) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="font-bold text-slate-800 text-lg mb-1">Kode Check-in Tidak Valid</h1>
          <p className="text-sm text-slate-500">Tautan atau QR yang dipindai tidak dikenali. Hubungi HSE/pengawas proyek Anda.</p>
        </div>
      </div>
    );
  }

  const project = (Array.isArray(ptw.projects) ? ptw.projects[0] : ptw.projects) as any;
  const effectiveStatus = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? project?.end_date);

  const { data: meeting } = await supabase
    .from('toolbox_meetings')
    .select('*')
    .eq('ptw_id', ptw.id)
    .eq('meeting_date', todayDateString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: checkins } = await supabase
    .from('site_checkins')
    .select('*')
    .eq('ptw_id', ptw.id)
    .order('checked_in_at', { ascending: false });

  const permitTitle = PTW_TYPES.find(t => t.id === ptw.ptw_type)?.title.split('(')[0].trim() || ptw.ptw_type;
  const vendorName = Array.isArray(project?.vendor_profiles) ? project?.vendor_profiles[0]?.company_name : project?.vendor_profiles?.company_name;

  return (
    <div className="min-h-screen bg-slate-50">
      <CheckinClient
        token={token}
        effectiveStatus={effectiveStatus}
        ptw={{
          id: ptw.id,
          ptwNumber: ptw.ptw_number,
          permitTitle,
          workers: (ptw.workers || []) as { id?: string; worker_name: string }[],
          stoppedAt: ptw.stopped_at,
          stoppedReason: ptw.stopped_reason,
          stoppedByName: ptw.stopped_by_name,
        }}
        project={{ name: project?.name ?? '-', location: project?.location ?? '-', vendorName: vendorName ?? '-' }}
        meeting={meeting ?? null}
        checkins={checkins ?? []}
      />
    </div>
  );
}

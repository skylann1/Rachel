import { createClient } from "@/utils/supabase/server";
import { PTW_STATUS } from "@/lib/ptw-status";
import { todayDateString } from "@/lib/site-ops";
import { Siren, Users, ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function SiteStatusPage() {
  const supabase = await createClient();

  const { data: stoppedPtws } = await supabase
    .from('ptw')
    .select('id, ptw_number, ptw_type, stopped_at, stopped_reason, stopped_by_name, project_id, projects ( name )')
    .eq('status', PTW_STATUS.stoppedSwa);

  const { data: openCheckins } = await supabase
    .from('site_checkins')
    .select('id, worker_name, checked_in_at, ptw_id, ptw:ptw_id ( ptw_number, project_id, projects ( name ) )')
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false });

  const { data: activePtws } = await supabase
    .from('ptw')
    .select('id, ptw_number, project_id, projects ( name )')
    .eq('status', PTW_STATUS.aktif);

  const { data: todaysMeetings } = await supabase
    .from('toolbox_meetings')
    .select('ptw_id')
    .eq('meeting_date', todayDateString());
  const meetingDonePtwIds = new Set((todaysMeetings || []).map(m => m.ptw_id));

  const checkinsByPtw = new Map<string, typeof openCheckins>();
  for (const c of openCheckins || []) {
    const list = checkinsByPtw.get(c.ptw_id) || [];
    list.push(c as any);
    checkinsByPtw.set(c.ptw_id, list as any);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Siren className="w-8 h-8 text-primary" /> Status Lapangan
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Stop Work Authority yang sedang aktif, siapa saja yang sedang check-in di lokasi, dan status toolbox meeting harian.
        </p>
      </div>

      {(stoppedPtws?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black text-red-700 uppercase tracking-wider">Stop Work Authority Aktif</h2>
          {stoppedPtws!.map((p: any) => (
            <Link key={p.id} href={`/dashboard/projects/${p.project_id}`} className="block bg-red-50 border-2 border-red-300 rounded-2xl p-5 hover:bg-red-100 transition-colors">
              <p className="font-black text-red-700">{p.ptw_number || 'PTW'} — {Array.isArray(p.projects) ? p.projects[0]?.name : p.projects?.name}</p>
              <p className="text-sm text-red-800 mt-1"><strong>Dilaporkan oleh:</strong> {p.stopped_by_name}</p>
              <p className="text-sm text-red-800"><strong>Alasan:</strong> {p.stopped_reason}</p>
              <p className="text-xs text-red-600 mt-1">{p.stopped_at && new Date(p.stopped_at).toLocaleString('id-ID')}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4" /> Sedang Check-in di Lokasi ({openCheckins?.length ?? 0})</h2>
        {(!openCheckins || openCheckins.length === 0) ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">Tidak ada pekerja yang sedang check-in saat ini.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {openCheckins.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{c.worker_name}</p>
                  <p className="text-xs text-slate-500">{Array.isArray(c.ptw?.projects) ? c.ptw.projects[0]?.name : c.ptw?.projects?.name} — {c.ptw?.ptw_number}</p>
                </div>
                <span className="text-xs text-slate-400">Sejak {new Date(c.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Toolbox Meeting Hari Ini</h2>
        {(!activePtws || activePtws.length === 0) ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">Tidak ada PTW aktif saat ini.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {activePtws.map((p: any) => {
              const done = meetingDonePtwIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{Array.isArray(p.projects) ? p.projects[0]?.name : p.projects?.name}</p>
                    <p className="text-xs text-slate-500">{p.ptw_number}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {done ? 'Sudah' : 'Belum'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

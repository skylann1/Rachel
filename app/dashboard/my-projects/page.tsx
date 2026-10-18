import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase, MapPin, Calendar, Building2, ArrowRight, Stamp, HardHat } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getEffectivePtwStatus, PTW_STATUS } from '@/lib/ptw-status';
import { PTW_TYPES } from '@/lib/ptw-types';
import { getProjectStage, STAGE_TONE_CLASS } from '@/lib/project-stage';
import { RISK_META, parseRiskLevel, riskCardClasses } from '@/lib/project-risk';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Proyek Saya - RACHEL K3' };

/**
 * Daftar proyek untuk Pengawas PTW: semua proyek tempat ia pernah/sedang
 * ditugaskan sebagai Pengawas, plus proyek yang ia awasi sebagai inspector.
 * Berbeda dari My Task (yang hanya memuat pekerjaan yang masih harus
 * dilakukan), halaman ini tetap menampilkan proyek setelah daily check hari
 * itu selesai atau PTW-nya ditutup.
 */
export default async function MyProjectsPage() {
  if (!(await hasPermission('ptw', 'field_pengawas'))) redirect('/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [{ data: assignments }, { data: inspectorProjects }] = await Promise.all([
    supabase.from('ptw_field_assignments').select('ptw_id, aktif_sampai').eq('user_id', user.id).eq('peran', 'pengawas'),
    supabase.from('projects').select('id').eq('assigned_inspector', user.id),
  ]);

  const myPtwIds = (assignments || []).map((a: any) => a.ptw_id);
  const activeAssignment = new Set((assignments || []).filter((a: any) => a.aktif_sampai === null).map((a: any) => a.ptw_id));

  const { data: myPtws } = myPtwIds.length > 0
    ? await supabase.from('ptw').select('id, project_id').in('id', myPtwIds)
    : { data: [] as any[] };

  const projectIds = Array.from(new Set([
    ...(myPtws || []).map((p: any) => p.project_id),
    ...(inspectorProjects || []).map((p: any) => p.id),
  ]));

  const { data: projects } = projectIds.length > 0
    ? await supabase
        .from('projects')
        .select(`
          id, name, location, start_date, end_date, status, risk_level, completion_requested_at,
          vendor_profiles ( company_name ),
          procedures ( status ),
          jsa ( status ),
          ptw ( id, status, ptw_type, ptw_number, valid_to )
        `)
        .in('id', projectIds)
    : { data: [] as any[] };

  const rows = (projects || []).map((project: any) => {
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    const procedure = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
    const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
    const vendor = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;
    const mine = ptws.filter(p => myPtwIds.includes(p.id));
    const hasActive = mine.some(p => activeAssignment.has(p.id));
    return {
      project, vendor, mine, hasActive,
      stage: getProjectStage({
        procedureStatus: procedure?.status,
        jsaStatus: jsa?.status,
        ptws: ptws.map(p => ({ status: p.status, valid_to: p.valid_to })),
        projectStatus: project.status,
        endDate: project.end_date,
        completionRequested: !!project.completion_requested_at,
      }),
    };
  }).sort((a, b) => Number(b.hasActive) - Number(a.hasActive) || a.project.name.localeCompare(b.project.name));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <HardHat className="w-8 h-8 text-primary" /> Proyek Saya
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Proyek yang Anda awasi sebagai Pengawas PTW. Tetap tampil setelah tugas harian selesai.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
          Belum ada proyek yang Anda awasi. Proyek akan muncul di sini setelah Anda ditugaskan sebagai Pengawas PTW.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map(({ project, vendor, mine, hasActive, stage }) => {
            const risk = parseRiskLevel(project.risk_level);
            return (
              <div key={project.id} className={`border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col ${riskCardClasses(project.risk_level)}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {risk && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${RISK_META[risk].badge}`}>{RISK_META[risk].label}</span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${hasActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {hasActive ? 'Sedang Mengawasi' : 'Riwayat'}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-2">{project.name}</h3>
                <div className="flex items-center gap-1.5 text-sm text-primary font-semibold mb-3">
                  <Building2 className="w-4 h-4" /> {vendor?.company_name || 'Tanpa Vendor'}
                </div>

                <span className={`self-start text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border mb-4 ${STAGE_TONE_CLASS[stage.tone]}`}>{stage.label}</span>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {project.location || '-'}</div>
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400 shrink-0" /> {project.start_date || '-'} s/d {project.end_date || '-'}</div>
                </div>

                {mine.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {mine.map((p: any) => {
                      const title = PTW_TYPES.find(t => t.id === p.ptw_type)?.title.split('(')[0].trim() || p.ptw_type;
                      const effective = getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date);
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-white/70 border border-slate-200 rounded-lg px-2.5 py-1.5">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-700 min-w-0"><Stamp className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{title}{p.ptw_number ? ` · ${p.ptw_number}` : ''}</span></span>
                          <span className={`shrink-0 font-bold ${effective === PTW_STATUS.aktif ? 'text-emerald-600' : 'text-slate-500'}`}>{effective}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Link
                  href={`/dashboard/projects/${encodeURIComponent(project.id)}`}
                  className="mt-auto flex items-center justify-center gap-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 py-2.5 rounded-xl transition-colors"
                >
                  Buka Proyek <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

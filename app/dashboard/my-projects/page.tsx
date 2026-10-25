import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Calendar, Building2, ArrowRight, Stamp, HardHat } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getEffectivePtwStatus, PTW_STATUS } from '@/lib/ptw-status';
import { PTW_TYPES } from '@/lib/ptw-types';
import { getProjectStage, STAGE_TONE_CLASS } from '@/lib/project-stage';
import { RISK_META, parseRiskLevel } from '@/lib/project-risk';
import { DataTable, DataHead, EmptyRow, ROW_CLS, CELL_CLS, ACTION_LINK_CLS } from '@/components/ui/data-table';

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
        <DataTable minWidth={1000}>
          <DataHead columns={[
            { label: 'Proyek' }, { label: 'Vendor' }, { label: 'Tahap' }, { label: 'Lokasi / Periode' }, { label: 'PTW Saya' }, { label: 'Peran' }, { label: 'Aksi', className: 'text-right' },
          ]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ project, vendor, mine, hasActive, stage }) => {
              const risk = parseRiskLevel(project.risk_level);
              return (
                <tr key={project.id} className={ROW_CLS}>
                  <td className={`${CELL_CLS} max-w-xs`}>
                    <p className="font-semibold text-slate-800 line-clamp-2">{project.name}</p>
                    {risk && (
                      <span className={`mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${RISK_META[risk].badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_META[risk].dot}`} />{RISK_META[risk].label}
                      </span>
                    )}
                  </td>
                  <td className={`${CELL_CLS} text-slate-600`}>
                    <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />{vendor?.company_name || 'Tanpa Vendor'}</span>
                  </td>
                  <td className={CELL_CLS}>
                    <span className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${STAGE_TONE_CLASS[stage.tone]}`}>{stage.label}</span>
                  </td>
                  <td className={`${CELL_CLS} text-xs text-slate-600 space-y-1`}>
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.location || '-'}</div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.start_date || '-'} s/d {project.end_date || '-'}</div>
                  </td>
                  <td className={CELL_CLS}>
                    <div className="space-y-1">
                      {mine.length === 0 && <span className="text-xs text-slate-400">—</span>}
                      {mine.map((p: any) => {
                        const title = PTW_TYPES.find(t => t.id === p.ptw_type)?.title.split('(')[0].trim() || p.ptw_type;
                        const effective = getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date);
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="flex items-center gap-1.5 font-semibold text-slate-700 min-w-0"><Stamp className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{title}{p.ptw_number ? ` · ${p.ptw_number}` : ''}</span></span>
                            <span className={`shrink-0 font-bold ${effective === PTW_STATUS.aktif ? 'text-emerald-600' : 'text-slate-500'}`}>{effective}</span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className={CELL_CLS}>
                    <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${hasActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {hasActive ? 'Sedang Mengawasi' : 'Riwayat'}
                    </span>
                  </td>
                  <td className={`${CELL_CLS} text-right`}>
                    <Link href={`/dashboard/projects/${encodeURIComponent(project.id)}`} className={`${ACTION_LINK_CLS} text-primary bg-primary/10 border-primary/20 hover:bg-primary/20`}>
                      Buka <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

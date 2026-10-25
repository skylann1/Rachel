import { getAllProjectsWithRelations } from '@/app/dashboard/approval/actions';
import React from 'react';
import Link from 'next/link';
import { Rocket, MapPin, Calendar, FileText } from 'lucide-react';
import { PTW_STATUS } from '@/lib/ptw-status';
import { DataTable, DataHead, EmptyRow, ROW_CLS, CELL_CLS, ACTION_LINK_CLS } from '@/components/ui/data-table';

export default async function OngoingProjectsPage() {
  const projects = await getAllProjectsWithRelations();

  // A project is ongoing if ANY of its PTWs is active or paused by a Stop
  // Work Authority (fieldwork can be under way with one permit type even
  // while another type is still pending) and project status is not completed.
  const ongoingProjects = projects.filter(project => {
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    return ptws.some(p => p.status === PTW_STATUS.aktif || p.status === PTW_STATUS.stoppedSwa) && project.status !== 'Completed';
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Rocket className="w-8 h-8 text-primary" /> Proyek Berjalan
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar proyek yang dokumen PTW-nya sudah diterbitkan dan sedang dalam tahap pengerjaan. <b className="text-slate-700">{ongoingProjects.length}</b> proyek.
        </p>
      </div>

      <DataTable minWidth={900}>
        <DataHead columns={[
          { label: 'Proyek' }, { label: 'Vendor' }, { label: 'Lokasi' }, { label: 'Periode' }, { label: 'PTW' }, { label: 'Aksi', className: 'text-right' },
        ]} />
        <tbody className="divide-y divide-slate-100">
          {ongoingProjects.length === 0 && <EmptyRow colSpan={6}>Tidak ada proyek yang sedang berjalan saat ini.</EmptyRow>}
          {ongoingProjects.map(project => {
            const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
            const activeNumbers = ptws.filter(p => p.status === PTW_STATUS.aktif).map(p => p.ptw_number).filter(Boolean);
            const isStopped = ptws.some(p => p.status === PTW_STATUS.stoppedSwa);
            const vendorName = Array.isArray(project.vendor_profiles) ? (project.vendor_profiles as any)[0]?.company_name : (project.vendor_profiles as any)?.company_name;
            return (
              <tr key={project.id} className={ROW_CLS}>
                <td className={`${CELL_CLS} max-w-xs`}>
                  <p className="font-semibold text-slate-800 line-clamp-2">{project.name}</p>
                </td>
                <td className={`${CELL_CLS} text-slate-600`}>{vendorName || 'Vendor Tidak Ditemukan'}</td>
                <td className={`${CELL_CLS} text-xs text-slate-600`}>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.location || '-'}</span>
                </td>
                <td className={`${CELL_CLS} text-xs text-slate-600 whitespace-nowrap`}>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.start_date} s/d {project.end_date}</span>
                </td>
                <td className={CELL_CLS}>
                  <div className="flex flex-wrap gap-1.5">
                    {isStopped && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 uppercase">Stop Work</span>}
                    {activeNumbers.length > 0
                      ? activeNumbers.map((n: string) => <span key={n} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">{n}</span>)
                      : !isStopped && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">PTW Aktif</span>}
                  </div>
                </td>
                <td className={`${CELL_CLS} text-right`}>
                  <Link href={`/dashboard/projects/${project.id}`} className={`${ACTION_LINK_CLS} text-primary bg-primary/10 border-primary/20 hover:bg-primary/20`}>
                    <FileText className="w-3.5 h-3.5" /> Lihat Detail
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}

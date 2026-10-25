import { getAllProjectsWithRelations } from '@/app/dashboard/approval/actions';
import React from 'react';
import Link from 'next/link';
import { Archive, MapPin, Calendar, FileText } from 'lucide-react';
import { DataTable, DataHead, EmptyRow, ROW_CLS, CELL_CLS, ACTION_LINK_CLS } from '@/components/ui/data-table';

export default async function ArchiveProjectsPage() {
  const projects = await getAllProjectsWithRelations();

  // A project is archived if its status is 'Completed'
  const archivedProjects = projects.filter(project => project.status === 'Completed' || project.status === 'Selesai');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Archive className="w-8 h-8 text-slate-400" /> Arsip Proyek
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar riwayat proyek yang telah selesai dikerjakan. <b className="text-slate-700">{archivedProjects.length}</b> proyek.
        </p>
      </div>

      <DataTable minWidth={820}>
        <DataHead columns={[
          { label: 'Proyek' }, { label: 'Vendor' }, { label: 'Lokasi' }, { label: 'Periode' }, { label: 'Status' }, { label: 'Aksi', className: 'text-right' },
        ]} />
        <tbody className="divide-y divide-slate-100">
          {archivedProjects.length === 0 && <EmptyRow colSpan={6}>Belum ada proyek yang masuk ke arsip.</EmptyRow>}
          {archivedProjects.map(project => {
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
                  <span className="inline-block bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Selesai</span>
                </td>
                <td className={`${CELL_CLS} text-right`}>
                  <Link href={`/dashboard/projects/${project.id}`} className={`${ACTION_LINK_CLS} text-slate-600 bg-white border-slate-200 hover:bg-slate-100`}>
                    <FileText className="w-3.5 h-3.5" /> Riwayat Dokumen
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

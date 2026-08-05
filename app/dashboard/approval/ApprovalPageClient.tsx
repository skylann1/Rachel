'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

interface ApprovalPageClientProps {
  userRole: string;
  projects: any[];
}

export default function ApprovalPageClient({ userRole, projects }: ApprovalPageClientProps) {
  const router = useRouter();

  const pendingProjects = projects.filter(project => {
    const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
    const isCompleted = project.status === 'Completed' || project.status === 'Selesai';
    const isActive = ptw?.status === 'PTW Aktif';
    return !isCompleted && !isActive;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Verifikasi &amp; Approval</h1>
        <p className="text-sm text-slate-500 mt-1">Daftar proyek yang membutuhkan peninjauan dokumen K3 Anda saat ini.</p>
      </div>

      {/* Role Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
        <ShieldAlert className="w-3.5 h-3.5" />
        Anda login sebagai: <span className="uppercase">{userRole}</span>
      </div>

      {/* Project List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nama Proyek / Vendor</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prosedur</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">JSA</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">PTW</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendingProjects.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">Hore! Tidak ada dokumen yang perlu direview saat ini.</td></tr>
            ) : pendingProjects.map(project => {
              const proc = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
              const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
              const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;

              const getStatus = (doc: any) => {
                if (!doc) return <span className="text-xs text-slate-400">Belum Ada</span>;
                if (doc.status.includes('Disetujui') || doc.status === 'PTW Aktif') return <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Disetujui</span>;
                if (doc.status === 'Draft' || doc.rejection_note) return <span className="text-xs text-rose-500 font-bold">Revisi</span>;
                return <span className="text-xs font-bold text-amber-500">{doc.status}</span>;
              };

              return (
                <tr key={project.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-sm text-slate-800">{project.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{project.vendor_profiles?.company_name || 'Internal'}</p>
                  </td>
                  <td className="px-6 py-4">{getStatus(proc)}</td>
                  <td className="px-6 py-4">{getStatus(jsa)}</td>
                  <td className="px-6 py-4">{getStatus(ptw)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                    >
                      <FileSignature className="w-3.5 h-3.5" /> Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

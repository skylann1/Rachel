import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';
import { getPgsolProjects } from './actions';

export default async function PgsolProjectsPage() {
  // Gerbang yang sama dengan savePgsolAssignment — pgsol_reviewer biasa tidak
  // boleh menelusuri daftar proyek untuk penunjukan (mengikuti pola halaman
  // /pgsol/dashboard/staff).
  if (!(await hasPermission('jsa', 'manage_assignment_pgsol'))) redirect('/pgsol/dashboard');

  const projects = await getPgsolProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Proyek</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola siapa yang mereview JSA tahap PGSOL untuk tiap proyek.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Proyek</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
              <th className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {projects.map((p: any) => {
              const vendor = Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0] : p.vendor_profiles;
              return (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{vendor?.company_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/pgsol/dashboard/projects/${p.id}/assign`} className="text-primary text-sm font-semibold hover:underline">
                      Kelola Reviewer
                    </Link>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada proyek dengan JSA diajukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Search, CheckCircle2, ShieldOff, XCircle } from 'lucide-react';
import AccountFilters from '@/app/dashboard/master-data/account/AccountFilters';
import AddAccountButton from '@/app/dashboard/master-data/account/AddAccountButton';
import AccountActions from '@/app/dashboard/master-data/account/AccountActions';

interface Account {
  id: string; name: string; email: string; role: string; type: string;
  verified: boolean; status: string; companyName: string | null; nip: string | null;
  jabatan: string | null;
  lastLogin: string; registeredAt: string;
}

export function AccountTable({
  accounts, roles, page, totalPages, totalItems, offset, limit,
  search, role, status, basePath, title, subtitle, lockedType,
}: {
  accounts: Account[]; roles: any[]; page: number; totalPages: number;
  totalItems: number; offset: number; limit: number;
  search: string; role: string; status: string; basePath: string;
  title: string; subtitle: string; lockedType?: 'pgn' | 'pgsol' | 'vendor';
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <AddAccountButton roles={roles} lockedType={lockedType} />
      </div>

      <AccountFilters initialSearch={search} initialRole={role} initialStatus={status} roles={roles} />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pengguna</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role & Tipe</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Verifikasi</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status Akun</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Login Terakhir</th>
                <th scope="col" className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {accounts.length > 0 ? accounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {account.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{account.name}</div>
                        <div className="text-xs text-slate-500">{account.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {account.role}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{account.type}</span>
                      {account.jabatan && <span className="text-xs text-slate-500">{account.jabatan}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.verified ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Terverifikasi
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <ShieldOff className="w-3.5 h-3.5 mr-1" />Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${account.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {account.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                      {account.status === 'Active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{account.lastLogin}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <AccountActions account={account} roles={roles} lockedType={lockedType} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-sm font-medium">Data tidak ditemukan</p>
                      <p className="text-xs mt-1">Cobalah menggunakan filter atau kata kunci lain.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalItems > 0 && (
          <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Menampilkan <span className="font-medium">{offset + 1}</span> sampai <span className="font-medium">{Math.min(offset + limit, totalItems)}</span> dari <span className="font-medium">{totalItems}</span> hasil
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <Link href={`${basePath}?page=${page > 1 ? page - 1 : 1}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium ${page <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}>Previous</Link>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Link key={i + 1} href={`${basePath}?page=${i + 1}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-4 py-2 border ${page === i + 1 ? 'border-primary bg-primary/10 text-primary z-10' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} text-sm font-medium`}>{i + 1}</Link>
                  ))}
                  <Link href={`${basePath}?page=${page < totalPages ? page + 1 : totalPages}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium ${page >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}>Next</Link>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

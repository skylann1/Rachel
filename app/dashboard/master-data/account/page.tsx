import React from 'react';
import Link from 'next/link';
import { Search, Plus, MoreVertical, ShieldOff, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { redirect } from 'next/navigation';
import AccountFilters from './AccountFilters';
import AddAccountButton from './AddAccountButton';
import AccountActions from './AccountActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountManagementPage(props: { searchParams?: Promise<{ page?: string, search?: string, role?: string, status?: string }> }) {
  const isAllowed = await hasPermission('masterData', 'view_account');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams?.page || '1');
  const search = searchParams?.search || '';
  const role = searchParams?.role || '';
  const status = searchParams?.status || '';

  const limit = 5;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // 4. Fetch Roles
  const { data: roles } = await supabase.from('roles').select('name, is_system, type').order('name');
  const availableRoles = roles || [];

  let query = supabase.from('profiles').select(`
    *,
    vendor_profiles(company_name),
    internal_profiles(nip)
  `, { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (role) {
    query = query.eq('role', role);
  }
  if (status) {
    if (status === 'active') {
      query = query.eq('status', 'Active');
    } else if (status === 'inactive') {
      query = query.eq('status', 'Inactive');
    }
  }

  const { data: profiles, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / limit);

  // If no profiles are found, return empty array instead of mock data
  const accounts = profiles ? profiles.map(p => ({
    id: p.id,
    name: p.full_name,
    email: p.email || 'Menunggu Sinkronisasi',
    role: p.role,
    type: p.type, // 'internal' or 'external'
    verified: !!p.email_confirmed_at,
    status: p.status || 'Active', // Read from DB now
    companyName: Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0]?.company_name : p.vendor_profiles?.company_name || null,
    nip: Array.isArray(p.internal_profiles) ? p.internal_profiles[0]?.nip : p.internal_profiles?.nip || null,
    lastLogin: p.last_sign_in_at 
      ? new Date(p.last_sign_in_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : 'Belum Pernah Login',
    registeredAt: new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
  })) : [];
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Akun</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data pengguna, peran, dan akses sistem.</p>
        </div>
        <AddAccountButton roles={availableRoles} />
      </div>

      {/* Filter and Search Bar */}
      <AccountFilters initialSearch={search} initialRole={role} initialStatus={status} roles={availableRoles} />

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pengguna
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Role & Tipe
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Verifikasi
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status Akun
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Login Terakhir
                </th>
                <th scope="col" className="relative px-6 py-4">
                  <span className="sr-only">Aksi</span>
                </th>
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
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {account.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.verified ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Terverifikasi
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <ShieldOff className="w-3.5 h-3.5 mr-1" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      account.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {account.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                      {account.status === 'Active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {account.lastLogin}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <AccountActions account={account} roles={availableRoles} />
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
        {/* Pagination */}
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
                  <Link
                    href={`/dashboard/master-data/account?page=${page > 1 ? page - 1 : 1}&search=${search}&role=${role}&status=${status}`}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium ${page <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Previous
                  </Link>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Link
                      key={i + 1}
                      href={`/dashboard/master-data/account?page=${i + 1}&search=${search}&role=${role}&status=${status}`}
                      className={`relative inline-flex items-center px-4 py-2 border ${page === i + 1 ? 'border-primary bg-primary/10 text-primary z-10' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} text-sm font-medium`}
                    >
                      {i + 1}
                    </Link>
                  ))}
                  <Link
                    href={`/dashboard/master-data/account?page=${page < totalPages ? page + 1 : totalPages}&search=${search}&role=${role}&status=${status}`}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium ${page >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Next
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

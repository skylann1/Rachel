import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { redirect } from 'next/navigation';
import { AccountTable } from '@/components/org/AccountTable';

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
  const { data: roles, error: rolesError } = await supabase.from('roles').select('name, is_system, type').order('name');
  if (rolesError) console.error('Gagal memuat daftar role:', rolesError.message);
  const availableRoles = roles || [];

  // Nama perusahaan sekarang dibaca dari `organizations` lewat
  // `profiles.org_id`, bukan lagi dari embed `vendor_profiles` — FK
  // vendor_profiles.id -> profiles.id sudah dilepas (lihat
  // schema_org_backfill_vendor.sql), jadi PostgREST tidak bisa lagi
  // menyimpulkan relasi profiles <-> vendor_profiles.
  let query = supabase.from('profiles').select(`
    *,
    organizations(name),
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
    companyName: (Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name) || null,
    nip: Array.isArray(p.internal_profiles) ? p.internal_profiles[0]?.nip : p.internal_profiles?.nip || null,
    lastLogin: p.last_sign_in_at
      ? new Date(p.last_sign_in_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Belum Pernah Login',
    registeredAt: new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
  })) : [];

  return (
    <AccountTable
      accounts={accounts}
      roles={availableRoles}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      offset={offset}
      limit={limit}
      search={search}
      role={role}
      status={status}
      basePath="/dashboard/master-data/account"
      title="Manajemen Akun"
      subtitle="Kelola data pengguna, peran, dan akses sistem."
    />
  );
}

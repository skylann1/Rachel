import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { AccountTable } from '@/components/org/AccountTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VendorStaffPage(props: { searchParams?: Promise<{ page?: string, search?: string, role?: string, status?: string }> }) {
  const allowed = (await hasPermission('masterData', 'manage_org_staff')) || (await hasPermission('masterData', 'manage_account'));
  if (!allowed) redirect('/vendor/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  const orgId = callerProfile?.org_id;
  if (!orgId) redirect('/vendor/dashboard');

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams?.page || '1');
  const search = searchParams?.search || '';
  const role = searchParams?.role || '';
  const status = searchParams?.status || '';
  const limit = 5;
  const offset = (page - 1) * limit;

  const { data: roles } = await supabase.from('roles').select('name, is_system, type').eq('type', 'vendor').order('name');
  const availableRoles = roles || [];

  // Nama perusahaan dibaca dari `organizations` lewat `profiles.org_id`:
  // relasi profiles <-> vendor_profiles sudah tidak ada lagi sejak FK
  // vendor_profiles.id dipindah ke organizations (schema_org_backfill_vendor.sql).
  let query = supabase.from('profiles').select(`*, organizations(name), internal_profiles(nip)`, { count: 'exact' }).eq('org_id', orgId);
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (role) query = query.eq('role', role);
  if (status === 'active') query = query.eq('status', 'Active');
  if (status === 'inactive') query = query.eq('status', 'Inactive');

  const { data: profiles, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / limit);

  const accounts = (profiles || []).map(p => ({
    id: p.id, name: p.full_name, email: p.email || 'Menunggu Sinkronisasi', role: p.role, type: p.type,
    verified: !!p.email_confirmed_at, status: p.status || 'Active',
    companyName: (Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name) || null,
    nip: Array.isArray(p.internal_profiles) ? p.internal_profiles[0]?.nip : p.internal_profiles?.nip || null,
    lastLogin: p.last_sign_in_at ? new Date(p.last_sign_in_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum Pernah Login',
    registeredAt: new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
  }));

  return (
    <AccountTable
      accounts={accounts} roles={availableRoles} page={page} totalPages={totalPages}
      totalItems={totalItems} offset={offset} limit={limit} search={search} role={role} status={status}
      basePath="/vendor/dashboard/staff" title="Staff Perusahaan" subtitle="Kelola akun staff di perusahaan Anda."
      lockedType="vendor"
    />
  );
}

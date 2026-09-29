import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { redirect } from 'next/navigation';
import { AccountTable } from '@/components/org/AccountTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountManagementPage(props: { searchParams?: Promise<{ page?: string, search?: string, role?: string, status?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id, type').eq('id', user?.id).single();
  const actorType = actorProfile?.type ?? null;

  // `crossOrg` butuh KEDUA hal: permission `view_account` ATAU `manage_account`
  // (lihat di bawah), DAN tipe organisasi aktor sendiri = 'pgn'. Permission
  // saja tidak cukup — `view_account` sengaja allowedTypes: ['pgn','pgsol'],
  // jadi kalau hanya dicek lewat permission, sebuah role PGSOL yang diberi
  // view_account lewat halaman Role & Permission (aksi UI biasa, bukan bypass
  // SQL) akan melihat akun SEMUA organisasi. Pola ini sama dengan
  // requireRoleAccess() di role/actions.ts, yang juga menuntut
  // actor.type === 'pgn' selain permission-nya.
  const hasViewOrManage = (await hasPermission('masterData', 'view_account')) || (await hasPermission('masterData', 'manage_account'));
  const crossOrg = hasViewOrManage && actorType === 'pgn';
  const orgScoped = crossOrg || await hasPermission('masterData', 'manage_org_staff');
  if (!orgScoped) {
    redirect('/dashboard');
  }

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams?.page || '1');
  const search = searchParams?.search || '';
  const role = searchParams?.role || '';
  const status = searchParams?.status || '';

  const limit = 5;
  const offset = (page - 1) * limit;

  // Aktor org-scoped (bukan crossOrg) cuma boleh melihat staff & role dari
  // organisasi/tipe miliknya sendiri — org_id diambil dari profil aktor
  // sendiri, tidak pernah dari input klien. Mirrors assertSameOrg() di
  // actions.ts (dieksekusi lagi di sana pada tiap mutasi; di sini cuma
  // buat query listing).
  let actorOrgId: string | null = null;
  if (!crossOrg) {
    actorOrgId = actorProfile?.org_id ?? null;

    // Fail closed: aktor org-scoped tanpa org_id (profil rusak / belum
    // ditautkan) tidak boleh melihat siapa pun, bukan malah lihat semua.
    if (!actorOrgId) {
      return (
        <AccountTable
          accounts={[]}
          roles={[]}
          page={1}
          totalPages={0}
          totalItems={0}
          offset={0}
          limit={limit}
          search={search}
          role={role}
          status={status}
          basePath="/dashboard/master-data/account"
          title="Staff Organisasi"
          subtitle="Organisasi Anda belum tertaut. Hubungi administrator."
        />
      );
    }
  }

  // Fetch Roles — org-scoped aktor cuma lihat role dari tipe organisasinya
  // sendiri, sama seperti dropdown filter yang sebelumnya di halaman
  // /pgsol/dashboard/staff. `type` kolom teks (bukan uuid), jadi sentinel
  // '__none__' aman dipakai kalau actorType entah kenapa kosong — hasilnya
  // nol baris, bukan error tipe.
  let rolesQuery = supabase.from('roles').select('name, is_system, type').order('name');
  if (!crossOrg) {
    rolesQuery = rolesQuery.eq('type', actorType ?? '__none__');
  }
  const { data: roles, error: rolesError } = await rolesQuery;
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

  if (!crossOrg) {
    query = query.eq('org_id', actorOrgId as string);
  }
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

  const accounts = profiles ? profiles.map(p => ({
    id: p.id,
    name: p.full_name,
    email: p.email || 'Menunggu Sinkronisasi',
    role: p.role,
    type: p.type,
    verified: !!p.email_confirmed_at,
    status: p.status || 'Active',
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
      title={crossOrg ? "Manajemen Akun" : "Staff Organisasi"}
      subtitle={crossOrg ? "Kelola data pengguna, peran, dan akses sistem." : "Kelola akun staff di organisasi Anda."}
      lockedType={crossOrg ? undefined : (actorType as 'pgn' | 'pgsol' | 'vendor' | undefined)}
    />
  );
}

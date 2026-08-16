import { createClient } from '@/utils/supabase/server';
import { allPermissionModules } from '@/app/dashboard/master-data/role/constants';

/**
 * Role 'admin' selalu dianggap akses penuh, terlepas dari isi kolom
 * roles.permissions — konsisten dengan deskripsi role itu sendiri
 * ("Akses penuh ke seluruh sistem") dan dengan bypass 'admin' yang
 * sebelumnya di-hardcode di banyak tempat (requireRole, getMyTasks, dst).
 * Disintesis dari allPermissionModules supaya selalu mengikuti modul/aksi
 * yang benar-benar ada, tanpa perlu diketik ulang di sini.
 */
function fullAccessPermissions(): Record<string, string[]> {
  const full: Record<string, string[]> = {};
  for (const mod of allPermissionModules) {
    full[mod.id] = mod.items.map((item: any) => item.key);
  }
  return full;
}

/**
 * Inti pengecekan permission: baca role pengguna dari `profiles`, lalu
 * cocokkan dengan kolom `permissions` (JSONB) milik role tersebut di
 * tabel `roles`. Menerima supabase client + userId yang sudah ada supaya
 * bisa dipakai ulang di dalam server action tanpa fetch auth berkali-kali.
 */
export async function getUserPermissionsForUser(supabase: any, userId: string): Promise<Record<string, string[]> | null> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (!profile?.role) return null;
  if (profile.role === 'admin') return fullAccessPermissions();

  const { data: roleData } = await supabase.from('roles').select('permissions').eq('name', profile.role).single();
  return roleData?.permissions || null;
}

export async function hasPermissionForUser(supabase: any, userId: string, module: string, action: string): Promise<boolean> {
  const permissions = await getUserPermissionsForUser(supabase, userId);
  const modulePerms = permissions?.[module];
  return Array.isArray(modulePerms) && modulePerms.includes(action);
}

/**
 * Cari semua nama role yang punya permission tertentu — dipakai untuk
 * menentukan siapa yang harus dinotifikasi pada suatu tahap approval,
 * tanpa hardcode nama role di pemanggilnya (lihat notifyUsersByPermission
 * di app/dashboard/inbox/actions.ts).
 */
export async function getRoleNamesWithPermission(supabase: any, module: string, action: string): Promise<string[]> {
  const { data } = await supabase.from('roles').select('name, permissions');
  return (data || [])
    .filter((r: any) => Array.isArray(r.permissions?.[module]) && r.permissions[module].includes(action))
    .map((r: any) => r.name as string);
}

/**
 * Memeriksa apakah user yang sedang login memiliki hak akses tertentu.
 * Digunakan pada Server Components / Server Actions.
 *
 * @param module Nama modul (misal: 'masterData', 'jsa')
 * @param action Aksi yang ingin dilakukan (misal: 'view_vendor', 'manage_account')
 * @returns boolean true jika diizinkan, false jika ditolak
 */
export async function hasPermission(module: string, action: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return hasPermissionForUser(supabase, user.id, module, action);
}

/**
 * Memeriksa permissions secara massal.
 * Mengembalikan seluruh object permissions milik user tersebut.
 */
export async function getUserPermissions(): Promise<Record<string, string[]> | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserPermissionsForUser(supabase, user.id);
}

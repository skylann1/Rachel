import { createClient } from '@/utils/supabase/server';

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

  // 1. Dapatkan role user dari tabel profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.role) return false;

  // 2. Dapatkan JSON permissions dari tabel roles berdasarkan nama role
  const { data: roleData } = await supabase
    .from('roles')
    .select('permissions, is_system')
    .eq('name', profile.role)
    .single();

  if (!roleData || !roleData.permissions) return false;

  // 3. Periksa apakah modul dan aksi ada di dalam JSON permissions
  const modulePerms = roleData.permissions[module];
  if (!Array.isArray(modulePerms)) return false;

  return modulePerms.includes(action);
}

/**
 * Memeriksa permissions secara massal.
 * Mengembalikan seluruh object permissions milik user tersebut.
 */
export async function getUserPermissions(): Promise<Record<string, string[]> | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !profile.role) return null;

  const { data: roleData } = await supabase.from('roles').select('permissions').eq('name', profile.role).single();
  
  return roleData?.permissions || null;
}

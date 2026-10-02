// lib/role-access.ts
//
// Helper bersama untuk gate akses role — dipakai baik oleh
// app/dashboard/master-data/role/actions.ts maupun
// app/dashboard/master-data/role/[id]/actions.ts. Bukan Server Action
// sendiri (tidak ada "use server" di sini): setiap fungsi yang diekspor
// dari modul "use server" otomatis terdaftar sebagai Server Action (POST
// endpoint) yang bisa dipanggil klien mana pun. assertSameRoleType()
// menerima parameter `adminAuthClient` (objek Supabase admin client hidup)
// yang tidak pernah bisa selamat lewat serialisasi panggilan Server Action
// sungguhan — kalau fungsi ini tetap diekspor dari file "use server", itu
// jadi endpoint publik yang tidak sengaja dibuat, tanpa try/catch, siap
// melempar unhandled exception. Pola ini sama dengan
// lib/stage-assignments.ts, yang juga sengaja tidak diberi "use server".

import { createAdminClient } from '@/utils/supabase/admin';

export interface RoleActor {
  userId: string;
  type: string | null; // tipe organisasi aktor sendiri ('pgn' | 'pgsol' | 'vendor')
  crossOrg: boolean; // true kalau aktor bertipe 'pgn' — boleh kelola role tipe apa pun
}

export type AssertSameRoleTypeResult =
  | { error: string; targetType?: undefined }
  | { error: null; targetType: string | null };

/**
 * Menolak mutasi kalau role target bukan tipe aktor sendiri atau role
 * sistem, kecuali aktor crossOrg. Pada sukses, juga mengembalikan
 * `targetType` (tipe role target seperti tersimpan di DB) supaya caller
 * yang butuh nilai itu (mis. cek pemindahan tipe) tidak perlu SELECT
 * `roles` kedua kalinya untuk baris yang sama.
 */
export async function assertSameRoleType(adminAuthClient: ReturnType<typeof createAdminClient>, actor: RoleActor, roleId: string): Promise<AssertSameRoleTypeResult> {
  if (actor.crossOrg) return { error: null, targetType: null };
  const { data: target } = await adminAuthClient.from('roles').select('type, is_system').eq('id', roleId).single();
  if (!target || target.type !== actor.type) {
    return { error: 'Role ini bukan bagian dari organisasi Anda.' };
  }
  if (target.is_system) {
    return { error: 'Role sistem tidak dapat diubah dari halaman ini.' };
  }
  return { error: null, targetType: target.type };
}

/**
 * `allowedTypes` per item di allPermissionModules (constants.ts) cuma
 * menyaring checkbox mana yang MUNCUL di UI RolePermissionsClient — tidak
 * ada apa pun di level server yang pernah menegakkan aturan itu sebelum
 * ini. Tanpa fungsi ini, permintaan updateRolePermissions yang di-craft
 * langsung (bukan lewat checkbox UI) bisa menyimpan role bertipe 'vendor'
 * dengan permission pgn-only seperti masterData.manage_role, dan
 * hasPermissionForUser akan tetap mengabulkannya karena ia cuma mengecek
 * keanggotaan JSONB, tidak pernah membandingkan ke allowedTypes.
 *
 * Membuang (bukan menolak) key yang tidak sesuai `roleType` — permintaan
 * sah lewat UI tidak pernah mengirim key di luar allowedTypes-nya sendiri,
 * jadi ini no-op untuk pemakaian normal dan cuma menutup jalur yang
 * di-craft manual.
 */
export function sanitizePermissionsForType(
  permissions: Record<string, string[]>,
  roleType: string,
  allPermissionModules: { id: string; items: { key: string; allowedTypes: string[] }[] }[]
): Record<string, string[]> {
  const sanitized: Record<string, string[]> = {};
  for (const mod of allPermissionModules) {
    const keys = permissions?.[mod.id];
    if (!Array.isArray(keys)) continue;
    const allowedKeys = new Set(
      mod.items.filter((item) => item.allowedTypes.includes(roleType)).map((item) => item.key)
    );
    const filtered = keys.filter((k) => allowedKeys.has(k));
    if (filtered.length > 0) sanitized[mod.id] = filtered;
  }
  return sanitized;
}

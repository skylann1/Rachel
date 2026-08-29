import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * `vendor_id` di projects/vendor_workers/vendor_equipment/vendor_materials/
 * vendor_documents sekarang menyimpan id ORGANISASI vendor (lihat
 * schema_org_backfill_vendor.sql), bukan lagi id user yang login — semua
 * query/insert vendor yang tadinya memakai `user.id` langsung harus lewat
 * sini supaya staff mana pun di company yang sama tetap melihat data yang
 * sama, konsisten dengan RLS di schema_org_rls_vendor_scope.sql.
 */
export async function getCallerVendorOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  return profile?.org_id ?? null;
}

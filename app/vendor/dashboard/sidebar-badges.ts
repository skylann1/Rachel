"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";
import { getVendorMyTasks } from "@/app/vendor/dashboard/my-task/actions";

export interface VendorSidebarBadges {
  myTask: number;
  projects: number;
}

const EMPTY: VendorSidebarBadges = { myTask: 0, projects: 0 };

/**
 * Angka badge sidebar portal vendor. `projects` meniru filter "Berjalan"
 * di halaman Proyek Saya (status != 'Selesai') supaya angkanya tidak
 * menyimpang dari isi halaman.
 */
export async function getVendorSidebarBadges(): Promise<VendorSidebarBadges> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const orgId = await getCallerVendorOrgId(supabase);

  const [tasks, projects] = await Promise.all([
    getVendorMyTasks().catch(() => []),
    orgId
      ? supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', orgId)
          .neq('status', 'Selesai')
      : Promise.resolve({ count: 0 }),
  ]);

  return { myTask: tasks.length, projects: projects.count || 0 };
}

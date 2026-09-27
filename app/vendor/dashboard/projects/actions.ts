"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";

// Mirrors the former server-component fetch on this page, but scoped to the
// calling vendor org so RLS never leaks other vendors' projects.
export async function getVendorProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const vendorOrgId = await getCallerVendorOrgId(supabase);
  if (!vendorOrgId) return [];

  const { data } = await supabase
    .from('projects')
    .select(`
      id, name, description, location, start_date, end_date, status, progress, contract_number,
      procedures(status), jsa(status), ptw(status, valid_to)
    `)
    .eq('vendor_id', vendorOrgId)
    .order('created_at', { ascending: false });

  return data || [];
}
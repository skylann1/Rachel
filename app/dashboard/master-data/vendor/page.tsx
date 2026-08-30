import React from 'react';
import { createClient } from '@/utils/supabase/server';
import VendorPageClient from './VendorPageClient';

export const metadata = {
  title: 'Data Vendor - RACHEL K3',
};

export default async function VendorManagementPage() {
  const supabase = await createClient();

  // `vendor_profiles.id` sekarang adalah id ORGANISASI (lihat
  // schema_org_backfill_vendor.sql) dan FK-nya ke `profiles` sudah dilepas,
  // jadi embed `profiles(...)` tidak bisa lagi disimpulkan PostgREST.
  // Data PIC diambil terpisah lewat `profiles.org_id`.
  const { data: vendors, error } = await supabase
    .from('vendor_profiles')
    .select(`
      *,
      projects ( count ),
      vendor_documents ( id, name, type, size, file_url, created_at )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching vendors:', error);
  }

  // Satu company vendor sekarang bisa punya banyak staff. Untuk tampilan
  // kartu "PIC", dipilih satu profil perwakilan per organisasi: akun yang
  // paling awal dibuat di org itu (yaitu akun pertama yang dibuat bersama
  // company-nya).
  const orgIds = (vendors || []).map(v => v.id);
  let picByOrg = new Map<string, any>();
  if (orgIds.length > 0) {
    const { data: picProfiles, error: picError } = await supabase
      .from('profiles')
      .select('id, org_id, full_name, email, status, created_at')
      .in('org_id', orgIds)
      .order('created_at', { ascending: true });
    if (picError) {
      console.error('Error fetching vendor PIC profiles:', picError);
    }
    for (const p of picProfiles || []) {
      if (p.org_id && !picByOrg.has(p.org_id)) picByOrg.set(p.org_id, p);
    }
  }

  const initialVendors = (vendors || []).map(v => ({
    ...v,
    profiles: picByOrg.get(v.id) || null,
  }));

  return (
    <VendorPageClient initialVendors={initialVendors} />
  );
}

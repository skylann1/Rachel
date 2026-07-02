import React from 'react';
import { createClient } from '@/utils/supabase/server';
import VendorPageClient from './VendorPageClient';

export const metadata = {
  title: 'Data Vendor - SIPERMIT K3',
};

export default async function VendorManagementPage() {
  const supabase = await createClient();

  // Fetch all vendors with their profiles and project counts
  const { data: vendors, error } = await supabase
    .from('vendor_profiles')
    .select(`
      *,
      profiles ( full_name, email, status ),
      projects ( count ),
      vendor_documents ( id, name, type, size, file_url, created_at )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching vendors:', error);
  }

  const initialVendors = vendors || [];

  return (
    <VendorPageClient initialVendors={initialVendors} />
  );
}

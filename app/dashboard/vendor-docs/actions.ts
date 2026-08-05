'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getAllVendorDocuments() {
  const supabase = await createClient();
  
  // Ambil semua dokumen vendor beserta info vendornya
  const { data, error } = await supabase
    .from('vendor_documents')
    .select(`
      *,
      vendor_profiles:vendor_id (
        company_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all vendor documents:', error);
    return [];
  }

  return data;
}

export async function updateDocumentStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('vendor_documents')
    .update({ status: newStatus })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating document status:', error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: 'Gagal mengupdate. Pastikan ada RLS Policy untuk operasi UPDATE di tabel vendor_documents.' };
  }

  revalidatePath('/dashboard/vendor-docs');
  return { success: true };
}

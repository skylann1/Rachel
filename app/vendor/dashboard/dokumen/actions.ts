'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveDocumentMetadata(data: {
  nama: string;
  jenis: string;
  file_url: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('vendor_documents')
    .insert({
      vendor_id: user.id,
      name: data.nama,
      type: data.jenis,
      file_url: data.file_url,
    });

  if (error) {
    console.error('Error saving document metadata:', error);
    throw new Error(error.message);
  }

  revalidatePath('/vendor/dashboard/dokumen');
  return { success: true };
}

export async function getVendorDocuments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('vendor_documents')
    .select('*')
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return data;
}

export async function deleteVendorDocument(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Dapatkan file_url dari database sebelum dihapus
  const { data: doc } = await supabase
    .from('vendor_documents')
    .select('file_url')
    .eq('id', id)
    .eq('vendor_id', user.id)
    .single();

  if (doc?.file_url) {
    // Ekstrak file path dari URL (mengambil string setelah 'vendor-documents/')
    const urlParts = doc.file_url.split('/vendor-documents/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      // 2. Hapus file fisiknya dari Supabase Storage
      await supabase.storage.from('vendor-documents').remove([filePath]);
    }
  }

  // 3. Hapus record dari database
  const { error } = await supabase
    .from('vendor_documents')
    .delete()
    .eq('id', id)
    .eq('vendor_id', user.id);

  if (error) {
    console.error('Error deleting document:', error);
    throw new Error(error.message);
  }

  revalidatePath('/vendor/dashboard/dokumen');
  return { success: true };
}

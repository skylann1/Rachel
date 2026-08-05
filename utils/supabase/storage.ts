import { createClient } from "./client";

export async function uploadImage(file: File, path: string): Promise<string | null> {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { error } = await supabase.storage
    .from('sipermit-images')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading image: ', error);
    return null;
  }

  const { data } = supabase.storage
    .from('sipermit-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function uploadVendorDocument(file: File, path: string): Promise<string | null> {
  const supabase = createClient();
  
  // Get current user ID to use as folder name
  const { data: { user } } = await supabase.auth.getUser();
  const folderName = user ? user.id : `anonymous_${Date.now()}`;
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`; // cleaner random name
  
  // Save in a single folder per vendor (e.g. vendor-documents/[uuid]/random.pdf)
  const filePath = `${folderName}/${fileName}`;

  const { error } = await supabase.storage
    .from('vendor-documents')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading document: ', error);
    return null;
  }

  const { data } = supabase.storage
    .from('vendor-documents')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

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

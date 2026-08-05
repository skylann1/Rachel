"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateUserMetadata(metadata: Record<string, any>) {
  const supabase = await createClient();
  
  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  // Update user metadata in Supabase
  const { data, error } = await supabase.auth.updateUser({
    data: metadata
  });

  if (error) {
    console.error("Error updating user metadata:", error);
    return { error: error.message };
  }

  // Revalidate both paths to ensure UI updates
  revalidatePath('/dashboard/profile');
  revalidatePath('/vendor/dashboard/profile');

  return { success: true };
}

export async function updateVendorProfile(data: {
  companyName: string;
  picName: string;
  phone: string;
  address: string;
}) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  // 1. Update Auth Metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      company_name: data.companyName,
      pic_name: data.picName,
      phone: data.phone,
      address: data.address
    }
  });

  if (metaError) {
    console.error("Error updating user metadata:", metaError);
    return { error: metaError.message };
  }

  // 2. Update Profiles Table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: data.picName })
    .eq('id', user.id);
    
  if (profileError) {
    console.error("Error updating profiles table:", profileError);
    return { error: profileError.message };
  }

  // 3. Update Vendor Profiles Table
  const { error: vendorProfileError } = await supabase
    .from('vendor_profiles')
    .update({ 
      company_name: data.companyName,
      address: data.address
    })
    .eq('id', user.id);

  if (vendorProfileError) {
    console.error("Error updating vendor_profiles table:", vendorProfileError);
    return { error: vendorProfileError.message };
  }

  revalidatePath('/vendor/dashboard/profile');
  revalidatePath('/vendor/dashboard/projects');
  
  return { success: true };
}

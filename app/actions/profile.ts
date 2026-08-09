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

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) {
    return { error: 'Unauthorized' };
  }

  if (data.newPassword.length < 6) {
    return { error: 'Kata sandi baru minimal 6 karakter.' };
  }

  // Supabase doesn't expose a "verify current password" call, so we
  // re-authenticate with it — wrong password fails here before anything changes.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  });
  if (verifyError) {
    return { error: 'Kata sandi saat ini salah.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: data.newPassword });
  if (updateError) {
    console.error("Error updating password:", updateError);
    return { error: updateError.message };
  }

  return { success: true };
}

export async function updateInternalProfile(data: {
  fullName: string;
  nip: string;
}) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  // 1. Update Auth Metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: { full_name: data.fullName }
  });

  if (metaError) {
    console.error("Error updating user metadata:", metaError);
    return { error: metaError.message };
  }

  // 2. Update Profiles Table (source of truth used across assignee lists, logs, etc.)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: data.fullName })
    .eq('id', user.id);

  if (profileError) {
    console.error("Error updating profiles table:", profileError);
    return { error: profileError.message };
  }

  // 3. Update Internal Profiles Table
  const { error: internalProfileError } = await supabase
    .from('internal_profiles')
    .update({ nip: data.nip })
    .eq('id', user.id);

  if (internalProfileError) {
    console.error("Error updating internal_profiles table:", internalProfileError);
    return { error: internalProfileError.message };
  }

  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard');

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

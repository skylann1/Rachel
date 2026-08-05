'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getProjectDiscussions(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_discussions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true }); // older messages first

  if (error) {
    console.error('Error fetching discussions:', error);
    return [];
  }

  return data;
}

export async function postDiscussionMessage(projectId: string, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user role/profile to attach to the message
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // If no profile (vendor might use vendor_profiles), check vendor_profiles
  let role = profile?.role || 'Vendor';
  if (!profile) {
     const { data: vendorProfile } = await supabase
      .from('vendor_profiles')
      .select('company_name')
      .eq('id', user.id)
      .single();
      
      if (vendorProfile) {
        role = `Vendor - ${vendorProfile.company_name}`;
      }
  }

  const { error } = await supabase
    .from('project_discussions')
    .insert({
      project_id: projectId,
      user_id: user.id,
      user_email: user.email || 'Unknown User',
      user_role: role,
      message: message.trim()
    });

  if (error) {
    console.error('Error posting message:', error);
    return { error: error.message };
  }

  // Revalidate both vendor and internal admin paths
  revalidatePath(`/vendor/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  
  return { success: true };
}

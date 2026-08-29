'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { isPgn, isPgsol } from '@/lib/roles';

/**
 * Diskusi proyek dipakai dua portal sekaligus, jadi aksesnya tidak bisa
 * disamakan begitu saja dengan kepemilikan vendor. Yang boleh: user internal
 * (mereka memang memantau semua proyek) dan vendor pemilik proyek itu.
 * Tanpa penyaringan ini, vendor mana pun bisa membaca atau menulis di ruang
 * diskusi proyek vendor lain — id proyek terpampang di URL.
 */
async function canAccessProjectDiscussion(supabase: any, userId: string, projectId: string) {
  const { data: profile } = await supabase.from('profiles').select('type').eq('id', userId).single();
  if (isPgn(profile?.type) || isPgsol(profile?.type)) return true;

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('vendor_id', userId)
    .maybeSingle();
  return !!project;
}

export async function getProjectDiscussions(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  if (!(await canAccessProjectDiscussion(supabase, user.id, projectId))) {
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

  if (!(await canAccessProjectDiscussion(supabase, user.id, projectId))) {
    return { error: 'Anda tidak memiliki akses ke diskusi proyek ini.' };
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

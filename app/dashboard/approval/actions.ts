"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// =====================================================================
// FETCH FUNCTIONS
// =====================================================================

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();
  return data;
}

export async function getPendingProcedures() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select(`
      id, status, created_at, content,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .in('status', ['Draft', 'Menunggu Review PM'])
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getProcedureById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select(`
      id, status, created_at, content,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .eq('id', id)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

export async function getPendingJsa() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jsa')
    .select(`
      id, status, created_at, rejection_note,
      pm_id, pm_approved_at,
      asset_manager_id, asset_manager_approved_at,
      projects ( name, vendor_profiles ( company_name ) )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getJsaSteps(jsaId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jsa_steps')
    .select('*')
    .eq('jsa_id', jsaId)
    .order('step_number', { ascending: true });
  return data || [];
}

export async function getPendingPtw() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ptw')
    .select(`
      id, status, created_at, rejection_note, ptw_number,
      workers, equipment,
      authority_id, authority_approved_at,
      issuer_id, issuer_approved_at,
      hsse_id,
      projects ( name, location, vendor_profiles ( company_name ) )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

// =====================================================================
// UPDATE FUNCTIONS
// =====================================================================

export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const { error } = await supabase
    .from('procedures')
    .update({ status: 'Prosedur Disetujui', reviewed_by: profile?.id })
    .eq('id', procedureId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

export async function rejectProcedure(procedureId: string, note: string) {
  const supabase = await createClient();

  // Fetch current procedure to update its content JSON
  const { data: proc } = await supabase.from('procedures').select('content').eq('id', procedureId).single();
  
  let updatedContent = proc?.content || {};
  let revisions = updatedContent.revisions || [];
  
  revisions.push({
    revNo: revisions.length + 1,
    date: new Date().toLocaleDateString('id-ID'),
    note: note
  });
  
  updatedContent.revisions = revisions;

  const { error } = await supabase
    .from('procedures')
    .update({ 
      status: 'Draft',
      content: updatedContent 
    })
    .eq('id', procedureId);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

export async function approveJsa(jsaId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let updatePayload: any = {};
  let nextStatus = '';

  if (role === 'pm') {
    updatePayload = { pm_id: user.id, pm_approved_at: new Date().toISOString(), status: 'Review Asset Manager' };
    nextStatus = 'Review Asset Manager';
  } else if (role === 'asset_manager') {
    updatePayload = { asset_manager_id: user.id, asset_manager_approved_at: new Date().toISOString(), status: 'JSA Disetujui' };
    nextStatus = 'JSA Disetujui';
  } else {
    throw new Error("Role tidak berwenang untuk menyetujui JSA.");
  }

  const { error } = await supabase.from('jsa').update(updatePayload).eq('id', jsaId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

export async function rejectJsa(jsaId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('jsa')
    .update({ status: 'Pembahasan JSA', rejection_note: note, pm_id: null, pm_approved_at: null, asset_manager_id: null, asset_manager_approved_at: null })
    .eq('id', jsaId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

export async function approvePtw(ptwId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let updatePayload: any = {};

  if (role === 'ptw_authority') {
    updatePayload = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: 'Review PTW Issuer' };
  } else if (role === 'ptw_issuer') {
    updatePayload = { issuer_id: user.id, issuer_approved_at: new Date().toISOString(), status: 'Menunggu Penomoran HSSE' };
  } else if (role === 'hse') {
    // Generate PTW number: PTW-YYYY-XXX
    const year = new Date().getFullYear();
    const { count } = await supabase.from('ptw').select('*', { count: 'exact', head: true }).like('ptw_number', `PTW-${year}-%`);
    const nextNum = String((count || 0) + 1).padStart(3, '0');
    updatePayload = { hsse_id: user.id, ptw_number: `PTW-${year}-${nextNum}`, status: 'PTW Aktif' };
  } else {
    throw new Error("Role tidak berwenang untuk menyetujui PTW.");
  }

  const { error } = await supabase.from('ptw').update(updatePayload).eq('id', ptwId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

export async function rejectPtw(ptwId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ptw')
    .update({ status: 'Draft', rejection_note: note, authority_id: null, authority_approved_at: null, issuer_id: null, issuer_approved_at: null })
    .eq('id', ptwId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/approval');
}

"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface WorkerItem {
  id: string;
  full_name: string;
  position: string;
  ktp_number: string | null;
  bpjs_number: string | null;
  certification: string | null;
  status: 'Active' | 'Inactive';
}

export async function getWorkers(): Promise<WorkerItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vendor_workers')
    .select('id, full_name, position, ktp_number, bpjs_number, certification, status')
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getWorkers error:', error.message);
    return [];
  }

  return data || [];
}

export async function saveWorker(payload: {
  id?: string;
  full_name: string;
  position: string;
  ktp_number: string;
  bpjs_number: string;
  certification: string;
  status: 'Active' | 'Inactive';
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const row = {
    vendor_id: user.id,
    full_name: payload.full_name,
    position: payload.position,
    ktp_number: payload.ktp_number || null,
    bpjs_number: payload.bpjs_number || null,
    certification: payload.certification || null,
    status: payload.status,
  };

  const { error } = payload.id
    ? await supabase.from('vendor_workers').update(row).eq('id', payload.id).eq('vendor_id', user.id)
    : await supabase.from('vendor_workers').insert(row);

  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/pekerja');
}

export async function deleteWorker(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('vendor_workers').delete().eq('id', id).eq('vendor_id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/pekerja');
}

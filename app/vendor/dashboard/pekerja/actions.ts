"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface CompetencyItem {
  id?: string;
  category: 'Safety' | 'Teknis';
  title: string;
  valid_from: string | null;
  valid_to: string | null;
  document_url: string | null;
}

export interface WorkerItem {
  id: string;
  full_name: string;
  position: string;
  ktp_number: string | null;
  bpjs_number: string | null;
  education: string | null;
  id_card_url: string | null;
  status: 'Active' | 'Inactive';
  competencies: CompetencyItem[];
}

export async function getWorkers(): Promise<WorkerItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vendor_workers')
    .select(`
      id, full_name, position, ktp_number, bpjs_number, education, id_card_url, status,
      vendor_worker_competencies ( id, category, title, valid_from, valid_to, document_url )
    `)
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getWorkers error:', error.message);
    return [];
  }

  return (data || []).map((w: any) => ({
    id: w.id,
    full_name: w.full_name,
    position: w.position,
    ktp_number: w.ktp_number,
    bpjs_number: w.bpjs_number,
    education: w.education,
    id_card_url: w.id_card_url,
    status: w.status,
    competencies: (w.vendor_worker_competencies || []).map((c: any) => ({
      id: c.id,
      category: c.category,
      title: c.title,
      valid_from: c.valid_from,
      valid_to: c.valid_to,
      document_url: c.document_url,
    })),
  }));
}

export async function saveWorker(payload: {
  id?: string;
  full_name: string;
  position: string;
  ktp_number: string;
  bpjs_number: string;
  education: string;
  id_card_url: string | null;
  status: 'Active' | 'Inactive';
  competencies: CompetencyItem[];
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
    education: payload.education || null,
    id_card_url: payload.id_card_url || null,
    status: payload.status,
  };

  let workerId = payload.id;

  if (workerId) {
    const { error } = await supabase
      .from('vendor_workers')
      .update(row)
      .eq('id', workerId)
      .eq('vendor_id', user.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('vendor_workers')
      .insert(row)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    workerId = data.id;
  }

  // Kompetensi ditulis ulang seluruhnya: daftarnya pendek dan selalu dikirim
  // utuh dari form, sehingga menyamakan isi lebih sederhana dan lebih aman
  // dibanding melacak baris mana yang ditambah/diubah/dihapus satu per satu.
  const { error: delError } = await supabase
    .from('vendor_worker_competencies')
    .delete()
    .eq('worker_id', workerId);
  if (delError) throw new Error(delError.message);

  const rows = payload.competencies
    .filter(c => c.title.trim().length > 0)
    .map(c => ({
      worker_id: workerId,
      category: c.category,
      title: c.title.trim(),
      valid_from: c.valid_from || null,
      valid_to: c.valid_to || null,
      document_url: c.document_url || null,
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('vendor_worker_competencies').insert(rows);
    if (insError) throw new Error(insError.message);
  }

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

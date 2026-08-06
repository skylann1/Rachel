"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  certificate_number: string | null;
  certificate_expiry: string | null;
}

export async function getEquipment(): Promise<EquipmentItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vendor_equipment')
    .select('id, name, category, brand, certificate_number, certificate_expiry')
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getEquipment error:', error.message);
    return [];
  }

  return data || [];
}

export async function saveEquipment(payload: {
  id?: string;
  name: string;
  category: string;
  brand: string;
  certificate_number: string;
  certificate_expiry: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const row = {
    vendor_id: user.id,
    name: payload.name,
    category: payload.category,
    brand: payload.brand || null,
    certificate_number: payload.certificate_number || null,
    certificate_expiry: payload.certificate_expiry || null,
  };

  const { error } = payload.id
    ? await supabase.from('vendor_equipment').update(row).eq('id', payload.id).eq('vendor_id', user.id)
    : await supabase.from('vendor_equipment').insert(row);

  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/peralatan');
}

export async function deleteEquipment(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('vendor_equipment').delete().eq('id', id).eq('vendor_id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/peralatan');
}

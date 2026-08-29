"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { AssetDocumentItem } from "@/lib/asset-document";

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  type_serial: string | null;
  dimension: string | null;
  capacity: string | null;
  quantity: number | null;
  unit: string | null;
  photo_url: string | null;
  certificate_number: string | null;
  certificate_expiry: string | null;
  documents: AssetDocumentItem[];
}

export async function getEquipment(): Promise<EquipmentItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const vendorOrgId = await getCallerVendorOrgId(supabase);

  const { data, error } = await supabase
    .from('vendor_equipment')
    .select(`
      id, name, category, brand, type_serial, dimension, capacity, quantity, unit,
      photo_url, certificate_number, certificate_expiry,
      vendor_equipment_documents ( id, doc_name, issuer, valid_to, document_url )
    `)
    .eq('vendor_id', vendorOrgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getEquipment error:', error.message);
    return [];
  }

  return (data || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    brand: e.brand,
    type_serial: e.type_serial,
    dimension: e.dimension,
    capacity: e.capacity,
    quantity: e.quantity,
    unit: e.unit,
    photo_url: e.photo_url,
    certificate_number: e.certificate_number,
    certificate_expiry: e.certificate_expiry,
    documents: (e.vendor_equipment_documents || []).map((d: any) => ({
      id: d.id,
      doc_name: d.doc_name,
      issuer: d.issuer,
      valid_to: d.valid_to,
      document_url: d.document_url,
    })),
  }));
}

export async function saveEquipment(payload: {
  id?: string;
  name: string;
  category: string;
  brand: string;
  type_serial: string;
  dimension: string;
  capacity: string;
  quantity: number;
  unit: string;
  photo_url: string | null;
  documents: AssetDocumentItem[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const vendorOrgId = await getCallerVendorOrgId(supabase);

  const row = {
    vendor_id: vendorOrgId,
    name: payload.name,
    category: payload.category,
    brand: payload.brand || null,
    type_serial: payload.type_serial || null,
    dimension: payload.dimension || null,
    capacity: payload.capacity || null,
    quantity: payload.quantity || 1,
    unit: payload.unit || 'unit',
    photo_url: payload.photo_url || null,
  };

  let equipmentId = payload.id;

  if (equipmentId) {
    // .select() wajib: update tanpa baris yang cocok tidak menghasilkan error,
    // sehingga id milik vendor lain akan lolos ke delete/insert dokumen di
    // bawah dan menimpa sertifikat vendor tersebut.
    const { data, error } = await supabase
      .from('vendor_equipment')
      .update(row)
      .eq('id', equipmentId)
      .eq('vendor_id', vendorOrgId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Peralatan tidak ditemukan.');
  } else {
    const { data, error } = await supabase
      .from('vendor_equipment')
      .insert(row)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    equipmentId = data.id;
  }

  // Sama seperti kompetensi pekerja: daftar dokumen ditulis ulang utuh.
  const { error: delError } = await supabase
    .from('vendor_equipment_documents')
    .delete()
    .eq('equipment_id', equipmentId);
  if (delError) throw new Error(delError.message);

  const rows = payload.documents
    .filter(d => d.doc_name.trim().length > 0)
    .map(d => ({
      equipment_id: equipmentId,
      doc_name: d.doc_name.trim(),
      issuer: d.issuer || null,
      valid_to: d.valid_to || null,
      document_url: d.document_url || null,
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('vendor_equipment_documents').insert(rows);
    if (insError) throw new Error(insError.message);
  }

  revalidatePath('/vendor/dashboard/peralatan');
}

export async function deleteEquipment(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const vendorOrgId = await getCallerVendorOrgId(supabase);

  const { error } = await supabase.from('vendor_equipment').delete().eq('id', id).eq('vendor_id', vendorOrgId);
  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/peralatan');
}

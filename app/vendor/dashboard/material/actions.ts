"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { AssetDocumentItem } from "@/lib/asset-document";

export interface MaterialItem {
  id: string;
  name: string;
  brand: string | null;
  type_serial: string | null;
  dimension: string | null;
  quantity: number | null;
  unit: string | null;
  photo_url: string | null;
  documents: AssetDocumentItem[];
}

export async function getMaterials(): Promise<MaterialItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vendor_materials')
    .select(`
      id, name, brand, type_serial, dimension, quantity, unit, photo_url,
      vendor_material_documents ( id, doc_name, issuer, valid_to, document_url )
    `)
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMaterials error:', error.message);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    brand: m.brand,
    type_serial: m.type_serial,
    dimension: m.dimension,
    quantity: m.quantity,
    unit: m.unit,
    photo_url: m.photo_url,
    documents: (m.vendor_material_documents || []).map((d: any) => ({
      id: d.id,
      doc_name: d.doc_name,
      issuer: d.issuer,
      valid_to: d.valid_to,
      document_url: d.document_url,
    })),
  }));
}

export async function saveMaterial(payload: {
  id?: string;
  name: string;
  brand: string;
  type_serial: string;
  dimension: string;
  quantity: number;
  unit: string;
  photo_url: string | null;
  documents: AssetDocumentItem[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const row = {
    vendor_id: user.id,
    name: payload.name,
    brand: payload.brand || null,
    type_serial: payload.type_serial || null,
    dimension: payload.dimension || null,
    quantity: payload.quantity || 1,
    unit: payload.unit || 'unit',
    photo_url: payload.photo_url || null,
  };

  let materialId = payload.id;

  if (materialId) {
    const { error } = await supabase
      .from('vendor_materials')
      .update(row)
      .eq('id', materialId)
      .eq('vendor_id', user.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('vendor_materials')
      .insert(row)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    materialId = data.id;
  }

  const { error: delError } = await supabase
    .from('vendor_material_documents')
    .delete()
    .eq('material_id', materialId);
  if (delError) throw new Error(delError.message);

  const rows = payload.documents
    .filter(d => d.doc_name.trim().length > 0)
    .map(d => ({
      material_id: materialId,
      doc_name: d.doc_name.trim(),
      issuer: d.issuer || null,
      valid_to: d.valid_to || null,
      document_url: d.document_url || null,
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from('vendor_material_documents').insert(rows);
    if (insError) throw new Error(insError.message);
  }

  revalidatePath('/vendor/dashboard/material');
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('vendor_materials').delete().eq('id', id).eq('vendor_id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/vendor/dashboard/material');
}

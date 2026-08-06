"use server";

import { createClient } from "@/utils/supabase/server";

export interface VendorIncidentItem {
  id: string;
  title: string;
  type: string;
  incident_date: string;
  location: string;
  status: string;
  chronology: string;
  immediate_action: string | null;
  rca_root_cause: string | null;
  rca_corrective: string | null;
  rca_preventive: string | null;
}

export async function getVendorIncidents(): Promise<VendorIncidentItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('incidents')
    .select('id, title, type, incident_date, location, status, chronology, immediate_action, rca_root_cause, rca_corrective, rca_preventive, projects!inner(vendor_id)')
    .eq('projects.vendor_id', user.id)
    .order('incident_date', { ascending: false });

  if (error) {
    console.warn('getVendorIncidents error:', error.message);
    return [];
  }

  return (data || []).map((i: any) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    incident_date: i.incident_date,
    location: i.location,
    status: i.status,
    chronology: i.chronology,
    immediate_action: i.immediate_action,
    rca_root_cause: i.rca_root_cause,
    rca_corrective: i.rca_corrective,
    rca_preventive: i.rca_preventive,
  }));
}

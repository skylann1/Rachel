"use server";

import { createClient } from "@/utils/supabase/server";

export async function submitIncident(formData: FormData) {
  const supabase = await createClient();
  
  const type = formData.get("type") as string;
  const project_id = formData.get("project_id") as string;
  const incident_date = formData.get("incident_date") as string;
  const incident_time = formData.get("incident_time") as string;
  const location = formData.get("location") as string;
  const chronology = formData.get("chronology") as string;
  const immediate_action = formData.get("immediate_action") as string;
  // TODO: Handle image upload in a real scenario
  // const image = formData.get("image") as File;

  // We map the select type to incident_type enum ('Near Miss', 'First Aid', etc. in schema)
  let mappedType = 'Near Miss';
  switch (type) {
    case 'near_miss': mappedType = 'Near Miss'; break;
    case 'first_aid': mappedType = 'First Aid'; break;
    case 'medical_treatment': mappedType = 'Medical Treatment Case'; break;
    case 'lti': mappedType = 'Lost Time Injury'; break;
    case 'fatality': mappedType = 'Fatality'; break;
    case 'environmental': mappedType = 'Environmental Spill'; break;
    case 'property_damage': mappedType = 'Property Damage'; break;
  }
  
  // We need the user's ID
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('incidents')
    .insert({
      project_id,
      reported_by: user?.id,
      title: `Incident: ${mappedType}`,
      type: mappedType,
      incident_date,
      incident_time,
      location,
      chronology,
      immediate_action,
      status: 'Menunggu Investigasi'
    });
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

export async function getVendorProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('vendor_id', user.id);
    
  if (error) {
    console.error(error);
    return [];
  }
  
  return data || [];
}

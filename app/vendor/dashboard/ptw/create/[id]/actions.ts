"use server";

import { createClient } from "@/utils/supabase/server";

export async function savePtw(projectId: string, workers: any[], equipment: any[]) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('ptw')
    .insert({
      project_id: projectId,
      workers,
      equipment,
      status: 'Menunggu Approval PM'
    });
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

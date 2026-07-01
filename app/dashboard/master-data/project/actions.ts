"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const contract_number = formData.get("contract_number") as string;
  const location = formData.get("location") as string;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const vendor_id = formData.get("vendor_id") as string;

  const { error } = await supabase.from('projects').insert({
    name,
    description,
    contract_number,
    location,
    start_date,
    end_date,
    vendor_id,
    status: 'Preparation',
    progress: 0,
  });

  if (error) {
    console.error("Error creating project:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/master-data/project");
}

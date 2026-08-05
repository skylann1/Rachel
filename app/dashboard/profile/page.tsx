import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EditableProfile } from "./EditableProfile";

export const metadata = {
  title: 'Profil Pengguna | Smart System K3',
};

export default async function InternalProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Data relevant to the K3 System
  const userData = {
    fullName: user.user_metadata?.full_name || 'Admin K3',
    role: 'HSE Manager',
    nik: 'K3-2024-001',
    joinedDate: new Date(user.created_at || Date.now()).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };

  return <EditableProfile user={user} initialUserData={userData} />;
}

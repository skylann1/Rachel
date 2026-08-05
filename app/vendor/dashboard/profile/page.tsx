import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EditableVendorProfile } from "./EditableVendorProfile";

export const metadata = {
  title: 'Profil Vendor | Portal Vendor K3',
};

export default async function VendorProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch from profiles and vendor_profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const { data: vendorProfile } = await supabase
    .from('vendor_profiles')
    .select('company_name, address')
    .eq('id', user.id)
    .single();

  // Data relevant to Vendor in K3 System
  const vendorData = {
    companyName: vendorProfile?.company_name || user.user_metadata?.company_name || 'Mitra Karya Perkasa',
    picName: profile?.full_name || user.user_metadata?.pic_name || 'Budi Santoso',
    phone: user.user_metadata?.phone || '+62 812-3456-7890',
    address: vendorProfile?.address || user.user_metadata?.address || 'Jl. Gatot Subroto Kav. 12, Jakarta',
    status: 'Aktif',
    joinedDate: new Date(user.created_at || Date.now()).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };

  return <EditableVendorProfile user={user} initialVendorData={vendorData} />;
}

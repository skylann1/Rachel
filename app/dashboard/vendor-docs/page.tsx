import { getUserPermissions, hasPermission } from '@/utils/permissions';
import { redirect } from 'next/navigation';
import VendorDocsClient from './VendorDocsClient';

export const metadata = {
  title: 'Dokumen Vendor | Admin Dashboard',
};

export default async function AdminVendorDocsPage() {
  const permissions = await getUserPermissions();
  
  // Periksa apakah punya akses ke modul vendorDocs (action: view)
  const canView = await hasPermission('vendorDocs', 'view');
  if (!canView) {
    redirect('/dashboard');
  }

  // Periksa apakah punya akses approve
  const canApprove = permissions?.vendorDocs?.includes('approve') || false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Verifikasi Dokumen Vendor</h1>
        <p className="text-sm text-slate-500">
          Kelola dan verifikasi kelayakan dokumen-dokumen persyaratan K3 yang diunggah oleh vendor.
        </p>
      </div>

      <VendorDocsClient canApprove={canApprove} />
    </div>
  );
}

import Link from 'next/link';
import { createClient, getCallerVendorOrgId } from '@/utils/supabase/server';
import { loadInspectionDetail } from '@/lib/inspection-detail';
import { InspectionDetailView } from '@/components/inspection/InspectionDetailView';
import VendorResponseForm from './VendorResponseForm';

export const dynamic = 'force-dynamic';

export default async function VendorInspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getCallerVendorOrgId(supabase);
  const { inspection, error } = await loadInspectionDetail(supabase, id);

  // Vendor hanya boleh melihat temuan yang ditujukan ke organisasinya sendiri
  // (sama seperti getVendorInspections); RLS jadi lapisan kedua.
  if (error || !inspection || !orgId || inspection.target_vendor !== orgId) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-3">
        <p className="text-rose-600 font-bold">Temuan tidak ditemukan.</p>
        <Link href="/vendor/dashboard/inspection" className="text-sm font-semibold text-primary">Kembali ke Inbox Temuan K3</Link>
      </div>
    );
  }

  return (
    <InspectionDetailView inspection={inspection} backHref="/vendor/dashboard/inspection">
      <VendorResponseForm inspectionId={inspection.id} status={inspection.status} />
    </InspectionDetailView>
  );
}

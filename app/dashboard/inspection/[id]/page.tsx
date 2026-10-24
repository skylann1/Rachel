import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { loadInspectionDetail } from '@/lib/inspection-detail';
import { InspectionDetailView } from '@/components/inspection/InspectionDetailView';
import InspectionActions from './InspectionActions';

export const dynamic = 'force-dynamic';

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { inspection, error } = await loadInspectionDetail(supabase, id);

  if (error || !inspection) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-3">
        <p className="text-rose-600 font-bold">{error ? 'Gagal memuat temuan.' : 'Temuan tidak ditemukan.'}</p>
        {error && <p className="font-mono text-xs text-slate-500 break-all">{error}</p>}
        <Link href="/dashboard/inspection" className="text-sm font-semibold text-primary">Kembali ke daftar inspeksi</Link>
      </div>
    );
  }

  const canManage = await hasPermission('inspection', 'manage');

  return (
    <InspectionDetailView inspection={inspection} backHref="/dashboard/inspection">
      {canManage && (
        <InspectionActions
          inspectionId={inspection.id}
          status={inspection.status}
          hasVendor={!!inspection.target_vendor}
          assigneeName={inspection.assignee_name}
        />
      )}
    </InspectionDetailView>
  );
}

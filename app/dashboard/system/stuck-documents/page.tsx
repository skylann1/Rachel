import { getStuckDocuments } from './actions';
import StuckDocumentsClient from './StuckDocumentsClient';

export default async function StuckDocumentsPage() {
  const report = await getStuckDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Monitor Dokumen Macet</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Dokumen Prosedur, JSA, dan PTW yang sedang direview tapi tidak punya jalan keluar yang jelas —
          tahap tanpa penugas, penugas yang sudah tidak berwenang, atau terlalu lama menunggu.
        </p>
      </div>
      <StuckDocumentsClient report={report} />
    </div>
  );
}

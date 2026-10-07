'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';
import { ArrowLeft, XCircle, FileText, Loader2 } from 'lucide-react';
import { approveProcedure, rejectProcedure } from '../../actions';
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION, PROCEDURE_STAGE_SEQUENCE, procedureStageIndex } from '@/lib/procedure-status';
import { StageRail } from '@/components/internal/stage-rail';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center animate-pulse text-slate-400 font-medium">Memuat Pratinjau Dokumen...</div> }
);

function RejectionNote({ note }: { note: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex gap-3">
      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
      <div>
        <span className="font-bold block mb-1">Catatan Revisi:</span>
        <p className="whitespace-pre-wrap leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

export default function ProsedurDetailClient({ prosedur, permissions }: { prosedur: any, permissions: Record<string, string[]> | null }) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Gerbang lewat permission per-tahap (PROCEDURE_STAGE_PERMISSION), sama
  // seperti hasProsedurPermission di AdminProjectClient.tsx — mengenali BAIK
  // tahap Review PGSOL maupun Menunggu Review PM. Catatan: halaman ini belum
  // punya data stage_assignments per proyek (lihat page.tsx di folder yang
  // sama, hanya fetch getProcedureById + getUserPermissions), jadi berbeda
  // dari AdminProjectClient.tsx, tombol di sini masih tampil ke SEMUA
  // pemegang permission tahap ini, bukan hanya yang ditugaskan (assignment-
  // aware) — gap ini sengaja belum ditutup di fix wave ini.
  const procPerm = PROCEDURE_STAGE_PERMISSION[prosedur.status];
  const canApprove = !!procPerm && !!permissions?.[procPerm.module]?.includes(procPerm.action);

  // Keterangan tahap — sadar-status. Prosedur kini punya gerbang PGSOL
  // (Reviewer lalu HSE) sebelum PM, jadi teks lama ("diajukan untuk
  // direview oleh PM") tidak lagi benar saat status masih Review PGSOL
  // atau Review HSE PGSOL.
  const statusBlurb =
    prosedur.status === PROCEDURE_STATUS.reviewInternalVendor
      ? 'Dokumen ini masih direview internal oleh staff vendor sendiri — belum masuk ke rantai persetujuan PGSOL/PGN.'
      : prosedur.status === PROCEDURE_STATUS.reviewPgsol
      ? 'Dokumen prosedur kerja ini sedang menunggu verifikasi teknis oleh PGSOL sebelum diteruskan ke review HSE PGSOL.'
      : prosedur.status === PROCEDURE_STATUS.reviewHsePgsol
      ? 'Dokumen prosedur kerja ini telah direview teknis PGSOL dan sedang menunggu review HSE PGSOL sebelum diteruskan ke HSSE PGN.'
      : prosedur.status === PROCEDURE_STATUS.reviewHssePgn
      ? 'Dokumen prosedur kerja ini telah lolos review PGSOL dan sedang menunggu verifikasi keselamatan oleh HSSE PGN sebelum diteruskan ke PM Zona.'
      : prosedur.status === PROCEDURE_STATUS.menungguReviewPM
      ? 'Dokumen prosedur kerja ini telah direview PGSOL dan HSSE PGN, dan diajukan untuk persetujuan akhir oleh PM Zona.'
      : prosedur.status === PROCEDURE_STATUS.approved
      ? 'Dokumen prosedur kerja ini telah disetujui.'
      : 'Dokumen prosedur kerja ini dikembalikan ke vendor untuk revisi.';

  const pdfData = prosedur.content ? {
    projectName: prosedur.projects?.name || 'Proyek',
    docNo: prosedur.content.docNo || '-',
    contractNo: prosedur.content.contractNo || '-',
    submissionDate: prosedur.content.submissionDate || '-',
    umum: prosedur.content.umum || '',
    scopeOfWork: prosedur.content.scopeOfWork || '',
    tools: prosedur.content.tools || [],
    apd: prosedur.content.selectedApd || prosedur.content.apd || [],
    perlengkapanLainnya: prosedur.content.perlengkapanLainnya || [],
    tahapanPekerjaan: prosedur.content.tahapanPekerjaan || [],
    penyelesaianAkhir: prosedur.content.penyelesaianAkhir || [],
    revisions: prosedur.content.revisions || [],
    vendorSignature: prosedur.content.vendorSignature || null
  } : null;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveProcedure(prosedur.id);
      router.push('/dashboard/approval');
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('Alasan penolakan / catatan revisi wajib diisi.');
      return;
    }
    setIsRejecting(true);
    try {
      await rejectProcedure(prosedur.id, rejectNote);
      router.push('/dashboard/approval');
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.push('/dashboard/approval')}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Detail Prosedur Kerja</h1>
          <p className="text-sm text-slate-500 mt-1">
            Proyek: <span className="font-bold text-primary">{prosedur.projects?.name}</span> • Vendor: <span className="font-bold">{prosedur.projects?.vendor_profiles?.company_name}</span>
          </p>
        </div>
      </div>

      <div className={`relative bg-white rounded-3xl overflow-hidden border ${
        canApprove ? 'border-amber-300 shadow-xl ring-4 ring-amber-50' : 'border-slate-200 shadow-sm'
      }`}>
        <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1.5 ${canApprove ? 'bg-amber-400' : 'bg-slate-200'}`} />

        <div className={`p-6 pl-8 border-b ${canApprove ? 'bg-amber-50/60 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
          <span className={`inline-flex text-[10px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded ${
            canApprove ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-200 text-slate-600'
          }`}>
            {canApprove ? 'Perlu tindakan Anda' : 'Hanya dapat dilihat'}
          </span>

          <div className="mt-3 flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Prosedur #{prosedur.id.slice(0, 8).toUpperCase()}</h2>
                  <p className="text-xs text-slate-500 font-medium">Diajukan pada {new Date(prosedur.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mt-3 max-w-prose">{statusBlurb}</p>

              <div className="mt-4">
                <StageRail
                  steps={PROCEDURE_STAGE_SEQUENCE}
                  currentIndex={procedureStageIndex(prosedur.status)}
                  tone={
                    prosedur.status === PROCEDURE_STATUS.approved ? 'done'
                      : prosedur.status === PROCEDURE_STATUS.draft ? 'returned'
                      : canApprove ? 'action' : 'waiting'
                  }
                />
              </div>
            </div>

            {canApprove && (
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-56 shrink-0">
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-200"
                >
                  {isApproving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Setujui Prosedur
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="w-full px-5 py-2.5 rounded-xl font-bold text-sm text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 transition-colors shadow-sm"
                >
                  Tolak & Kembalikan
                </button>
              </div>
            )}
          </div>

          {prosedur.content?.revisions?.length > 0 && (
            <div className="mt-5">
              <RejectionNote note={prosedur.content.revisions[prosedur.content.revisions.length - 1].note} />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6">
          <div className="w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200" style={{ height: '800px' }}>
            {pdfData ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <ProsedurPDF data={pdfData} />
              </PDFViewer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Data konten tidak tersedia.</div>
            )}
          </div>
        </div>
      </div>

      {rejectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-800">Tolak Dokumen</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">Alasan Penolakan / Catatan Revisi <span className="text-red-500">*</span></label>
                <textarea 
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Misal: Mohon tambahkan rincian tahapan nomor 3..."
                  rows={4}
                  className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none bg-slate-50"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleReject}
                disabled={isRejecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PDFViewer } from '@react-pdf/renderer';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Loader2 } from 'lucide-react';
import { approveProcedure, rejectProcedure } from '../../actions';
import { PROCEDURE_STATUS } from '@/lib/procedure-status';

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

export default function ProsedurDetailClient({ prosedur, userRole, permissions }: { prosedur: any, userRole: string, permissions: Record<string, string[]> | null }) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const hasApprovePerm = permissions?.approval?.includes('approve') || false;
  const canApprove = (userRole === 'pm' || userRole === 'admin' || hasApprovePerm) && prosedur.status === PROCEDURE_STATUS.menungguReviewPM;

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

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Prosedur #{prosedur.id.slice(0, 8).toUpperCase()}</h2>
              <p className="text-xs text-slate-500 font-medium">Diajukan pada {new Date(prosedur.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            prosedur.status === PROCEDURE_STATUS.draft ? 'bg-slate-100 text-slate-600' :
            prosedur.status === PROCEDURE_STATUS.menungguReviewPM ? 'bg-orange-100 text-orange-600' :
            'bg-green-100 text-green-700'
          }`}>
            {prosedur.status}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-2">
             <p className="text-sm text-slate-600">Dokumen prosedur kerja ini diajukan untuk direview oleh PM.</p>
             {prosedur.content?.revisions?.length > 0 && (
               <div className="mt-4">
                 <RejectionNote note={prosedur.content.revisions[prosedur.content.revisions.length - 1].note} />
               </div>
             )}
          </div>
          <div className="w-full bg-slate-500 rounded-xl overflow-hidden border border-slate-200" style={{ height: '800px' }}>
            {pdfData ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <ProsedurPDF data={pdfData} />
              </PDFViewer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">Data konten tidak tersedia.</div>
            )}
          </div>
        </div>

        {canApprove && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-3">
            <button 
              onClick={() => setRejectModalOpen(true)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
            >
              Tolak
            </button>
            <button 
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm shadow-green-600/30"
            >
              {isApproving && <Loader2 className="w-4 h-4 animate-spin" />}
              Setujui Prosedur
            </button>
          </div>
        )}
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

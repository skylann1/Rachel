'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, FileSignature, CheckCircle2, ShieldCheck, Clock,
  ShieldAlert, AlertTriangle, X, CheckCircle, FileText,
  Stamp, ChevronRight, Loader2, Users, Wrench, Hash, Building2
} from 'lucide-react';
import {
  approveProcedure, rejectProcedure,
  approveJsa, rejectJsa,
  approvePtw, rejectPtw,
  getJsaSteps
} from './actions';
import { PDFViewer } from '@react-pdf/renderer';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';

// =====================================================================
// HELPER COMPONENTS
// =====================================================================

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    'Pembahasan JSA':       { color: 'bg-sky-50 text-sky-700 border-sky-200',       label: 'Pembahasan' },
    'Review PM':            { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Review PM' },
    'Review Asset Manager': { color: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Review Asset Mgr' },
    'JSA Disetujui':        { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Disetujui' },
    'Menunggu Review PM':   { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Review PM' },
    'Prosedur Disetujui':   { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Disetujui' },
    'Draft':                { color: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Draft' },
    'Review PTW Issuer':    { color: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Review Penerbit' },
    'Menunggu Penomoran HSSE': { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Penomoran HSSE' },
    'Menunggu Approval PM': { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Review Authority' },
    'PTW Aktif':            { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Aktif ✓' },
  };
  const cfg = map[status] ?? { color: 'bg-slate-50 text-slate-600 border-slate-200', label: status };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function RejectionNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <div className="mt-1 flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5 max-w-xs">
      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
      <span className="line-clamp-2">{note}</span>
    </div>
  );
}

// =====================================================================
// REJECT MODAL
// =====================================================================
function RejectModal({ onConfirm, onCancel, isLoading }: {
  onConfirm: (note: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <X className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Tolak & Kembalikan Dokumen</h3>
            <p className="text-xs text-slate-500">Catatan ini akan dilihat oleh Vendor.</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
          placeholder="Contoh: Mitigasi pada langkah ke-3 tidak spesifik. Harap jelaskan APD yang digunakan..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Batal
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={!note.trim() || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Konfirmasi Penolakan
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// JSA DETAIL MODAL
// =====================================================================
function JsaDetailModal({
  jsa, userRole, permissions, onClose, onApprove, onReject, isLoading
}: {
  jsa: any; userRole: string; permissions: Record<string, string[]> | null; onClose: () => void;
  onApprove: () => void; onReject: () => void; isLoading: boolean;
}) {
  const hasReviewJsaPerm = permissions?.jsa?.includes('review') || false;
  const hasApprovePerm = permissions?.approval?.includes('approve') || false;
  
  const canApprove = (
    ((userRole === 'pm' || userRole === 'admin' || hasApprovePerm) && jsa.status === 'Pembahasan JSA') ||
    ((userRole === 'asset_manager' || userRole === 'admin' || hasReviewJsaPerm) && jsa.status === 'Review Asset Manager')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Detail JSA #{jsa.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{jsa.projects?.name} — {jsa.projects?.vendor_profiles?.company_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={jsa.status} />
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Approval Timeline */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Riwayat Persetujuan</p>
          <div className="flex items-center gap-2">
            {[
              { label: 'Pembahasan JSA', done: ['Review Asset Manager', 'JSA Disetujui'].includes(jsa.status) || jsa.pm_id },
              { label: 'Review PM', done: jsa.pm_id },
              { label: 'Review Asset Manager', done: jsa.asset_manager_id },
              { label: 'JSA Disetujui', done: jsa.status === 'JSA Disetujui' },
            ].map((step, i, arr) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black transition-colors ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-semibold ${step.done ? 'text-emerald-700' : 'text-slate-400'}`}>{step.label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
          {jsa.rejection_note && <RejectionNote note={jsa.rejection_note} />}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {jsa.steps && jsa.steps.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border border-slate-200 rounded-xl">
                  <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase w-10">No</th>
                  <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase">Langkah Kerja</th>
                  <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase">Potensi Bahaya</th>
                  <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase">Mitigasi/Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jsa.steps.map((row: any, i: number) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="p-3 text-slate-400 font-bold">{i + 1}</td>
                    <td className="p-3 text-slate-700">{row.description}</td>
                    <td className="p-3 text-slate-700">{Array.isArray(row.hazards) ? row.hazards.join(', ') : row.hazards}</td>
                    <td className="p-3 text-slate-700">{Array.isArray(row.controls) ? row.controls.join(', ') : row.controls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">Data langkah JSA tidak ditemukan.</p>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Tutup
          </button>
          {canApprove ? (
            <div className="flex gap-2">
              <button onClick={onReject} disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors">
                <X className="w-4 h-4" /> Tolak & Kembalikan
              </button>
              <button onClick={onApprove} disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Setujui JSA
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {jsa.status === 'JSA Disetujui' ? '✅ JSA ini sudah disetujui penuh.' : 'Dokumen ini tidak berada di antrian Anda saat ini.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PTW DETAIL MODAL
// =====================================================================
function PtwDetailModal({
  ptw, userRole, permissions, onClose, onApprove, onReject, isLoading
}: {
  ptw: any; userRole: string; permissions: Record<string, string[]> | null; onClose: () => void;
  onApprove: () => void; onReject: () => void; isLoading: boolean;
}) {
  const hasApprovePtwPerm = permissions?.jsa?.includes('approve') || false;
  const hasApprovePerm = permissions?.approval?.includes('approve') || false;

  const canApprove = (
    ((userRole === 'ptw_authority' || userRole === 'admin' || hasApprovePtwPerm) && ptw.status === 'Menunggu Approval PM') ||
    ((userRole === 'ptw_issuer' || userRole === 'admin' || hasApprovePerm) && ptw.status === 'Review PTW Issuer') ||
    ((userRole === 'hse' || userRole === 'admin' || hasApprovePerm) && ptw.status === 'Menunggu Penomoran HSSE')
  );

  const workers = Array.isArray(ptw.workers) ? ptw.workers : (typeof ptw.workers === 'string' ? JSON.parse(ptw.workers || '[]') : []);
  const equipment = Array.isArray(ptw.equipment) ? ptw.equipment : (typeof ptw.equipment === 'string' ? JSON.parse(ptw.equipment || '[]') : []);

  const approvalSteps = [
    { label: 'Pengajuan Vendor', done: true },
    { label: 'Pembahasan', done: ptw.authority_id || ['Review PTW Issuer', 'Menunggu Penomoran HSSE', 'PTW Aktif'].includes(ptw.status) },
    { label: 'PTW Authority', done: ptw.authority_id },
    { label: 'PTW Issuer', done: ptw.issuer_id },
    { label: 'Penomoran HSSE', done: ptw.ptw_number },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-800">Detail PTW #{ptw.id.slice(0, 8).toUpperCase()}</h2>
              {ptw.ptw_number && (
                <span className="flex items-center gap-1 text-xs font-black bg-primary text-white px-2.5 py-1 rounded-full">
                  <Hash className="w-3 h-3" />{ptw.ptw_number}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{ptw.projects?.name}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />{ptw.projects?.vendor_profiles?.company_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={ptw.status} />
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Approval Timeline */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Alur Persetujuan PTW</p>
          <div className="flex items-center gap-2 flex-wrap">
            {approvalSteps.map((step, i, arr) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-semibold ${step.done ? 'text-emerald-700' : 'text-slate-400'}`}>{step.label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
          {ptw.rejection_note && <RejectionNote note={ptw.rejection_note} />}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-slate-700">Pekerja ({workers.length})</h4>
              </div>
              {workers.length > 0 ? workers.map((w: any, i: number) => (
                <div key={i} className="text-sm text-slate-600 py-1 border-b border-slate-200 last:border-0">
                  <span className="font-semibold">{w.name}</span>
                  {w.role && <span className="text-slate-400 ml-2 text-xs">({w.role})</span>}
                </div>
              )) : <p className="text-xs text-slate-400">Tidak ada data pekerja.</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-slate-700">Peralatan ({equipment.length})</h4>
              </div>
              {equipment.length > 0 ? equipment.map((e: any, i: number) => (
                <div key={i} className="text-sm text-slate-600 py-1 border-b border-slate-200 last:border-0">
                  <span className="font-semibold">{e.name}</span>
                  {e.type && <span className="text-slate-400 ml-2 text-xs">({e.type})</span>}
                </div>
              )) : <p className="text-xs text-slate-400">Tidak ada data peralatan.</p>}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Tutup
          </button>
          {canApprove ? (
            <div className="flex gap-2">
              {userRole !== 'hse' && (
                <button onClick={onReject} disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors">
                  <X className="w-4 h-4" /> Tolak & Kembalikan
                </button>
              )}
              <button onClick={onApprove} disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}
                {userRole === 'hse' ? 'Terbitkan Nomor PTW' : 'Setujui PTW'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {ptw.status === 'PTW Aktif' ? `✅ PTW Aktif — No. ${ptw.ptw_number}` : 'Dokumen ini tidak berada di antrian Anda saat ini.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// MAIN PAGE CLIENT
// =====================================================================
interface ApprovalPageClientProps {
  userRole: string;
  procedures: any[];
  jsaList: any[];
  ptwList: any[];
  permissions: Record<string, string[]> | null;
}

export default function ApprovalPageClient({ userRole, procedures, jsaList, ptwList, permissions }: ApprovalPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Prosedur' | 'JSA' | 'PTW'>('JSA');
  const [selectedJsa, setSelectedJsa] = useState<any>(null);
  const [selectedPtw, setSelectedPtw] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: 'prosedur' | 'jsa' | 'ptw'; id: string } | null>(null);

  const handleOpenJsa = async (jsa: any) => {
    setIsLoading(true);
    const steps = await getJsaSteps(jsa.id);
    setSelectedJsa({ ...jsa, steps });
    setIsLoading(false);
  };

  // handleApproveProsedur moved to its dedicated page

  const handleApproveJsa = async (id: string) => {
    setIsLoading(true);
    try {
      await approveJsa(id, userRole);
      setSelectedJsa(null);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePtw = async (id: string) => {
    setIsLoading(true);
    try {
      await approvePtw(id, userRole);
      setSelectedPtw(null);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReject = async (note: string) => {
    if (!rejectTarget) return;
    setIsLoading(true);
    try {
      if (rejectTarget.type === 'jsa') {
        await rejectJsa(rejectTarget.id, note);
        setSelectedJsa(null);
      } else if (rejectTarget.type === 'ptw') {
        await rejectPtw(rejectTarget.id, note);
        setSelectedPtw(null);
      } else if (rejectTarget.type === 'prosedur') {
        await rejectProcedure(rejectTarget.id, note);
      }
      setRejectTarget(null);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const jsaPendingMyAction = jsaList.filter(j => {
    if (userRole === 'pm') return j.status === 'Pembahasan JSA';
    if (userRole === 'asset_manager') return j.status === 'Review Asset Manager';
    return true; // admin sees all
  });

  const ptwPendingMyAction = ptwList.filter(p => {
    if (userRole === 'ptw_authority') return p.status === 'Menunggu Approval PM';
    if (userRole === 'ptw_issuer') return p.status === 'Review PTW Issuer';
    if (userRole === 'hse') return p.status === 'Menunggu Penomoran HSSE';
    return true; // admin sees all
  });

  const tabs = [
    { id: 'Prosedur', label: 'Prosedur Kerja', icon: FileSignature, count: procedures.filter(p => p.status !== 'Prosedur Disetujui').length },
    { id: 'JSA', label: 'JSA', icon: ShieldCheck, count: jsaPendingMyAction.filter(j => j.status !== 'JSA Disetujui').length },
    { id: 'PTW', label: 'PTW', icon: Stamp, count: ptwPendingMyAction.filter(p => p.status !== 'PTW Aktif').length },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Verifikasi &amp; Approval</h1>
        <p className="text-sm text-slate-500 mt-1">Review dan validasi dokumen Prosedur, JSA, dan PTW dari Vendor.</p>
      </div>

      {/* Role Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
        <ShieldAlert className="w-3.5 h-3.5" />
        Anda login sebagai: <span className="uppercase">{userRole}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content: JSA Tab */}
      {activeTab === 'JSA' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID JSA</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Proyek / Vendor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Diajukan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jsaList.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">Tidak ada data JSA.</td></tr>
              ) : jsaList.map(jsa => (
                <tr key={jsa.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs font-bold text-primary">{jsa.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(jsa.created_at).toLocaleDateString('id-ID')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-sm text-slate-800">{jsa.projects?.name}</p>
                    <p className="text-xs text-slate-500">{jsa.projects?.vendor_profiles?.company_name}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(jsa.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={jsa.status} />
                    <RejectionNote note={jsa.rejection_note} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenJsa(jsa)}
                      className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content: PTW Tab */}
      {activeTab === 'PTW' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID PTW</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Proyek / Vendor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ptwList.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">Tidak ada data PTW.</td></tr>
              ) : ptwList.map(ptw => (
                <tr key={ptw.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs font-bold text-primary">{ptw.id.slice(0, 8).toUpperCase()}</p>
                    {ptw.ptw_number && <p className="text-xs font-bold text-emerald-600 mt-0.5">{ptw.ptw_number}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-sm text-slate-800">{ptw.projects?.name}</p>
                    <p className="text-xs text-slate-500">{ptw.projects?.vendor_profiles?.company_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={ptw.status} />
                    <RejectionNote note={ptw.rejection_note} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedPtw(ptw)}
                      className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content: Prosedur Tab */}
      {activeTab === 'Prosedur' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID Prosedur</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Proyek / Vendor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {procedures.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">Tidak ada data Prosedur.</td></tr>
              ) : procedures.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs font-bold text-primary">{p.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-sm text-slate-800">{p.projects?.name}</p>
                    <p className="text-xs text-slate-500">{p.projects?.vendor_profiles?.company_name}</p>
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => router.push(`/dashboard/approval/prosedur/${p.id}`)}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}


      {selectedJsa && (
        <JsaDetailModal
          jsa={selectedJsa}
          userRole={userRole}
          permissions={permissions}
          onClose={() => setSelectedJsa(null)}
          onApprove={() => handleApproveJsa(selectedJsa.id)}
          onReject={() => setRejectTarget({ type: 'jsa', id: selectedJsa.id })}
          isLoading={isLoading}
        />
      )}

      {selectedPtw && (
        <PtwDetailModal
          ptw={selectedPtw}
          userRole={userRole}
          permissions={permissions}
          onClose={() => setSelectedPtw(null)}
          onApprove={() => handleApprovePtw(selectedPtw.id)}
          onReject={() => setRejectTarget({ type: 'ptw', id: selectedPtw.id })}
          isLoading={isLoading}
        />
      )}

      {rejectTarget && (
        <RejectModal
          onConfirm={handleConfirmReject}
          onCancel={() => setRejectTarget(null)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, MapPin, Calendar, AlertTriangle, Building2,
  FileSignature, ShieldAlert, Stamp, ArrowLeft, CheckCircle2, XCircle, X, Loader2, Check,
  Users, Activity, FileText, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import { ProjectDiscussion } from '@/components/project-discussion';
import { approveProcedure, rejectProcedure, approveJsa, rejectJsa, approvePtw, rejectPtw } from '@/app/dashboard/approval/actions';
import dynamic from 'next/dynamic';
import JsaPDF from '@/app/vendor/dashboard/jsa/create/[id]/JsaPDF';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false, loading: () => <div className="h-[600px] w-full bg-slate-100 flex items-center justify-center animate-pulse rounded-xl text-slate-400 font-medium">Memuat Pratinjau Dokumen...</div> }
);

const BlobProvider = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.BlobProvider),
  { ssr: false }
);

function AccordionItem({ title, icon, defaultOpen, badge, children }: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
       <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
             {icon}
             <h2 className="text-lg font-bold text-slate-800">{title}</h2>
             {badge}
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
       </button>
       {isOpen && <div className="p-6 border-t border-slate-200 bg-white">{children}</div>}
    </div>
  )
}

function DocumentModal({ isOpen, onClose, title, children }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 bg-slate-100">
           {children}
        </div>
      </div>
    </div>
  );
}

// Reuse RejectModal
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
            <h3 className="font-bold text-slate-800">Tolak & Kembalikan</h3>
            <p className="text-xs text-slate-500">Berikan catatan revisi untuk vendor.</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
          placeholder="Contoh: Tolong lengkapi mitigasi pada langkah ke-3..."
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
            Tolak Dokumen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProjectClient({ project, userRole, currentUserId }: { project: any, userRole: string, currentUserId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: 'prosedur' | 'jsa' | 'ptw'; id: string } | null>(null);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [fullScreenPreview, setFullScreenPreview] = useState<'prosedur' | 'jsa' | 'ptw' | null>(null);

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
  const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

  const prosedurRevisions = prosedur?.content?.revisions || [];
  const prosedurLastNote = prosedurRevisions.length > 0 ? prosedurRevisions[prosedurRevisions.length - 1].note : null;

  const prosedurStatus = prosedur?.status === 'Prosedur Disetujui' ? 'Approved' : prosedur?.status === 'Menunggu Review PM' ? 'Pending' : (prosedur?.status === 'Draft' && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
  const jsaStatus = jsa?.status === 'JSA Disetujui' ? 'Approved' : jsa?.status === 'Pembahasan JSA' || jsa?.status === 'Review PM' || jsa?.status === 'Review Asset Manager' ? 'Pending' : jsa?.rejection_note ? 'Rejected' : jsa ? 'Draft' : 'Draft';
  const ptwStatus = ptw?.status === 'PTW Aktif' ? 'Approved' : ptw?.status === 'Draft' ? 'Rejected' : ptw ? 'Pending' : 'Draft';

  const getStepStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Pending': return 'bg-amber-400 text-white border-amber-400';
      case 'Rejected': return 'bg-rose-500 text-white border-rose-500';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const getStepLineStyle = (status: string) => status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-200';

  const getStatusBadge = (status: string, detailedStatus?: string) => {
    if (status === 'Approved') return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Disetujui</span>;
    if (status === 'Pending') return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">{detailedStatus || 'Menunggu Review'}</span>;
    if (status === 'Rejected') return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Ditolak / Revisi</span>;
    return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
  };

  // Check if current user can approve specific docs
  const canApproveProsedur = userRole === 'pm' && prosedurStatus === 'Pending';
  const canApproveJsa = (userRole === 'pm' && jsa?.status === 'Pembahasan JSA') || (userRole === 'asset_manager' && jsa?.status === 'Review Asset Manager') || userRole === 'admin';
  const canApprovePtw = (userRole === 'ptw_authority' && ptw?.status === 'Menunggu Approval PM') || (userRole === 'ptw_issuer' && ptw?.status === 'Review PTW Issuer') || (userRole === 'hse' && ptw?.status === 'Menunggu Penomoran HSSE') || userRole === 'admin';

  const handleApprove = async (type: 'prosedur' | 'jsa' | 'ptw', id: string) => {
    if (!confirm('Anda yakin ingin menyetujui dokumen ini?')) return;
    setIsLoading(true);
    try {
      if (type === 'prosedur') await approveProcedure(id);
      if (type === 'jsa') await approveJsa(id, userRole);
      if (type === 'ptw') await approvePtw(id, userRole);
      router.refresh();
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
      if (rejectTarget.type === 'prosedur') await rejectProcedure(rejectTarget.id, note);
      if (rejectTarget.type === 'jsa') await rejectJsa(rejectTarget.id, note);
      if (rejectTarget.type === 'ptw') await rejectPtw(rejectTarget.id, note);
      setRejectTarget(null);
      router.refresh();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const openHtmlPreview = (htmlContent: string) => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<html><head><title>Preview Dokumen</title></head><body>${htmlContent}</body></html>`);
      win.document.close();
    }
  };

  // --- Dashboard Data Preparation ---
  const workers = ptw?.workers || [];
  
  // Hitung Sisa Waktu
  const endDate = new Date(project.end_date);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Hitung Chart Data Approval
  let approvedCount = 0;
  if(prosedurStatus === 'Approved') approvedCount++;
  if(jsaStatus === 'Approved') approvedCount++;
  if(ptwStatus === 'Approved') approvedCount++;
  
  const chartData = [
    { name: 'Disetujui', value: approvedCount, color: '#10b981' },
    { name: 'Sisa Dokumen', value: 3 - approvedCount, color: '#f1f5f9' }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {rejectTarget && (
        <RejectModal 
          onConfirm={handleConfirmReject} 
          onCancel={() => setRejectTarget(null)} 
          isLoading={isLoading} 
        />
      )}

      {/* Top Nav & Header */}
      <div>
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row gap-6 justify-between items-center relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2"></div>
          
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 relative z-10 w-full md:w-auto items-start sm:items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-sm text-white flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Briefcase className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{project.name}</h1>
              <div className="text-blue-200 mt-1 flex items-center gap-2 font-medium text-xs sm:text-sm">
                <Building2 className="w-4 h-4" /> {project.vendor_profiles?.company_name || 'Vendor Tidak Ditemukan'}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-slate-300">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                  <MapPin className="w-4 h-4 text-blue-300" /> {project.location}
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                  <Calendar className="w-4 h-4 text-blue-300" /> {project.start_date} s/d {project.end_date}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Info (Status) */}
          <div className="relative z-10 flex flex-col items-start md:items-end gap-1 w-full md:w-auto bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
            <div className="text-slate-300 text-sm font-medium">Status Keseluruhan Proyek</div>
            <div className="text-xl font-black flex items-center gap-2 mt-1">
               {ptwStatus === 'Approved' ? <><CheckCircle2 className="w-6 h-6 text-emerald-400" /> <span className="text-emerald-400">PTW AKTIF</span></> : <><AlertTriangle className="w-6 h-6 text-amber-400" /> <span className="text-amber-400">FASE PERSIAPAN</span></>}
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex space-x-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('ringkasan')} className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'ringkasan' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
           <Activity className="w-4 h-4" /> Ringkasan
        </button>
        <button onClick={() => setActiveTab('approval')} className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'approval' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
           <FileSignature className="w-4 h-4" /> Approval K3
        </button>
        <button onClick={() => setActiveTab('tim')} className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'tim' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
           <Users className="w-4 h-4" /> Tim Lapangan
        </button>
        <button onClick={() => setActiveTab('diskusi')} className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'diskusi' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
           <MessageSquare className="w-4 h-4" /> Diskusi
        </button>
      </div>

      {/* --- TAB CONTENT: RINGKASAN --- */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           {/* Action Center - Smart Warning */}
           {(canApproveProsedur || canApproveJsa || canApprovePtw) && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                 <div>
                    <h3 className="font-bold text-amber-800">Menunggu Tindakan Anda</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Ada dokumen yang memerlukan persetujuan Anda. Silakan ke tab <b>Approval K3</b> untuk melakukan *review*.
                    </p>
                 </div>
              </div>
           )}

           {/* Metrics Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center"><Calendar className="w-6 h-6 text-blue-200" /></div>
                 <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">Sisa Waktu Proyek</div>
                 <div className="text-3xl font-black text-slate-800 relative z-10">{diffDays > 0 ? `${diffDays} Hari` : 'Selesai'}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center"><Users className="w-6 h-6 text-emerald-200" /></div>
                 <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">Personil Aktif</div>
                 <div className="text-3xl font-black text-slate-800 relative z-10">{workers.length} <span className="text-sm font-normal text-slate-400">orang</span></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center"><Stamp className="w-6 h-6 text-indigo-200" /></div>
                 <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">Status Permit (PTW)</div>
                 <div className="text-xl font-black mt-2 relative z-10">
                    {ptwStatus === 'Approved' ? <span className="text-emerald-600">AKTIF</span> : <span className="text-slate-400">BELUM AKTIF</span>}
                 </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-rose-200" /></div>
                 <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">Total Insiden</div>
                 <div className="text-3xl font-black text-slate-800 relative z-10">0</div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                 {/* The Stepper / Pipeline */}
                 <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
                       <CheckCircle2 className="w-5 h-5 text-primary" /> Status Progress Keseluruhan
                    </h2>
                    
                    <div className="relative flex justify-between items-start max-w-lg mx-auto">
                      <div className="absolute top-6 left-0 right-0 h-1 bg-slate-100 -z-0"></div>
                      <div className={`absolute top-6 left-0 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(prosedurStatus)}`}></div>
                      <div className={`absolute top-6 left-1/2 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(jsaStatus)}`}></div>

                      <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors bg-white ${getStepStyle(prosedurStatus)}`}>
                          <FileSignature className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Prosedur Kerja</div>
                          <div className="mt-1">{getStatusBadge(prosedurStatus)}</div>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors bg-white ${getStepStyle(jsaStatus)}`}>
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">JSA &amp; HIRADC</div>
                          <div className="mt-1">{getStatusBadge(jsaStatus, jsa?.status)}</div>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors bg-white ${getStepStyle(ptwStatus)}`}>
                          <Stamp className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Permit to Work</div>
                          <div className="mt-1">{getStatusBadge(ptwStatus, ptw?.status)}</div>
                        </div>
                      </div>
                    </div>
                 </div>
              </div>
              
              <div>
                 {/* Recharts Donut */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center h-full">
                    <h3 className="font-bold text-slate-800 self-start mb-4">Kelengkapan Dokumen K3</h3>
                    <div className="h-48 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any, name: any) => [`${value} Dokumen`, name]}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-2">
                       <span className="text-3xl font-black text-slate-800">{approvedCount}/3</span>
                       <span className="text-sm text-slate-500 block font-medium mt-1">Dokumen Disetujui</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- TAB CONTENT: APPROVAL K3 --- */}
      {activeTab === 'approval' && (
         <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* --- BAGIAN 1: MENUNGGU PERSETUJUAN --- */}
            <div>
               <div className="flex items-center gap-2 mb-6">
                 <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                   <AlertTriangle className="w-4 h-4 text-amber-600" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800">Menunggu Persetujuan Anda</h2>
               </div>

               {/* JIKA PROSEDUR PENDING */}
               {prosedurStatus === 'Pending' && canApproveProsedur && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <FileSignature className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Prosedur Kerja (SOP)</h3>
                         </div>
                         <p className="text-amber-700 text-sm">Vendor telah mengajukan Prosedur Kerja. Silakan review dokumen di bawah ini.</p>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => setRejectTarget({ type: 'prosedur', id: prosedur.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak SOP</button>
                         <button onClick={() => handleApprove('prosedur', prosedur.id)} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui SOP</button>
                       </div>
                    </div>
                    <div className="bg-slate-100 p-2">
                      {prosedur?.content?.prosedur_html ? (
                         <div className="prose prose-slate max-w-none p-6 border border-slate-200 rounded-xl bg-white shadow-sm" dangerouslySetInnerHTML={{ __html: prosedur.content.prosedur_html }} />
                      ) : prosedur?.content ? (
                        <PDFViewer width="100%" height="700" className="border-none rounded-2xl bg-white shadow-sm">
                           <ProsedurPDF data={{ 
                             ...prosedur.content, 
                             projectName: prosedur.content.projectName || project.name || 'Proyek',
                             apd: prosedur.content.apd || prosedur.content.selectedApd || [],
                             tools: prosedur.content.tools || [],
                             perlengkapanLainnya: prosedur.content.perlengkapanLainnya || [],
                             tahapanPekerjaan: prosedur.content.tahapanPekerjaan || [],
                             revisions: prosedur.content.revisions || [],
                           }} />
                        </PDFViewer>
                      ) : (
                        <div className="p-12 text-center text-slate-500">Format dokumen tidak valid.</div>
                      )}
                    </div>
                 </div>
               )}

               {/* JIKA JSA PENDING */}
               {jsaStatus === 'Pending' && canApproveJsa && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <ShieldAlert className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Job Safety Analysis (JSA)</h3>
                         </div>
                         <p className="text-amber-700 text-sm">Vendor telah mengajukan JSA. Silakan review mitigasi risiko di bawah ini.</p>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => setRejectTarget({ type: 'jsa', id: jsa.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak JSA</button>
                         <button onClick={() => handleApprove('jsa', jsa.id)} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui JSA</button>
                       </div>
                    </div>
                    <div className="bg-slate-100 p-2">
                      <PDFViewer width="100%" height="700" className="border-none rounded-2xl bg-white shadow-sm">
                         <JsaPDF projectId={project.id} steps={jsa?.jsa_steps?.map((step: any) => {
                           let bahayaObj: any = {}; let risikoObj: any = {}; let tindakanObj: any = {};
                           try { bahayaObj = typeof step.bahaya === 'string' ? JSON.parse(step.bahaya) : step.bahaya || {}; } catch(e) {}
                           try { risikoObj = typeof step.risiko === 'string' ? JSON.parse(step.risiko) : step.risiko || {}; } catch(e) {}
                           try { tindakanObj = typeof step.tindakan === 'string' ? JSON.parse(step.tindakan) : step.tindakan || {}; } catch(e) {}
                           return {
                             langkah: step.pekerjaan, jenisBahaya: bahayaObj.jenisBahaya || '', sebab: bahayaObj.sebab || '',
                             potensiBahaya: bahayaObj.potensiBahaya || '', faktorPositif: risikoObj.faktorPositif || null,
                             inherentRisk: risikoObj.inherentRisk || null, mitigasi: tindakanObj.mitigasi || null, residualRisk: tindakanObj.residualRisk || null
                           };
                         }) || []} />
                      </PDFViewer>
                    </div>
                 </div>
               )}

               {/* JIKA PTW PENDING */}
               {ptwStatus === 'Pending' && canApprovePtw && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <Stamp className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Permit to Work (PTW)</h3>
                         </div>
                         <p className="text-amber-700 text-sm">Vendor telah melengkapi PTW. Silakan review pekerja & peralatan.</p>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => setRejectTarget({ type: 'ptw', id: ptw.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak PTW</button>
                         <button onClick={() => handleApprove('ptw', ptw.id)} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui PTW</button>
                       </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" /> Pekerja Terdaftar
                          </div>
                          <div className="p-5 space-y-4">
                            {ptw.workers?.map((w: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                <span className="font-bold text-slate-800">{w.worker_name}</span>
                                <span className="text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">{w.worker_role}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-500" /> Peralatan & Tools
                          </div>
                          <div className="p-5 space-y-4">
                            {ptw.equipment?.map((e: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                <span className="font-bold text-slate-800">{e.name}</span>
                                <span className="text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">{e.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                 </div>
               )}

               {/* KALO TIDAK ADA YANG PENDING */}
               {((!canApproveProsedur || prosedurStatus !== 'Pending') && 
                 (!canApproveJsa || jsaStatus !== 'Pending') && 
                 (!canApprovePtw || ptwStatus !== 'Pending')) && (
                 <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-12 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-800">Tidak ada dokumen yang perlu di-review</h3>
                    <p className="text-slate-500 mt-2">Semua dokumen sudah disetujui atau sedang dikerjakan oleh vendor.</p>
                 </div>
               )}
            </div>

            <hr className="border-slate-200" />

            {/* --- BAGIAN 2: DOKUMEN REFERENSI (SUDAH DISETUJUI) --- */}
            <div>
               <div className="flex items-center gap-2 mb-6">
                 <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                   <FileText className="w-4 h-4 text-slate-500" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800">Dokumen Referensi (Disetujui)</h2>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* REFERENSI SOP */}
                  {prosedurStatus === 'Approved' ? (
                     <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                           <FileSignature className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Prosedur Kerja</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-6">Dokumen SOP (Standard Operating Procedure) yang telah disetujui.</p>
                        {prosedur?.content?.prosedur_html ? (
                          <button 
                            onClick={() => {
                              const newWin = window.open('', '_blank');
                              if(newWin) {
                                newWin.document.write(`
                                  <html>
                                    <head><title>Prosedur Kerja</title></head>
                                    <body style="font-family: sans-serif; padding: 40px;">
                                      ${prosedur.content.prosedur_html}
                                      <script>window.print();</script>
                                    </body>
                                  </html>
                                `);
                                newWin.document.close();
                              }
                            }}
                            className="w-full py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                          >
                            Buka & Print Dokumen
                          </button>
                        ) : (
                          <BlobProvider document={<ProsedurPDF data={{ 
                            ...prosedur.content, 
                            projectName: prosedur.content.projectName || project.name || 'Proyek',
                            apd: prosedur.content.apd || prosedur.content.selectedApd || [],
                            tools: prosedur.content.tools || [],
                            perlengkapanLainnya: prosedur.content.perlengkapanLainnya || [],
                            tahapanPekerjaan: prosedur.content.tahapanPekerjaan || [],
                            revisions: prosedur.content.revisions || [],
                          }} />}>
                            {({ url, loading }) => (
                              <button 
                                disabled={loading}
                                onClick={() => { if(url) window.open(url, '_blank'); }}
                                className="w-full py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50"
                              >
                                {loading ? 'Membuat PDF...' : 'Buka & Print Dokumen'}
                              </button>
                            )}
                          </BlobProvider>
                        )}
                     </div>
                  ) : (
                     <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center opacity-70">
                        <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="font-bold text-slate-500">Prosedur Kerja</h3>
                        <p className="text-xs text-slate-400 mt-1">Belum Disetujui</p>
                     </div>
                  )}

                  {/* REFERENSI JSA */}
                  {jsaStatus === 'Approved' ? (
                     <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                           <ShieldAlert className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Job Safety Analysis</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-6">Dokumen identifikasi bahaya dan mitigasi risiko proyek.</p>
                        <BlobProvider document={
                          <JsaPDF projectId={project.id} steps={jsa?.jsa_steps?.map((step: any) => {
                            let bahayaObj: any = {}; let risikoObj: any = {}; let tindakanObj: any = {};
                            try { bahayaObj = typeof step.bahaya === 'string' ? JSON.parse(step.bahaya) : step.bahaya || {}; } catch(e) {}
                            try { risikoObj = typeof step.risiko === 'string' ? JSON.parse(step.risiko) : step.risiko || {}; } catch(e) {}
                            try { tindakanObj = typeof step.tindakan === 'string' ? JSON.parse(step.tindakan) : step.tindakan || {}; } catch(e) {}
                            return {
                              langkah: step.pekerjaan, jenisBahaya: bahayaObj.jenisBahaya || '', sebab: bahayaObj.sebab || '',
                              potensiBahaya: bahayaObj.potensiBahaya || '', faktorPositif: risikoObj.faktorPositif || null,
                              inherentRisk: risikoObj.inherentRisk || null, mitigasi: tindakanObj.mitigasi || null, residualRisk: tindakanObj.residualRisk || null
                            };
                          }) || []} />
                        }>
                          {({ url, loading }) => (
                            <button 
                              disabled={loading}
                              onClick={() => { if(url) window.open(url, '_blank'); }}
                              className="w-full py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {loading ? 'Membuat PDF...' : 'Buka & Print Dokumen'}
                            </button>
                          )}
                        </BlobProvider>
                     </div>
                  ) : (
                     <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center opacity-70">
                        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="font-bold text-slate-500">Job Safety Analysis</h3>
                        <p className="text-xs text-slate-400 mt-1">Belum Disetujui</p>
                     </div>
                  )}

                  {/* REFERENSI PTW */}
                  {ptwStatus === 'Approved' ? (
                     <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                           <Stamp className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Permit to Work</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-6">Surat Izin Kerja Aman (SIKA) yang telah aktif.</p>
                        <button 
                          onClick={() => {
                            const newWin = window.open('', '_blank');
                            if(newWin) {
                              newWin.document.write(`
                                <html>
                                  <head>
                                    <title>Permit to Work</title>
                                    <style>
                                      body { font-family: sans-serif; padding: 40px; }
                                      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                                      th { background: #eee; }
                                    </style>
                                  </head>
                                  <body>
                                    <h1 style="text-align:center;">PERMIT TO WORK (PTW)</h1>
                                    <h3 style="margin-top: 40px;">Daftar Pekerja Terdaftar</h3>
                                    <table>
                                      <thead><tr><th>Nama Pekerja</th><th>Peran</th></tr></thead>
                                      <tbody>
                                        ${ptw.workers?.map((w: any) => `<tr><td>${w.worker_name}</td><td>${w.worker_role}</td></tr>`).join('') || ''}
                                      </tbody>
                                    </table>
                                    <h3 style="margin-top: 40px;">Daftar Peralatan & Tools</h3>
                                    <table>
                                      <thead><tr><th>Nama Peralatan</th><th>Jenis</th></tr></thead>
                                      <tbody>
                                        ${ptw.equipment?.map((e: any) => `<tr><td>${e.name}</td><td>${e.type}</td></tr>`).join('') || ''}
                                      </tbody>
                                    </table>
                                    <script>window.print();</script>
                                  </body>
                                </html>
                              `);
                              newWin.document.close();
                            }
                          }}
                          className="w-full py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                        >
                          Buka & Print PTW
                        </button>
                     </div>
                  ) : (
                     <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center opacity-70">
                        <Stamp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="font-bold text-slate-500">Permit to Work</h3>
                        <p className="text-xs text-slate-400 mt-1">Belum Aktif</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* --- TAB CONTENT: TIM LAPANGAN --- */}
      {activeTab === 'tim' && (
         <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
              <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" /> Personil Lapangan Aktif
              </h2>
              <p className="text-slate-500 mb-8 text-sm">Daftar personil dan pekerja yang telah disetujui dalam dokumen PTW untuk berada di lokasi proyek.</p>
              
              {workers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workers.map((w: any, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-3 p-6 border border-slate-100 rounded-2xl hover:shadow-lg transition-all bg-white hover:border-blue-100 group">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-50 flex items-center justify-center font-black text-2xl text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                         {w.worker_name.substring(0,2).toUpperCase()}
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-800 text-lg">{w.worker_name}</div>
                        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full inline-block mt-2 font-bold">{w.worker_role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                   <Users className="w-16 h-16 text-slate-300 mb-4" />
                   <div className="text-slate-500 font-medium">Belum ada tim yang didaftarkan.</div>
                   <div className="text-sm text-slate-400 mt-1">Selesaikan dokumen PTW untuk melihat daftar tim.</div>
                </div>
              )}
            </div>
         </div>
      )}

      {/* --- TAB CONTENT: DISKUSI --- */}
      {activeTab === 'diskusi' && (
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 p-8 min-h-[600px]">
            <ProjectDiscussion projectId={project.id} currentUserId={currentUserId} />
         </div>
      )}

    </div>
  );
}

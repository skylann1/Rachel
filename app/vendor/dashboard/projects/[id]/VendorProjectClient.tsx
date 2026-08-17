'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, MapPin, Calendar, AlertTriangle,
  FileSignature, ShieldAlert, Stamp, ArrowRight, ArrowLeft,
  FileText, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Loader2, QrCode, Siren,
  ClipboardList, LogIn, Clock, Users
} from 'lucide-react';
import { ProjectDiscussion } from '@/components/project-discussion';
import dynamic from 'next/dynamic';
import JsaPDF from '@/app/vendor/dashboard/jsa/create/[id]/JsaPDF';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';
import PtwPDF from '@/components/ptw/PtwPDF';
import CheckinQrModal from '@/components/ptw/CheckinQrModal';
import { getEffectivePtwStatus, PTW_STATUS } from '@/lib/ptw-status';
import { isJsaPending, JSA_STATUS } from '@/lib/jsa-status';
import { PROCEDURE_STATUS } from '@/lib/procedure-status';
import { PTW_TYPES } from '@/lib/ptw-types';
import { buildCheckinUrl } from '@/lib/site-ops';

const BlobProvider = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.BlobProvider),
  { ssr: false }
);

function AccordionItem({ title, icon, defaultOpen, badge, children }: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-2xl overflow-hidden bg-white transition-all duration-300 ${isOpen ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-slate-200 shadow-sm'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-5 text-left transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${isOpen ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-100 text-slate-500'}`}>
            {icon}
          </div>
          <div>
            <h3 className={`font-bold text-lg ${isOpen ? 'text-primary' : 'text-slate-800'}`}>{title}</h3>
            {badge && <div className="mt-1">{badge}</div>}
          </div>
        </div>
        <div className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-primary/10 text-primary' : 'text-slate-400 bg-slate-100'}`}>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>
      {isOpen && (
        <div className="p-6 border-t border-slate-100 bg-white animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

export function VendorProjectClient({ project, currentUserId, jsaSignatories, ptwSignatories, siteCheckins, toolboxMeetings }: {
  project: any; currentUserId: string; jsaSignatories?: any; ptwSignatories?: Record<string, any>;
  /** Riwayat check-in lapangan (site_checkins) lintas semua PTW proyek ini, terbaru dulu. */
  siteCheckins?: any[];
  /** Riwayat toolbox meeting (toolbox_meetings) lintas semua PTW proyek ini, terbaru dulu. */
  toolboxMeetings?: any[];
}) {
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [qrModalToken, setQrModalToken] = useState<string | null>(null);

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — lihat lib/project-stage.ts
  const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
  const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
  const vendorProfile = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;

  const prosedurRevisions = prosedur?.content?.revisions || [];
  const prosedurLastNote = prosedurRevisions.length > 0 ? prosedurRevisions[prosedurRevisions.length - 1].note : null;

  // Normalize statuses for UI logic
  const prosedurStatus = prosedur?.status === PROCEDURE_STATUS.approved ? 'Approved' : prosedur?.status === PROCEDURE_STATUS.menungguReviewPM ? 'Pending' : (prosedur?.status === PROCEDURE_STATUS.draft && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
  const jsaStatus = jsa?.rejection_note ? 'Rejected'
    : jsa?.status === JSA_STATUS.approved ? 'Approved'
    : isJsaPending(jsa?.status) ? 'Pending'
    : jsa ? 'Draft' : 'Draft';

  // PTW tahap proyek: hijau hanya kalau SEMUA tipe PTW yang diajukan sudah Aktif.
  const ptwEffectiveStatuses = ptws.map(p => getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date));
  const ptwAnyExpired = ptwEffectiveStatuses.some(s => s === PTW_STATUS.expired);
  const ptwAnyStopped = ptwEffectiveStatuses.some(s => s === PTW_STATUS.stoppedSwa);
  const ptwAllAktif = ptws.length > 0 && ptwEffectiveStatuses.every(s => s === PTW_STATUS.aktif);
  const ptwAnyRejected = ptws.some(p => p.status === PTW_STATUS.draft && p.rejection_note);
  const ptwStatus = ptwAnyStopped ? 'Stopped'
    : ptwAnyExpired ? 'Expired'
    : ptwAllAktif ? 'Approved'
    : ptwAnyRejected ? 'Rejected'
    : ptws.length > 0 ? 'Pending' : 'Draft';
  const ptwAktifCount = ptwEffectiveStatuses.filter(s => s === PTW_STATUS.aktif).length;

  const getStepStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Pending': return 'bg-amber-400 text-white border-amber-400';
      case 'Rejected': return 'bg-rose-500 text-white border-rose-500';
      case 'Expired': return 'bg-slate-400 text-white border-slate-400';
      case 'Stopped': return 'bg-red-600 text-white border-red-600';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const getStepLineStyle = (status: string) => status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-200';

  const getStatusBadge = (status: string, detailedStatus?: string) => {
    if (status === 'Approved') return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Disetujui</span>;
    if (status === 'Pending') return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">{detailedStatus || 'Dalam Review'}</span>;
    if (status === 'Rejected') return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Perlu Revisi</span>;
    if (status === 'Expired') return <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Kedaluwarsa</span>;
    if (status === 'Stopped') return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Stop Work</span>;
    return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
  };

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan Proyek', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'dokumen', label: 'Dokumen K3', icon: <FileText className="w-4 h-4" /> },
    { id: 'lapangan', label: 'Status Lapangan', icon: <Siren className="w-4 h-4" /> },
    { id: 'diskusi', label: 'Diskusi & Notes', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  // Tab "Status Lapangan" — check-in/toolbox meeting lintas semua tipe PTW proyek ini.
  const ptwTitleById = Object.fromEntries(ptws.map((p: any) => [p.id, PTW_TYPES.find(t => t.id === p.ptw_type)?.title.split('(')[0].trim() || p.ptw_type]));
  const openSiteCheckins = (siteCheckins || []).filter((c: any) => !c.checked_out_at);
  const closedSiteCheckins = (siteCheckins || []).filter((c: any) => c.checked_out_at);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {qrModalToken && (
        <CheckinQrModal
          url={buildCheckinUrl(qrModalToken, typeof window !== 'undefined' ? window.location.origin : undefined)}
          onClose={() => setQrModalToken(null)}
        />
      )}

      {/* Top Nav */}
      <div>
        <Link href="/vendor/dashboard/projects" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Proyek
        </Link>
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
              <div className="text-blue-200 mt-1 flex flex-wrap items-center gap-2 font-medium text-xs sm:text-sm">
                <span className="bg-white/10 px-2 py-0.5 rounded text-xs uppercase tracking-wider font-bold">ID: {project.id.slice(0, 8)}</span>
                {project.status === 'Aktif' && (
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    Ongoing
                  </span>
                )}
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
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex space-x-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === tab.id 
                ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* --- TAB: RINGKASAN PROYEK --- */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-8">Status Pengajuan PTW</h2>
            
            <div className="relative flex justify-between items-start max-w-3xl mx-auto">
              <div className="absolute top-6 left-0 right-0 h-1 bg-slate-100 -z-0"></div>
              <div className={`absolute top-6 left-0 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(prosedurStatus)}`}></div>
              <div className={`absolute top-6 left-1/2 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(jsaStatus)}`}></div>

              <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(prosedurStatus)}`}>
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Prosedur Kerja</div>
                  <div className="mt-1">{getStatusBadge(prosedurStatus)}</div>
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(jsaStatus)}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">JSA &amp; HIRADC</div>
                  <div className="mt-1">{getStatusBadge(jsaStatus, jsa?.status)}</div>
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(ptwStatus)}`}>
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Permit to Work</div>
                  <div className="mt-1">{getStatusBadge(ptwStatus, ptws.length > 0 ? `${ptwAktifCount}/${ptws.length} Aktif` : undefined)}</div>
                  {ptws.filter(p => p.ptw_number).map(p => (
                    <div key={p.id} className="text-xs font-black text-emerald-600 mt-1">{p.ptw_number}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: DOKUMEN K3 --- */}
      {activeTab === 'dokumen' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-8">
            <h3 className="text-blue-800 font-bold mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Manajemen Dokumen K3
            </h3>
            <p className="text-sm text-blue-600/80">Lengkapi dokumen secara berurutan. Anda dapat melihat atau mem-print dokumen yang telah Anda ajukan dengan mengklik tombol "Buka & Print Dokumen".</p>
          </div>

          <div className="space-y-4">
            
            {/* Prosedur Accordion */}
            <AccordionItem 
              title="1. Prosedur Kerja (SOP)" 
              icon={<FileSignature className="w-6 h-6" />}
              defaultOpen={prosedurStatus !== 'Approved'}
              badge={getStatusBadge(prosedurStatus)}
            >
              <div className="space-y-4">
                {prosedurStatus === 'Rejected' && prosedurLastNote && (
                  <div className="p-4 bg-rose-50 rounded-xl text-sm text-rose-700 font-medium border border-rose-100">
                    <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                    <span className="font-bold">Catatan Revisi:</span> {prosedurLastNote}
                  </div>
                )}
                
                <div className="flex gap-4">
                  {(prosedurStatus === 'Pending' || prosedurStatus === 'Approved' || prosedurStatus === 'Rejected') && (
                    <div className="flex-1">
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
                          className="w-full py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-colors shadow-sm"
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
                              className="w-full py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                            >
                              {loading ? 'Membuat PDF...' : 'Buka & Print Dokumen'}
                            </button>
                          )}
                        </BlobProvider>
                      )}
                    </div>
                  )}

                  {prosedurStatus !== 'Approved' && prosedurStatus !== 'Pending' && (
                    <div className="flex-1">
                      <Link href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                        {prosedur ? 'Revisi Dokumen' : 'Buat Dokumen'} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </AccordionItem>

            {/* JSA Accordion */}
            <AccordionItem 
              title="2. Job Safety Analysis (JSA)" 
              icon={<ShieldAlert className="w-6 h-6" />}
              defaultOpen={prosedurStatus === 'Approved' && jsaStatus !== 'Approved'}
              badge={getStatusBadge(jsaStatus, jsa?.status)}
            >
              <div className="space-y-4">
                {jsa?.rejection_note && (
                  <div className="p-4 bg-rose-50 rounded-xl text-sm text-rose-700 font-medium border border-rose-100">
                    <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                    <span className="font-bold">Catatan Revisi:</span> {jsa.rejection_note}
                  </div>
                )}

                <div className="flex gap-4">
                  {(jsaStatus === 'Pending' || jsaStatus === 'Approved' || jsaStatus === 'Rejected') && (
                    <div className="flex-1">
                      <BlobProvider document={
                        <JsaPDF projectId={project.id} signatories={jsaSignatories} preparer={{ satker: vendorProfile?.company_name }} steps={jsa?.jsa_steps?.map((step: any) => {
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
                            className="w-full py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                          >
                            {loading ? 'Membuat PDF...' : 'Buka & Print Dokumen'}
                          </button>
                        )}
                      </BlobProvider>
                    </div>
                  )}

                  {jsaStatus !== 'Approved' && jsaStatus !== 'Pending' && (
                    <div className="flex-1">
                      {prosedurStatus !== 'Approved' ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-center text-sm font-medium text-slate-500 border border-slate-200 border-dashed">
                          Selesaikan dan tunggu Prosedur Kerja disetujui terlebih dahulu.
                        </div>
                      ) : (
                        <Link href={`/vendor/dashboard/jsa/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                          {jsa ? 'Revisi Dokumen' : 'Buat Dokumen'} <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionItem>

            {/* PTW Accordion */}
            <AccordionItem
              title="3. Permit to Work (PTW)"
              icon={<Stamp className="w-6 h-6" />}
              defaultOpen={jsaStatus === 'Approved' && ptwStatus !== 'Approved'}
              badge={getStatusBadge(ptwStatus, ptws.length > 0 ? `${ptwAktifCount}/${ptws.length} Aktif` : undefined)}
            >
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Satu pekerjaan bisa membutuhkan lebih dari satu jenis izin kerja sekaligus (mis. Kerja Dingin + Kerja di Ketinggian + Kerja Panas).
                </p>

                {ptws.length === 0 ? (
                  jsaStatus !== 'Approved' ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-sm font-medium text-slate-500 border border-slate-200 border-dashed">
                      Selesaikan dan tunggu JSA disetujui terlebih dahulu.
                    </div>
                  ) : (
                    <Link href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                      Ajukan PTW <ArrowRight className="w-4 h-4" />
                    </Link>
                  )
                ) : (
                  <div className="space-y-3">
                    {ptws.map((row) => {
                      const rowEffective = getEffectivePtwStatus(row.status, row.valid_to ?? project.end_date);
                      const rowStatus = rowEffective === PTW_STATUS.stoppedSwa ? 'Stopped'
                        : rowEffective === PTW_STATUS.aktif ? 'Approved'
                        : rowEffective === PTW_STATUS.expired ? 'Expired'
                        : (row.status === PTW_STATUS.draft && row.rejection_note) ? 'Rejected'
                        : 'Pending';
                      const rowTitle = PTW_TYPES.find(t => t.id === row.ptw_type)?.title.split('(')[0].trim() || row.ptw_type;

                      return (
                        <div key={row.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-800">{rowTitle}</span>
                            {getStatusBadge(rowStatus, row.status)}
                          </div>

                          {row.rejection_note && (
                            <div className="p-3 bg-rose-50 rounded-lg text-sm text-rose-700 font-medium border border-rose-100">
                              <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                              <span className="font-bold">Catatan Revisi:</span> {row.rejection_note}
                            </div>
                          )}

                          {rowStatus === 'Stopped' && (
                            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-800 font-medium border border-red-200 space-y-1">
                              <div className="flex items-center gap-2 font-bold text-red-700"><Siren className="w-4 h-4" /> Stop Work Authority</div>
                              <p><strong>Dilaporkan oleh:</strong> {row.stopped_by_name}</p>
                              <p><strong>Alasan:</strong> {row.stopped_reason}</p>
                              <p className="text-xs text-red-600">Hubungi PM/HSSE untuk mengaktifkan kembali PTW ini.</p>
                            </div>
                          )}

                          {row.field_token && rowStatus === 'Approved' && (
                            <button
                              onClick={() => setQrModalToken(row.field_token)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                            >
                              <QrCode className="w-4 h-4" /> QR Check-in Lapangan
                            </button>
                          )}

                          <div className="flex gap-3">
                            <div className="flex-1">
                              <BlobProvider document={
                                <PtwPDF
                                  projectId={project.id}
                                  ptwNumber={row.ptw_number}
                                  projectName={project.name}
                                  vendorName={vendorProfile?.company_name}
                                  location={project.location}
                                  startDate={project.start_date}
                                  endDate={project.end_date}
                                  description={project.description}
                                  ptwType={row.ptw_type || 'dingin'}
                                  hazards={row.hazards || []}
                                  apd={row.apd || {}}
                                  pekerja={row.workers || []}
                                  peralatan={row.equipment || []}
                                  gasTests={row.gas_tests || []}
                                  validFrom={row.valid_from}
                                  validTo={row.valid_to}
                                  workStart={row.work_start}
                                  workEnd={row.work_end}
                                  hotWorkTypes={row.hot_work_types || []}
                                  gasTestFrequency={row.gas_test_frequency || {}}
                                  jsaNumber={jsa?.id ? `JSA-${jsa.id.slice(0, 8).toUpperCase()}` : null}
                                  siblings={ptws}
                                  signatories={ptwSignatories?.[row.id]}
                                />
                              }>
                                {({ url, loading }) => (
                                  <button
                                    disabled={loading}
                                    onClick={() => { if (url) window.open(url, '_blank'); }}
                                    className="w-full py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                                  >
                                    {loading ? 'Membuat PDF...' : 'Buka & Print PTW'}
                                  </button>
                                )}
                              </BlobProvider>
                            </div>
                            {(rowStatus === 'Rejected' || rowStatus === 'Expired') && (
                              <Link
                                href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}/${row.ptw_type}`}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30"
                              >
                                Revisi Dokumen <ArrowRight className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Link
                      href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 font-bold text-sm transition-colors"
                    >
                      + Ajukan PTW Tipe Lain
                    </Link>
                  </div>
                )}
              </div>
            </AccordionItem>

          </div>
        </div>
      )}

      {/* --- TAB CONTENT: STATUS LAPANGAN --- */}
      {activeTab === 'lapangan' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {ptws.filter((p: any) => p.field_token).length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 border-dashed shadow-sm text-center">
                <Siren className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Belum ada PTW aktif dengan QR Check-in untuk proyek ini.</p>
              </div>
            ) : (
              <>
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> QR Check-in per Izin Kerja</h2>
                  <p className="text-slate-500 mb-5 text-sm">Tampilkan/cetak QR ini di lokasi kerja — siapa pun bisa scan untuk toolbox meeting, check-in/out, dan Stop Work Authority tanpa login.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ptws.filter((p: any) => p.field_token).map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => setQrModalToken(p.field_token)}
                        className="flex items-center justify-between gap-2 p-4 border border-slate-200 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-800">{ptwTitleById[p.id]}</div>
                          <div className="text-xs text-slate-400">{p.ptw_number || 'Belum bernomor'}</div>
                        </div>
                        <QrCode className="w-5 h-5 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> Sedang Check-in di Lokasi
                    <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{openSiteCheckins.length}</span>
                  </h2>
                  <p className="text-slate-500 mb-5 text-sm">Pekerja yang check-in lewat QR dan belum check-out.</p>
                  {openSiteCheckins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <LogIn className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">Tidak ada yang sedang check-in saat ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {openSiteCheckins.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 p-3 border border-slate-100 rounded-xl">
                          <div>
                            <p className="font-bold text-sm text-slate-800">{c.worker_name}</p>
                            <p className="text-xs text-slate-400">{ptwTitleById[c.ptw_id]}</p>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" /> Sejak {new Date(c.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {closedSiteCheckins.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600">Riwayat check-out ({closedSiteCheckins.length})</summary>
                      <div className="space-y-2 mt-3">
                        {closedSiteCheckins.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between gap-2 p-3 border border-slate-100 rounded-xl bg-slate-50/50 text-slate-500">
                            <div>
                              <p className="font-bold text-sm">{c.worker_name}</p>
                              <p className="text-xs text-slate-400">{ptwTitleById[c.ptw_id]}</p>
                            </div>
                            <span className="text-xs">
                              {new Date(c.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – {new Date(c.checked_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> Riwayat Toolbox Meeting</h2>
                  <p className="text-slate-500 mb-5 text-sm">Briefing keselamatan harian yang dicatat sebelum pekerja bisa check-in.</p>
                  {(!toolboxMeetings || toolboxMeetings.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <ClipboardList className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">Belum ada toolbox meeting tercatat.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {toolboxMeetings.map((m: any) => (
                        <div key={m.id} className="p-4 border border-slate-100 rounded-xl">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">{ptwTitleById[m.ptw_id]}</span>
                            <span className="text-xs text-slate-400">{new Date(m.meeting_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          </div>
                          <p className="text-sm text-slate-700">{m.topics}</p>
                          <p className="text-xs text-slate-500 mt-1">Dipimpin oleh <strong>{m.conducted_by_name}</strong> · {(m.attendees || []).length} peserta hadir</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
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

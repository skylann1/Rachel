'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Briefcase, MapPin, Calendar, AlertTriangle,
  FileSignature, ShieldAlert, Stamp, ArrowRight, ArrowLeft,
  FileText, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { ProjectDiscussion } from '@/components/project-discussion';
import dynamic from 'next/dynamic';
import JsaPDF from '@/app/vendor/dashboard/jsa/create/[id]/JsaPDF';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';

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

export function VendorProjectClient({ project, currentUserId }: { project: any; currentUserId: string }) {
  const [activeTab, setActiveTab] = useState('ringkasan');

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
  const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

  const prosedurRevisions = prosedur?.content?.revisions || [];
  const prosedurLastNote = prosedurRevisions.length > 0 ? prosedurRevisions[prosedurRevisions.length - 1].note : null;

  // Normalize statuses for UI logic
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
    if (status === 'Pending') return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">{detailedStatus || 'Dalam Review'}</span>;
    if (status === 'Rejected') return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Perlu Revisi</span>;
    return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
  };

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan Proyek', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'dokumen', label: 'Dokumen K3', icon: <FileText className="w-4 h-4" /> },
    { id: 'diskusi', label: 'Diskusi & Notes', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
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
                  <div className="mt-1">{getStatusBadge(ptwStatus, ptw?.status)}</div>
                  {ptw?.ptw_number && <div className="text-xs font-black text-emerald-600 mt-1">{ptw.ptw_number}</div>}
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
              badge={getStatusBadge(ptwStatus, ptw?.status)}
            >
              <div className="space-y-4">
                {ptw?.rejection_note && (
                  <div className="p-4 bg-rose-50 rounded-xl text-sm text-rose-700 font-medium border border-rose-100">
                    <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                    <span className="font-bold">Catatan Revisi:</span> {ptw.rejection_note}
                  </div>
                )}

                <div className="flex gap-4">
                  {(ptwStatus === 'Pending' || ptwStatus === 'Approved' || ptwStatus === 'Rejected') && (
                    <div className="flex-1">
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
                        className="w-full py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-colors shadow-sm"
                      >
                        Buka & Print PTW
                      </button>
                    </div>
                  )}

                  {ptwStatus !== 'Approved' && ptwStatus !== 'Pending' && (
                    <div className="flex-1">
                      {jsaStatus !== 'Approved' ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-center text-sm font-medium text-slate-500 border border-slate-200 border-dashed">
                          Selesaikan dan tunggu JSA disetujui terlebih dahulu.
                        </div>
                      ) : (
                        <Link href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                          {ptw ? 'Revisi Dokumen' : 'Ajukan PTW'} <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionItem>

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

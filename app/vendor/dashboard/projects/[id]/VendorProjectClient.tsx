'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, MapPin, Calendar, AlertTriangle,
  FileSignature, ShieldAlert, Stamp, ArrowRight, ArrowLeft,
  FileText, MessageSquare, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, QrCode, Siren,
  ClipboardList, LogIn, Clock, Users, History, ClipboardCheck
} from 'lucide-react';
import { ProjectDiscussion } from '@/components/project-discussion';
import dynamic from 'next/dynamic';
import JsaPDF from '@/app/vendor/dashboard/jsa/create/[id]/JsaPDF';
import { ProsedurPDF } from '@/app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF';
import { buildProsedurPdfData } from '@/lib/prosedur-pdf-data';
import { ChangeLogPanel } from '@/components/prosedur/ChangeLogPanel';
import PtwPDF from '@/components/ptw/PtwPDF';
import PtwSafetyCheckTab from '@/components/ptw/PtwSafetyCheckTab';
import PtwFieldAssignmentsPanel from '@/components/ptw/PtwFieldAssignmentsPanel';
import PtwDailyCheckTab from '@/components/ptw/PtwDailyCheckTab';
import PtwClosureModal from '@/components/ptw/PtwClosureModal';
import PtwExtensionModal from '@/components/ptw/PtwExtensionModal';
import PtwOvertimeModal from '@/components/ptw/PtwOvertimeModal';
import { OVERTIME_TONE, overtimeMinutes, formatDuration } from '@/lib/ptw-overtime';
import { requestProjectCompletion } from '@/app/dashboard/projects/[id]/completion-actions';
import { assignFieldRole, submitDailyCheck } from '@/app/dashboard/projects/[id]/actions';
import { todayDateString } from '@/lib/site-ops';
import CheckinQrModal from '@/components/ptw/CheckinQrModal';
import { getEffectivePtwStatus, PTW_STATUS, PTW_STAGE_SEQUENCE, ptwStageIndex } from '@/lib/ptw-status';
import { isJsaPending, JSA_STATUS, JSA_STAGE_SEQUENCE, jsaStageIndex } from '@/lib/jsa-status';
import { PROCEDURE_STATUS, isProcedurePending, PROCEDURE_STAGE_SEQUENCE, procedureStageIndex } from '@/lib/procedure-status';
import { StageRail, type RailTone } from '@/components/internal/stage-rail';
import { PTW_TYPES } from '@/lib/ptw-types';
import { buildCheckinUrl } from '@/lib/site-ops';
import { DOC_TYPE_LABEL, type DocLogType } from '@/lib/document-logs';
import VendorAssignmentPanel from './VendorAssignmentPanel';

function docLogIcon(docType: DocLogType) {
  if (docType === 'procedure') return FileText;
  if (docType === 'jsa') return ShieldAlert;
  return Stamp;
}

/** Colours a log entry by what happened, read off the action text set in lib/document-logs.ts callers. */
function docLogTone(action: string) {
  if (/ditolak/i.test(action)) return { text: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: XCircle };
  if (/disetujui|direview|diterbitkan/i.test(action)) return { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 };
  return { text: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: FileSignature };
}

/**
 * Dari sisi vendor tidak ada tahap "milikmu" — vendor mengajukan lalu
 * menunggu, jadi tone 'action' tidak pernah dipakai di layar ini.
 */
function vendorRailTone(status: string): RailTone {
  if (status === 'Approved' || status === 'Closed') return 'done';
  if (status === 'Rejected') return 'returned';
  if (status === 'Pending' || status === 'Closing') return 'waiting';
  return 'idle';
}

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

export function VendorProjectClient({
  project, currentUserId, jsaSignatories, ptwSignatories, siteCheckins, toolboxMeetings, canManageAssignments, canEditSafetyChecklist, assignmentSlots, documentLogs, docChanges, ptwOvertimes, myReviews,
  ptwFieldAssignments, ptwDailyChecks, profileById, fieldCandidates, canAssignHolder, canFillFieldRole,
  canRequestClosure, canRequestCompletion, canRequestExtension,
}: {
  project: any; currentUserId: string; jsaSignatories?: any; ptwSignatories?: Record<string, any>;
  /** Riwayat check-in lapangan (site_checkins) lintas semua PTW proyek ini, terbaru dulu. */
  siteCheckins?: any[];
  /** Riwayat toolbox meeting (toolbox_meetings) lintas semua PTW proyek ini, terbaru dulu. */
  toolboxMeetings?: any[];
  /** true kalau caller punya masterData.manage_org_staff — menentukan apakah tab Assignment Reviewer ditampilkan. */
  canManageAssignments: boolean;
  /** true kalau caller punya ptw.edit_safety_checklist — mengontrol mode edit form Safety Checklist PTW. */
  canEditSafetyChecklist: boolean;
  assignmentSlots: any[];
  /** Jejak audit Prosedur/JSA/PTW proyek ini, terbaru dulu — sama persis yang dilihat PGN/PGSOL di tab Riwayat internal (lihat document_logs). */
  documentLogs?: any[];
  docChanges?: any[];
  /** Pengajuan lembur PTW (ptw_overtimes) untuk proyek ini. */
  ptwOvertimes?: any[];
  /** Dokumen yang sedang menunggu review user ini (HSE/PM Vendor) — tombol langsung ke halaman review. */
  myReviews?: { key: string; label: string; href: string }[];
  ptwFieldAssignments?: any[];
  ptwDailyChecks?: any[];
  profileById?: Record<string, { full_name: string | null; email: string | null }>;
  /** Kandidat yang boleh ditugaskan sebagai Pemegang (sesama staf vendor pemanggil). */
  fieldCandidates?: { id: string; name: string }[];
  /** true kalau caller punya ptw.assign_holder — menampilkan tombol Tugaskan/Ganti Pemegang. */
  canAssignHolder?: boolean;
  /** true kalau caller punya ptw.field_holder atau ptw.field_pengawas — boleh mengisi daily check bila sedang ditugaskan. */
  canFillFieldRole?: boolean;
  /** true kalau caller punya ptw.request_closure — menampilkan tombol Ajukan Penutupan PTW. */
  canRequestClosure?: boolean;
  /** true kalau caller punya ptw.request_project_completion — boleh mengajukan penyelesaian proyek. */
  canRequestCompletion?: boolean;
  /** true kalau caller punya ptw.request_extension — menampilkan tombol Ajukan Perpanjangan PTW. */
  canRequestExtension?: boolean;
}) {
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [qrModalToken, setQrModalToken] = useState<string | null>(null);
  const [closurePtwId, setClosurePtwId] = useState<string | null>(null);
  const [extensionPtwId, setExtensionPtwId] = useState<string | null>(null);
  const [overtimePtwId, setOvertimePtwId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionError, setCompletionError] = useState('');

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — lihat lib/project-stage.ts
  const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
  const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
  const vendorProfile = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;

  const prosedurRevisions = prosedur?.content?.revisions || [];
  const prosedurLastNote = prosedurRevisions.length > 0 ? prosedurRevisions[prosedurRevisions.length - 1].note : null;

  // Normalize statuses for UI logic. Sisi vendor: tahap "Review HSE/PM
  // Vendor" juga dihitung 'Pending' — isProcedurePending/isJsaPending
  // SENGAJA mengecualikannya (buat task list internal), tapi di layar vendor
  // ini dokumennya memang sedang direview, jadi jangan tampil sebagai Draft.
  const prosedurStatus = prosedur?.status === PROCEDURE_STATUS.approved ? 'Approved' : (isProcedurePending(prosedur?.status) || prosedur?.status === PROCEDURE_STATUS.reviewHseVendor || prosedur?.status === PROCEDURE_STATUS.reviewPmVendor) ? 'Pending' : (prosedur?.status === PROCEDURE_STATUS.draft && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
  const jsaStatus = jsa?.rejection_note ? 'Rejected'
    : jsa?.status === JSA_STATUS.approved ? 'Approved'
    : (isJsaPending(jsa?.status) || jsa?.status === JSA_STATUS.reviewHseVendor || jsa?.status === JSA_STATUS.reviewPmVendor) ? 'Pending'
    : jsa ? 'Draft' : 'Draft';

  // PTW tahap proyek: hijau hanya kalau SEMUA tipe PTW yang diajukan sudah Aktif.
  const ptwEffectiveStatuses = ptws.map(p => getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date));
  const ptwAnyExpired = ptwEffectiveStatuses.some(s => s === PTW_STATUS.expired);
  const ptwAnyStopped = ptwEffectiveStatuses.some(s => s === PTW_STATUS.stoppedSwa);
  const ptwAllClosed = ptws.length > 0 && ptwEffectiveStatuses.every(s => s === PTW_STATUS.selesai);
  const ptwAllAktif = ptws.length > 0 && ptwEffectiveStatuses.every(s => s === PTW_STATUS.aktif || s === PTW_STATUS.selesai || s === PTW_STATUS.penutupanDiajukan);
  const ptwAnyRejected = ptws.some(p => p.status === PTW_STATUS.draft && p.rejection_note);
  const projectCompleted = project.status === 'Selesai';
  const completionRequested = !!project.completion_requested_at && !projectCompleted;
  const ptwStatus = ptwAllClosed ? 'Closed'
    : ptwAnyStopped ? 'Stopped'
    : ptwAnyExpired ? 'Expired'
    : ptwAllAktif ? 'Approved'
    : ptwAnyRejected ? 'Rejected'
    : ptws.length > 0 ? 'Pending' : 'Draft';
  const ptwAktifCount = ptwEffectiveStatuses.filter(s => s === PTW_STATUS.aktif || s === PTW_STATUS.penutupanDiajukan).length;
  const ptwClosedCount = ptwEffectiveStatuses.filter(s => s === PTW_STATUS.selesai).length;

  const getStepStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Closed': return 'bg-emerald-600 text-white border-emerald-600';
      case 'Pending': return 'bg-amber-400 text-white border-amber-400';
      case 'Rejected': return 'bg-rose-500 text-white border-rose-500';
      case 'Expired': return 'bg-slate-400 text-white border-slate-400';
      case 'Stopped': return 'bg-red-600 text-white border-red-600';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const getStepLineStyle = (status: string) => (status === 'Approved' || status === 'Closed') ? 'bg-emerald-500' : 'bg-slate-200';

  const getStatusBadge = (status: string, detailedStatus?: string) => {
    if (status === 'Approved') return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Disetujui</span>;
    if (status === 'Closed') return <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Selesai</span>;
    if (status === 'Closing') return <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Verifikasi Penutupan</span>;
    if (status === 'Pending') return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">{detailedStatus || 'Dalam Review'}</span>;
    if (status === 'Rejected') return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Perlu Revisi</span>;
    if (status === 'Expired') return <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Kedaluwarsa</span>;
    if (status === 'Stopped') return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Stop Work</span>;
    return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
  };

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan Proyek', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'dokumen', label: 'Dokumen K3', icon: <FileText className="w-4 h-4" /> },
    { id: 'safety', label: 'Safety Check', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'penugasan', label: 'Penugasan', icon: <Users className="w-4 h-4" /> },
    { id: 'dailycheck', label: 'Daily Check', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'lapangan', label: 'Status Lapangan', icon: <Siren className="w-4 h-4" /> },
    { id: 'diskusi', label: 'Diskusi & Notes', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'riwayat', label: 'Riwayat', icon: <History className="w-4 h-4" /> },
    ...(canManageAssignments ? [{ id: 'assignment', label: 'Assignment Reviewer', icon: <Users className="w-4 h-4" /> }] : []),
  ];

  /**
   * Satu kalimat "apa yang harus saya lakukan sekarang" — pertanyaan utama
   * vendor saat membuka proyek. `href` hanya diisi kalau bolanya memang ada di
   * tangan vendor; kalau sedang direview PGSOL/PGN, vendor cuma menunggu.
   */
  const nextStep: { label: string; detail: string; href?: string; waiting: boolean } = (() => {
    if (prosedurStatus === 'Rejected') return { label: 'Revisi Prosedur Kerja', detail: 'Prosedur Kerja dikembalikan dengan catatan revisi. Perbaiki lalu ajukan ulang.', href: `/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`, waiting: false };
    if (prosedurStatus === 'Draft') return { label: prosedur ? 'Lanjutkan Prosedur Kerja' : 'Buat Prosedur Kerja', detail: 'Prosedur Kerja adalah dokumen pertama yang harus disetujui sebelum JSA bisa diajukan.', href: `/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`, waiting: false };
    if (prosedurStatus === 'Pending') return { label: 'Menunggu review Prosedur Kerja', detail: 'Dokumen sedang berjalan di rantai persetujuan. Lihat posisinya di tab Dokumen K3.', waiting: true };

    if (jsaStatus === 'Rejected') return { label: 'Revisi JSA', detail: 'JSA dikembalikan dengan catatan revisi. Perbaiki lalu ajukan ulang.', href: `/vendor/dashboard/jsa/create/${encodeURIComponent(project.id)}`, waiting: false };
    if (jsaStatus === 'Draft') return { label: jsa ? 'Lanjutkan JSA' : 'Buat JSA', detail: 'Prosedur Kerja sudah disetujui. Lanjut identifikasi bahaya dan mitigasi lewat JSA.', href: `/vendor/dashboard/jsa/create/${encodeURIComponent(project.id)}`, waiting: false };
    if (jsaStatus === 'Pending') return { label: 'Menunggu review JSA', detail: 'JSA sedang berjalan di rantai persetujuan. Lihat posisinya di tab Dokumen K3.', waiting: true };

    if (projectCompleted) return { label: 'Proyek selesai', detail: 'Proyek telah dinyatakan selesai dan masuk arsip.', waiting: true };
    if (ptws.length > 0 && ptwAllClosed) {
      if (completionRequested) return { label: 'Menunggu verifikasi penyelesaian proyek', detail: 'Pengajuan penyelesaian proyek sedang diverifikasi PM.', waiting: true };
      return { label: 'Ajukan Penyelesaian Proyek', detail: 'Semua PTW sudah ditutup. Ajukan penyelesaian proyek di tab Ringkasan Proyek.', waiting: false };
    }
    if (ptws.length === 0) return { label: 'Ajukan PTW', detail: 'JSA sudah disetujui. Ajukan izin kerja sesuai jenis pekerjaan di lapangan.', href: `/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`, waiting: false };
    if (ptwStatus === 'Rejected') return { label: 'Revisi PTW', detail: 'Ada PTW yang dikembalikan dengan catatan revisi. Cek tab Dokumen K3.', waiting: false };
    if (ptwStatus === 'Stopped') return { label: 'Pekerjaan dihentikan (Stop Work Authority)', detail: 'Hubungi PM/HSSE untuk mengaktifkan kembali izin kerja.', waiting: true };
    if (ptwStatus === 'Expired') return { label: 'PTW sudah kedaluwarsa', detail: 'Ajukan ulang izin kerja kalau pekerjaan masih berjalan.', waiting: false };
    if (ptwStatus === 'Pending') return { label: 'Menunggu penerbitan PTW', detail: 'PTW sedang berjalan di rantai persetujuan. Lihat posisinya di tab Dokumen K3.', waiting: true };
    return { label: 'Semua izin kerja aktif', detail: 'Dokumen K3 lengkap. Jangan lupa catat toolbox meeting sebelum pekerja check-in.', waiting: true };
  })();

  // Tab "Status Lapangan" — check-in/toolbox meeting lintas semua tipe PTW proyek ini.
  const ptwTitleById = Object.fromEntries(ptws.map((p: any) => [p.id, PTW_TYPES.find(t => t.id === p.ptw_type)?.title.split('(')[0].trim() || p.ptw_type]));
  const openSiteCheckins = (siteCheckins || []).filter((c: any) => !c.checked_out_at);
  const closedSiteCheckins = (siteCheckins || []).filter((c: any) => c.checked_out_at);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {extensionPtwId && (() => {
        const target = ptws.find((p: any) => p.id === extensionPtwId);
        if (!target || !target.valid_from || !target.valid_to) return null;
        return (
          <PtwExtensionModal
            ptwId={target.id}
            ptwTitle={`${ptwTitleById[target.id]}${target.ptw_number ? ` — ${target.ptw_number}` : ''}`}
            validFrom={target.valid_from}
            validTo={target.valid_to}
            onClose={() => setExtensionPtwId(null)}
          />
        );
      })()}

      {overtimePtwId && (() => {
        const target = ptws.find((p: any) => p.id === overtimePtwId);
        if (!target || !target.valid_from || !target.valid_to) return null;
        return (
          <PtwOvertimeModal
            ptwId={target.id}
            ptwTitle={`${ptwTitleById[target.id]}${target.ptw_number ? ` — ${target.ptw_number}` : ''}`}
            validFrom={target.valid_from}
            validTo={target.valid_to}
            workStart={target.work_start}
            workEnd={target.work_end}
            onClose={() => setOvertimePtwId(null)}
          />
        );
      })()}

      {closurePtwId && (() => {
        const target = ptws.find((p: any) => p.id === closurePtwId);
        if (!target) return null;
        return (
          <PtwClosureModal
            ptwId={target.id}
            ptwTitle={`${ptwTitleById[target.id]}${target.ptw_number ? ` — ${target.ptw_number}` : ''}`}
            openCheckinCount={openSiteCheckins.filter((c: any) => c.ptw_id === target.id).length}
            onClose={() => setClosurePtwId(null)}
          />
        );
      })()}

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

      {/* Tugas review saya — tampil di semua tab supaya reviewer tidak perlu lewat My Task */}
      {myReviews && myReviews.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 ring-4 ring-amber-50 p-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
            <CheckCircle2 className="w-4 h-4" /> Menunggu review Anda
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Anda ditugaskan mereview dokumen di bawah. Buka dokumennya, baca, lalu tekan <strong>Setujui</strong> atau <strong>Tolak</strong>.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {myReviews.map(r => (
              <Link key={r.key} href={r.href}
                className="inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-amber-200 hover:border-primary hover:bg-primary/5 text-sm font-bold text-slate-800 transition-colors">
                <span>{r.label}</span>
                <span className="inline-flex items-center gap-1 text-primary">Buka &amp; Review <ArrowRight className="w-4 h-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex gap-1 sm:gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --- TAB: RINGKASAN PROYEK --- */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Langkah berikutnya — pertanyaan pertama vendor tiap kali membuka proyek */}
          <div className={`relative overflow-hidden rounded-2xl border p-6 ${
            nextStep.waiting ? 'bg-sky-50/60 border-sky-200' : 'bg-amber-50/60 border-amber-300 ring-4 ring-amber-50'
          }`}>
            <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1.5 ${nextStep.waiting ? 'bg-sky-300' : 'bg-amber-400'}`} />
            <div className="pl-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${nextStep.waiting ? 'text-sky-700' : 'text-amber-800'}`}>
                  {nextStep.waiting ? 'Sedang menunggu pihak lain' : 'Langkah Anda berikutnya'}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{nextStep.label}</h2>
                <p className="text-sm text-slate-600 mt-1.5 max-w-prose">{nextStep.detail}</p>
              </div>
              {nextStep.href && (
                <Link
                  href={nextStep.href}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30"
                >
                  {nextStep.label} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
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

          {/* Penyelesaian proyek */}
          {(ptwAllClosed || projectCompleted) && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Penyelesaian Proyek</h2>
              {projectCompleted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 inline mr-2 -mt-0.5" />
                  Proyek telah dinyatakan selesai{project.completed_at ? ` pada ${new Date(project.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.
                </div>
              ) : completionRequested ? (
                <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl text-sm text-sky-800 font-medium space-y-1">
                  <p><CheckCircle2 className="w-4 h-4 inline mr-2 -mt-0.5" />Penyelesaian proyek sudah diajukan dan menunggu verifikasi PM.</p>
                  {project.completion_note && <p className="text-xs"><strong>Catatan Anda:</strong> {project.completion_note}</p>}
                </div>
              ) : (
                <>
                  {project.completion_rejection_note && (
                    <div className="p-4 bg-rose-50 rounded-xl text-sm text-rose-700 font-medium border border-rose-100">
                      <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                      <span className="font-bold">Penyelesaian ditolak:</span> {project.completion_rejection_note}
                    </div>
                  )}
                  <p className="text-sm text-slate-600">Semua PTW sudah ditutup. Ajukan penyelesaian proyek untuk diverifikasi PM. Proyek tidak bisa diselesaikan selama masih ada Inspeksi Temuan yang belum ditutup.</p>
                  {canRequestCompletion ? (
                    <>
                      <textarea
                        rows={3}
                        value={completionNote}
                        onChange={e => setCompletionNote(e.target.value)}
                        placeholder="Catatan penyelesaian proyek (wajib)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      {completionError && <p className="text-sm text-rose-600 font-medium">{completionError}</p>}
                      <button
                        disabled={completionLoading || completionNote.trim().length === 0}
                        onClick={async () => {
                          setCompletionLoading(true);
                          setCompletionError('');
                          const res = await requestProjectCompletion(project.id, completionNote);
                          if (res.success) window.location.reload();
                          else { setCompletionError(res.error); setCompletionLoading(false); }
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
                      >
                        {completionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Ajukan Penyelesaian Proyek
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Anda tidak memiliki izin mengajukan penyelesaian proyek. Hubungi admin perusahaan Anda.</p>
                  )}
                </>
              )}
            </div>
          )}
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <StageRail
                    steps={PROCEDURE_STAGE_SEQUENCE}
                    currentIndex={procedureStageIndex(prosedur?.status)}
                    tone={vendorRailTone(prosedurStatus)}
                  />
                </div>

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
                        <BlobProvider document={<ProsedurPDF data={buildProsedurPdfData({ content: prosedur.content, status: prosedur.status, projectName: project.name, contractNumber: project.contract_number, vendorName: vendorProfile?.company_name, docId: prosedur.id, logs: documentLogs })} />}>
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <StageRail
                    steps={JSA_STAGE_SEQUENCE}
                    currentIndex={jsaStageIndex(jsa?.status)}
                    tone={vendorRailTone(jsaStatus)}
                  />
                </div>

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
                        <JsaPDF projectId={project.id} projectInfo={{ name: project.name, contract_number: project.contract_number, location: project.location, companyName: vendorProfile?.company_name }} signatories={jsaSignatories} preparerSigned={!!jsa && jsa.status !== 'Draft'} preparer={{ satker: vendorProfile?.company_name }} steps={jsa?.jsa_steps?.map((step: any) => {
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
                      const rowStatus = rowEffective === PTW_STATUS.selesai ? 'Closed'
                        : rowEffective === PTW_STATUS.penutupanDiajukan ? 'Closing'
                        : rowEffective === PTW_STATUS.stoppedSwa ? 'Stopped'
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

                          <div className="bg-white border border-slate-200 rounded-xl p-4">
                            <StageRail
                              steps={PTW_STAGE_SEQUENCE}
                              currentIndex={ptwStageIndex(row.status)}
                              tone={vendorRailTone(rowStatus)}
                            />
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

                          {row.closure_rejection_note && (rowStatus === 'Approved' || rowStatus === 'Expired') && (
                            <div className="p-3 bg-rose-50 rounded-lg text-sm text-rose-700 font-medium border border-rose-100">
                              <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                              <span className="font-bold">Penutupan ditolak:</span> {row.closure_rejection_note}
                            </div>
                          )}

                          {(rowStatus === 'Closing' || rowStatus === 'Closed') && (
                            <div className={`p-3 rounded-lg text-sm border space-y-1 ${rowStatus === 'Closed' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-sky-50 border-sky-100 text-sky-800'}`}>
                              <div className="flex items-center gap-2 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                {rowStatus === 'Closed' ? 'PTW telah ditutup' : 'Penutupan diajukan — menunggu verifikasi HSSE'}
                              </div>
                              {row.closure_finished_at && <p><strong>Pekerjaan selesai:</strong> {new Date(row.closure_finished_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                              {row.closure_note && <p><strong>Catatan:</strong> {row.closure_note}</p>}
                              {row.closed_at && <p className="text-xs">Diverifikasi {new Date(row.closed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                            </div>
                          )}

                          {rowStatus === 'Approved' && row.extension_requested_to && (
                            <div className="p-3 bg-sky-50 rounded-lg text-sm text-sky-800 border border-sky-100 space-y-1">
                              <div className="flex items-center gap-2 font-bold"><Clock className="w-4 h-4" /> Perpanjangan diajukan — menunggu verifikasi HSSE</div>
                              <p><strong>Sampai:</strong> {new Date(`${row.extension_requested_to}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                              {row.extension_reason && <p><strong>Alasan:</strong> {row.extension_reason}</p>}
                            </div>
                          )}

                          {rowStatus === 'Approved' && !row.extension_requested_to && row.extension_rejection_note && (
                            <div className="p-3 bg-rose-50 rounded-lg text-sm text-rose-700 font-medium border border-rose-100">
                              <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
                              <span className="font-bold">Perpanjangan ditolak:</span> {row.extension_rejection_note}
                            </div>
                          )}

                          {canRequestExtension && rowStatus === 'Approved' && !row.extension_requested_to && row.valid_from && row.valid_to && (
                            <button
                              onClick={() => setExtensionPtwId(row.id)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                            >
                              <Calendar className="w-4 h-4" /> Ajukan Perpanjangan PTW
                            </button>
                          )}

                          {(ptwOvertimes ?? []).some((o: any) => o.ptw_id === row.id) && (
                            <div className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-200 space-y-2">
                              <p className="font-bold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Lembur</p>
                              {(ptwOvertimes ?? []).filter((o: any) => o.ptw_id === row.id).map((o: any) => (
                                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span>
                                    <strong>{new Date(`${o.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                                    {' '}· {o.jam_mulai}–{o.jam_selesai} ({formatDuration(overtimeMinutes(o.jam_mulai, o.jam_selesai))})
                                    {o.status === 'Ditolak' && o.decision_note ? <span className="text-rose-600"> — {o.decision_note}</span> : null}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${OVERTIME_TONE[o.status as keyof typeof OVERTIME_TONE]}`}>{o.status}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {canRequestExtension && rowStatus === 'Approved' && row.valid_from && row.valid_to && (
                            <button
                              onClick={() => setOvertimePtwId(row.id)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-colors"
                            >
                              <Clock className="w-4 h-4" /> Ajukan Lembur
                            </button>
                          )}

                          {canRequestClosure && (rowStatus === 'Approved' || rowStatus === 'Expired') && (
                            <button
                              onClick={() => setClosurePtwId(row.id)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Pekerjaan Selesai — Ajukan Penutupan PTW
                            </button>
                          )}

                          {row.field_token && rowStatus === 'Approved' && (
                            <button
                              onClick={() => setQrModalToken(row.field_token)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                            >
                              <QrCode className="w-4 h-4" /> QR Check-in Lapangan
                            </button>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3">
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
                                  checklistData={row.safety_checklist || {}}
                                  dailyChecks={(ptwDailyChecks ?? []).filter((c: any) => c.ptw_id === row.id)}
                            extensions={row.extensions || []}
                            extensionCount={row.extension_count}
                            overtimes={(ptwOvertimes ?? []).filter((o: any) => o.ptw_id === row.id)}
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
                            {rowStatus === 'Rejected' && (
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
      {/* --- TAB: SAFETY CHECK --- */}
      {activeTab === 'safety' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PtwSafetyCheckTab
            canEdit={canEditSafetyChecklist}
            ptws={ptws.map((p, i) => ({
              id: p.id,
              ptw_type: p.ptw_type,
              ptw_number: p.ptw_number,
              status: ptwEffectiveStatuses[i],
              valid_from: p.valid_from,
              valid_to: p.valid_to,
              safety_checklist: p.safety_checklist,
            }))}
          />
        </div>
      )}

      {/* --- TAB CONTENT: PENUGASAN LAPANGAN --- */}
      {activeTab === 'penugasan' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PtwFieldAssignmentsPanel
            ptws={ptws.map((p, i) => ({
              id: p.id,
              ptw_type: p.ptw_type,
              ptw_number: p.ptw_number,
              status: ptwEffectiveStatuses[i],
            }))}
            assignments={ptwFieldAssignments ?? []}
            profileById={profileById ?? {}}
            candidates={(fieldCandidates ?? []).map((c) => ({ id: c.id, full_name: c.name }))}
            canAssign={{ pemegang: !!canAssignHolder }}
            onAssign={async ({ ptwId, peran, userId, alasan }) => {
              const res = await assignFieldRole(ptwId, peran, userId, alasan);
              if (!res.success) {
                alert(res.error || 'Gagal menugaskan peran lapangan.');
                return false;
              }
              window.location.reload();
              return true;
            }}
          />
        </div>
      )}

      {/* --- TAB CONTENT: ISIAN RIKSA HARIAN --- */}
      {activeTab === 'dailycheck' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PtwDailyCheckTab
            ptws={ptws.map((p, i) => ({
              id: p.id,
              ptw_type: p.ptw_type,
              ptw_number: p.ptw_number,
              status: ptwEffectiveStatuses[i],
              valid_from: p.valid_from,
              valid_to: p.valid_to,
              safety_checklist: p.safety_checklist,
            }))}
            dailyChecks={ptwDailyChecks ?? []}
            assignments={ptwFieldAssignments ?? []}
            profileById={profileById ?? {}}
            currentUserId={currentUserId}
            today={todayDateString()}
            canFill={!!canFillFieldRole}
            onSubmit={async ({ ptwId, uraian, requiredKeys }) => {
              const res = await submitDailyCheck(ptwId, uraian, requiredKeys);
              if (!res.success) {
                alert(res.error || 'Gagal mengirim daily check.');
                return false;
              }
              window.location.reload();
              return true;
            }}
          />
        </div>
      )}

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

      {/* --- TAB CONTENT: RIWAYAT --- */}
      {activeTab === 'riwayat' && (
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Riwayat Dokumen</h3>
                <p className="text-xs text-slate-500">Jejak audit pengajuan, review, dan persetujuan Prosedur, JSA, dan PTW</p>
              </div>
            </div>

            <div className="mb-5"><ChangeLogPanel entries={docChanges || []} /></div>

            {!documentLogs || documentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 gap-2 text-slate-400">
                <History className="w-10 h-10 opacity-20" />
                <p className="text-sm">Belum ada riwayat tercatat untuk proyek ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documentLogs.map((log: any) => {
                  const docType = log.doc_type as DocLogType;
                  const DocIcon = docLogIcon(docType);
                  const tone = docLogTone(log.action || '');
                  const ToneIcon = tone.icon;
                  const actor = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                  return (
                    <div key={log.id} className={`flex gap-3 p-4 rounded-xl border ${tone.bg}`}>
                      <div className={`shrink-0 w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center ${tone.text}`}>
                        <DocIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{DOC_TYPE_LABEL[docType] ?? docType}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${tone.text}`}>
                            <ToneIcon className="w-3.5 h-3.5" /> {log.action}
                          </span>
                        </div>
                        {log.notes && <p className="text-sm text-slate-600 mt-1">{log.notes}</p>}
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {actor?.full_name || 'Sistem'}{actor?.jabatan ? ` · ${actor.jabatan}` : actor?.role ? ` · ${actor.role}` : ''} · {new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
         </div>
      )}

      {/* --- TAB: ASSIGNMENT REVIEWER --- */}
      {activeTab === 'assignment' && canManageAssignments && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
            <h3 className="text-blue-800 font-bold mb-1 flex items-center gap-2">
              <Users className="w-4 h-4" /> Assignment HSE & PM Vendor
            </h3>
            <p className="text-sm text-blue-600/80">
              Tunjuk staff perusahaan Anda untuk mereview setiap dokumen K3 sebelum diajukan ke PGSOL/PGN.
              Kalau lebih dari satu orang ditugaskan pada satu tahap, semuanya harus menyetujui sebelum dokumen lanjut.
            </p>
          </div>
          <VendorAssignmentPanel projectId={project.id} slots={assignmentSlots} />
        </div>
      )}

    </div>
  );
}

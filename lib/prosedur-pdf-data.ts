/**
 * Satu-satunya perakit data untuk ProsedurPDF — dipakai semua tempat yang
 * merender PDF Prosedur (form vendor, detail approval, halaman proyek vendor &
 * internal) supaya Contract No, cap approval, dan riwayat selalu konsisten.
 */
import { procedureStageIndex } from '@/lib/procedure-status';

export interface ProsedurApprovalState {
  vendor: boolean;
  pgsol: boolean;
  pgn: boolean;
}

/**
 * Cap APPROVED muncul di kotak sebuah perusahaan HANYA setelah tahap terakhir
 * perusahaan itu lolos: Vendor = PM Vendor (tahap 2 selesai), PGSOL = PM PGSOL
 * (tahap 4 selesai), PGN = PM Zona (dokumen disetujui). Urutan tahap ada di
 * PROCEDURE_STAGE_SEQUENCE; Draft (-1) berarti belum ada yang lolos.
 */
export function prosedurApprovalState(status: string | null | undefined): ProsedurApprovalState {
  const idx = procedureStageIndex(status);
  return { vendor: idx >= 2, pgsol: idx >= 4, pgn: idx >= 6 };
}

export interface ProsedurHistoryEntry {
  at: string;
  action: string;
  actor: string;
  jabatan?: string | null;
  notes?: string | null;
}

/** Riwayat review/persetujuan satu prosedur dari document_logs, urut lama → baru. */
export function prosedurHistoryFromLogs(logs: any[] | null | undefined, docId?: string | null): ProsedurHistoryEntry[] {
  return (logs || [])
    .filter((l) => l.doc_type === 'procedure' && (!docId || l.doc_id === docId))
    .map((l) => {
      const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      return {
        at: l.created_at as string,
        action: l.action as string,
        actor: p?.full_name || 'Sistem',
        jabatan: p?.jabatan || null,
        notes: l.notes ?? null,
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

export interface ProsedurPdfData {
  projectName: string;
  docNo: string;
  contractNo: string;
  submissionDate: string;
  umum: string;
  scopeOfWork: string;
  tools: string[];
  apd: string[];
  perlengkapanLainnya: string[];
  tahapanPekerjaan: any[];
  penyelesaianAkhir: string[];
  revisions: { revNo: number; date: string; note: string }[];
  vendorName: string;
  approvals: ProsedurApprovalState;
  /** Status dokumen saat ini, ditampilkan di halaman riwayat. */
  status: string;
  history: ProsedurHistoryEntry[];
}

export function buildProsedurPdfData(args: {
  content: any;
  status?: string | null;
  projectName?: string | null;
  /** Nomor kontrak dari proyek (master) — menang atas nilai lama di content. */
  contractNumber?: string | null;
  vendorName?: string | null;
  docId?: string | null;
  logs?: any[] | null;
}): ProsedurPdfData {
  const c = args.content || {};
  return {
    projectName: c.projectName || args.projectName || 'Proyek',
    docNo: c.docNo || '-',
    contractNo: args.contractNumber || c.contractNo || '-',
    submissionDate: c.submissionDate || '-',
    umum: c.umum || '',
    scopeOfWork: c.scopeOfWork || '',
    tools: c.tools || [],
    apd: c.apd || c.selectedApd || [],
    perlengkapanLainnya: c.perlengkapanLainnya || [],
    tahapanPekerjaan: c.tahapanPekerjaan || [],
    penyelesaianAkhir: c.penyelesaianAkhir || [],
    revisions: c.revisions || [],
    vendorName: args.vendorName || 'Vendor',
    approvals: prosedurApprovalState(args.status),
    status: args.status || 'Draft',
    history: prosedurHistoryFromLogs(args.logs, args.docId),
  };
}

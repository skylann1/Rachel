export type StuckSeverity = 'high' | 'medium' | 'info';

export type StuckIssueCode =
  | 'no_assignee'        // tahap tanpa satu pun penugas
  | 'all_decided'        // semua penugas sudah memutuskan, tapi dokumen belum bergerak
  | 'no_authorized'      // penugas pending ada, tapi tak satu pun berwenang (role berubah)
  | 'some_unauthorized'  // sebagian penugas pending tidak lagi berwenang
  | 'aging';             // terlalu lama menunggu di tahap ini

export interface StuckIssue {
  code: StuckIssueCode;
  severity: StuckSeverity;
  title: string;
  detail: string;
}

export interface StuckAssignee {
  id: string;
  name: string;
  status: string;
  /** Role-nya tidak lagi memegang izin tahap ini, jadi tidak bisa menindaklanjuti. */
  unauthorized: boolean;
}

export interface StuckDocument {
  key: string;
  projectId: string;
  projectName: string;
  vendorName: string | null;
  docType: 'procedure' | 'jsa' | 'ptw';
  docLabel: string;
  status: string;
  stageKey: string;
  stageLabel: string;
  /** Pihak pemilik tahap (siapa yang berwenang menugaskan). */
  ownerParty: 'pgn' | 'pgsol' | 'vendor' | null;
  ownerLabel: string;
  /** Halaman perbaikan untuk admin PGN; null kalau penugasan hanya bisa dilakukan pihak lain. */
  fixHref: string | null;
  waitingDays: number | null;
  severity: StuckSeverity;
  issues: StuckIssue[];
  assignees: StuckAssignee[];
}

export interface StuckReport {
  generatedAt: string;
  /** Dokumen yang sedang berada di tahap review (sehat maupun bermasalah). */
  inReview: number;
  documents: StuckDocument[];
}

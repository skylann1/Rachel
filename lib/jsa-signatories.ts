import { getRoleLabel } from './roles';

/**
 * Data tanda tangan pada formulir JSA.
 *
 * Tiga blok pada form:
 *   Disiapkan Oleh  -> vendor yang menyusun JSA
 *   Direview Oleh   -> Reviewer PGSOL  (Satker Pemberi Kerja)
 *   Disetujui Oleh  -> Approver PGN    (Satker Penanggung Jawab)
 */
export interface JsaSignatory {
  nama: string;
  jabatan: string;
  satker: string;
  tanggal: string;
}

export interface JsaSignatories {
  reviewer: JsaSignatory | null;
  approver: JsaSignatory | null;
}

export const JSA_SIGNATORIES_KOSONG: JsaSignatories = { reviewer: null, approver: null };

function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Mengambil nama & jabatan penandatangan JSA dari tabel profiles.
 *
 * jsa.reviewer_id / approver_id menunjuk ke internal_profiles, yang id-nya
 * sama dengan profiles.id — jadi nama diambil langsung dari profiles.
 * Mengembalikan null untuk tahap yang belum ditandatangani.
 */
export async function getJsaSignatories(
  supabase: any,
  jsa: { reviewer_id?: string | null; reviewed_at?: string | null; approver_id?: string | null; approved_at?: string | null } | null | undefined,
): Promise<JsaSignatories> {
  if (!jsa) return JSA_SIGNATORIES_KOSONG;

  const ids = [jsa.reviewer_id, jsa.approver_id].filter(Boolean) as string[];
  if (ids.length === 0) return JSA_SIGNATORIES_KOSONG;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('id', ids);

  const cari = (id: string | null | undefined) =>
    id ? (profiles || []).find((p: any) => p.id === id) : undefined;

  const reviewerProfile = cari(jsa.reviewer_id);
  const approverProfile = cari(jsa.approver_id);

  return {
    reviewer: reviewerProfile
      ? {
          nama: reviewerProfile.full_name || '',
          jabatan: getRoleLabel(reviewerProfile.role),
          satker: 'PGSOL',
          tanggal: formatTanggal(jsa.reviewed_at),
        }
      : null,
    approver: approverProfile
      ? {
          nama: approverProfile.full_name || '',
          jabatan: getRoleLabel(approverProfile.role),
          satker: 'PGN',
          tanggal: formatTanggal(jsa.approved_at),
        }
      : null,
  };
}

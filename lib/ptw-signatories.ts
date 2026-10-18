import { getRoleLabel } from './roles';
import { getStageAssignmentsWithNames, type StageAssignmentRowWithName } from './stage-assignments';

/**
 * Data tanda tangan pada formulir PTW.
 *
 * Empat blok pada form (lihat contoh terisi pada dokumen referensi PGN):
 *   Pemohon Permit To Work   -> vendor yang mengajukan izin
 *   Pemegang Permit To Work  -> Pemegang PTW yang DITUGASKAN (ptw_field_assignments),
 *                               bukan lagi PIC vendor; kosong kalau belum ada
 *   Pemberi Permit To Work   -> PTW Authority (tahap approval pertama)
 *   Penerbit Permit To Work  -> PTW Issuer (tahap approval kedua)
 *
 * Tahap ketiga (HSE) tidak punya blok tanda tangan: keluarannya adalah
 * NOMOR PTW pada bagian A, bukan tanda tangan — sesuai form aslinya.
 *
 * `nama`/`jabatan` bisa berisi lebih dari satu orang (dipisah ", ") kalau
 * tahap itu ditugaskan ke beberapa assignee sekaligus — diambil dari
 * stage_assignments (semua baris 'approved'), bukan lagi dari kolom
 * single-ID lama (ptw.authority_id/issuer_id) yang cuma mencatat satu
 * orang (siapa yang menutup tahap itu).
 */
export interface PtwSignatory {
  nama: string;
  jabatan: string;
  satker: string;
  tanggal: string;
}

export interface PtwSignatories {
  pemohon: PtwSignatory | null;
  pemegang: PtwSignatory | null;
  pemberi: PtwSignatory | null;
  penerbit: PtwSignatory | null;
  /** Pengawas PTW yang ditugaskan — tidak punya blok tanda tangan, dipakai untuk keterangan pada kotak Verifikasi. */
  pengawas?: PtwSignatory | null;
}

export const PTW_SIGNATORIES_KOSONG: PtwSignatories = {
  pemohon: null,
  pemegang: null,
  pemberi: null,
  penerbit: null,
  pengawas: null,
};

function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface PtwApprovalFields {
  id?: string;
  created_at?: string | null;
}

interface VendorPic {
  /** Nama PIC vendor, dari projects.vendor_id -> profiles.full_name */
  nama?: string | null;
  /** Nama perusahaan, dari vendor_profiles.company_name */
  perusahaan?: string | null;
}

/** Gabungkan nama/jabatan SEMUA assignee yang approved di satu tahap, urut berdasarkan waktu approve. */
function gabunganSignatory(rows: StageAssignmentRowWithName[], satker: string): PtwSignatory | null {
  const approved = rows.filter(r => r.status === 'approved').sort((a, b) => (a.decided_at ?? '').localeCompare(b.decided_at ?? ''));
  if (approved.length === 0) return null;
  return {
    nama: approved.map(r => r.assignee_name || 'Tidak diketahui').join(', '),
    jabatan: approved.map(r => r.assignee_jabatan || getRoleLabel(r.assignee_role)).join(', '),
    satker,
    tanggal: formatTanggal(approved[approved.length - 1].decided_at),
  };
}

/**
 * Mengambil nama & jabatan SEMUA penandatangan PTW per tahap, dari
 * stage_assignments — bukan lagi dari kolom single-ID lama
 * (ptw.authority_id/issuer_id), yang cuma mencatat satu orang (yang
 * menutup tahap) walau tahap itu bisa ditugaskan ke beberapa assignee
 * sekaligus (semua harus approve).
 *
 * Blok Pemohon diisi PIC vendor (yang mengajukan izin); blok Pemegang diisi
 * Pemegang PTW yang ditugaskan di ptw_field_assignments. Mengembalikan null
 * untuk blok yang datanya belum ada.
 */
export async function getPtwSignatories(
  supabase: any,
  projectId: string,
  ptw: PtwApprovalFields | null | undefined,
  vendorPic?: VendorPic | null,
): Promise<PtwSignatories> {
  if (!ptw?.id) return PTW_SIGNATORIES_KOSONG;

  const vendor: PtwSignatory | null = vendorPic?.nama
    ? {
        nama: vendorPic.nama,
        jabatan: getRoleLabel('vendor'),
        satker: vendorPic.perusahaan || '',
        tanggal: formatTanggal(ptw.created_at),
      }
    : null;

  const [authorityRows, issuerRows, { data: fieldRows }] = await Promise.all([
    getStageAssignmentsWithNames(supabase, projectId, 'ptw', 'ptw.approve_pm'),
    getStageAssignmentsWithNames(supabase, projectId, 'ptw', 'ptw.review_issuer'),
    supabase
      .from('ptw_field_assignments')
      .select('peran, user_id, aktif_dari, aktif_sampai')
      .eq('ptw_id', ptw.id)
      .order('aktif_dari', { ascending: false }),
  ]);

  // Penjabat lapangan: yang sedang aktif; kalau sudah diganti/dicabut, yang terakhir menjabat.
  const pick = (peran: 'pemegang' | 'pengawas') => {
    const rows = ((fieldRows || []) as { peran: string; user_id: string; aktif_dari: string; aktif_sampai: string | null }[])
      .filter(r => r.peran === peran);
    return rows.find(r => r.aktif_sampai === null) ?? rows[0] ?? null;
  };
  const holderRow = pick('pemegang');
  const supervisorRow = pick('pengawas');
  const ids = [holderRow?.user_id, supervisorRow?.user_id].filter(Boolean) as string[];
  const { data: people } = ids.length > 0
    ? await supabase.from('profiles').select('id, full_name, jabatan, role').in('id', ids)
    : { data: [] as any[] };
  const personById = new Map<string, any>((people || []).map((p: any) => [p.id as string, p]));
  const toSignatory = (row: typeof holderRow, satker: string): PtwSignatory | null => {
    if (!row) return null;
    const p = personById.get(row.user_id);
    return {
      nama: p?.full_name || 'Tidak diketahui',
      jabatan: p?.jabatan || getRoleLabel(p?.role),
      satker,
      tanggal: formatTanggal(row.aktif_dari),
    };
  };

  return {
    pemohon: vendor,
    pemegang: toSignatory(holderRow, vendorPic?.perusahaan || ''),
    pemberi: gabunganSignatory(authorityRows, 'PGN'),
    penerbit: gabunganSignatory(issuerRows, 'PGN'),
    pengawas: toSignatory(supervisorRow, 'PGN'),
  };
}

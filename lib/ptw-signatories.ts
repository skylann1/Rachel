import { getRoleLabel } from './roles';

/**
 * Data tanda tangan pada formulir PTW.
 *
 * Empat blok pada form (lihat contoh terisi pada dokumen referensi PGN):
 *   Pemohon Permit To Work   -> vendor yang mengajukan izin
 *   Pemegang Permit To Work  -> yang memegang izin fisik di lokasi kerja
 *   Pemberi Permit To Work   -> PTW Authority (tahap approval pertama)
 *   Penerbit Permit To Work  -> PTW Issuer (tahap approval kedua)
 *
 * Tahap ketiga (HSE) tidak punya blok tanda tangan: keluarannya adalah
 * NOMOR PTW pada bagian A, bukan tanda tangan — sesuai form aslinya.
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
}

export const PTW_SIGNATORIES_KOSONG: PtwSignatories = {
  pemohon: null,
  pemegang: null,
  pemberi: null,
  penerbit: null,
};

function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface PtwApprovalFields {
  created_at?: string | null;
  authority_id?: string | null;
  authority_approved_at?: string | null;
  issuer_id?: string | null;
  issuer_approved_at?: string | null;
}

interface VendorPic {
  /** Nama PIC vendor, dari projects.vendor_id -> profiles.full_name */
  nama?: string | null;
  /** Nama perusahaan, dari vendor_profiles.company_name */
  perusahaan?: string | null;
}

/**
 * Mengambil nama & jabatan penandatangan PTW.
 *
 * authority_id / issuer_id menunjuk ke internal_profiles, yang id-nya sama
 * dengan profiles.id — jadi nama diambil langsung dari profiles (pola sama
 * seperti getJsaSignatories).
 *
 * Blok Pemohon dan Pemegang keduanya diisi PIC vendor: yang mengajukan izin
 * dan yang memegangnya di lapangan pada praktiknya orang yang sama.
 * Mengembalikan null untuk blok yang datanya belum ada.
 */
export async function getPtwSignatories(
  supabase: any,
  ptw: PtwApprovalFields | null | undefined,
  vendorPic?: VendorPic | null,
): Promise<PtwSignatories> {
  if (!ptw) return PTW_SIGNATORIES_KOSONG;

  const vendor: PtwSignatory | null = vendorPic?.nama
    ? {
        nama: vendorPic.nama,
        jabatan: getRoleLabel('vendor'),
        satker: vendorPic.perusahaan || '',
        tanggal: formatTanggal(ptw.created_at),
      }
    : null;

  const ids = [ptw.authority_id, ptw.issuer_id].filter(Boolean) as string[];

  let profiles: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', ids);
    profiles = data || [];
  }

  const cari = (id: string | null | undefined) =>
    id ? profiles.find((p: any) => p.id === id) : undefined;

  const authorityProfile = cari(ptw.authority_id);
  const issuerProfile = cari(ptw.issuer_id);

  return {
    pemohon: vendor,
    pemegang: vendor,
    pemberi: authorityProfile
      ? {
          nama: authorityProfile.full_name || '',
          jabatan: getRoleLabel(authorityProfile.role),
          satker: 'PGN',
          tanggal: formatTanggal(ptw.authority_approved_at),
        }
      : null,
    penerbit: issuerProfile
      ? {
          nama: issuerProfile.full_name || '',
          jabatan: getRoleLabel(issuerProfile.role),
          satker: 'PGN',
          tanggal: formatTanggal(ptw.issuer_approved_at),
        }
      : null,
  };
}

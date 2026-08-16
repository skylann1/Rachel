/**
 * Dokumen pendukung pada master data aset (Peralatan dan Material).
 *
 * Tipe ini sengaja tinggal di module biasa, bukan di dalam berkas `"use server"`.
 * Berkas server action hanya boleh mengekspor fungsi async; me-re-export tipe
 * dari sana (`export type { ... }`) ikut ter-emit sebagai ekspor runtime dan
 * membuat halaman gagal dimuat dengan "AssetDocumentItem is not defined".
 */
export interface AssetDocumentItem {
  id?: string;
  /** Nama dokumen, mis. "Sertifikasi Kelayakan" atau "MSDS". */
  doc_name: string;
  /** Lembaga penerbit, mis. "Sucofindo" atau "Manufacturer". */
  issuer: string | null;
  valid_to: string | null;
  document_url: string | null;
}

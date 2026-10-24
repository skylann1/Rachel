import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import {
  PTW_TYPES, APD_ITEMS, PtwType, PTW_GAS_TEST_TYPES, PTW_GAS_FORM_TYPES, GAS_TEST_STANDARDS,
  PtwGasTestEntry, PtwGasTestFrequency, HOT_WORK_JOB_TYPES,
  hazardColumnsFor, APD_CATEGORY_LABELS, APD_OTHERS_LABEL,
  flattenSafetyChecklist, PtwSafetyChecklistData, ptwValidDayDates, type PtwExtensionRecord } from '@/lib/ptw-types';
import type { PtwSignatories, PtwSignatory } from '@/lib/ptw-signatories';
import { formatCheckDate, formatCheckTime, type PtwDailyCheck } from '@/lib/ptw-field';

const B = '#000';
// Form asli hanya mengarsir blok Verifikasi dan tiga kotak di bagian bawah;
// judul bagian A–E dibiarkan putih. Warna diambil dari template (theme2).
const SECTION_BG = '#EEECE1';
const fs = 5; // Base font size optimized for dense Excel look
const fs_title = 10;
const fs_subtitle = 8;
const fs_header = 6;

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: fs,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },

  // Top Header (Dynamic color)
  topHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: B,
    marginBottom: 6,
    height: 40,
    alignItems: 'stretch',
  },
  topHeaderLogo: {
    width: '18%',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderColor: B,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderCenter: {
    width: '82%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fs_title, fontWeight: 'bold' },
  headerSubtitle: { fontSize: fs_subtitle, fontWeight: 'bold' },
  headerRegion: { fontSize: fs },

  // Main 2-column layout
  mainColumns: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  leftColumn: { width: '42%', flexDirection: 'column', gap: 4 },
  rightColumn: { width: '58%', flexDirection: 'column' },

  // Section styling
  sectionBox: { borderWidth: 1, borderColor: B },
  // Judul bagian A–E: teks tebal tanpa arsiran, sesuai form.
  sectionHeader: {
    paddingVertical: 0.5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: B,
    fontWeight: 'bold',
    fontSize: fs_header,
  },
  // Judul kotak berarsir (Verifikasi, Pengesahan, Dihentikan, Penyelesaiaan).
  shadedHeader: {
    backgroundColor: SECTION_BG,
    paddingVertical: 0.5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: B,
    fontWeight: 'bold',
    fontSize: fs_header,
  },

  // A. UMUM
  umumRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, minHeight: 9, alignItems: 'center' },
  umumLabel: { width: '32%', paddingLeft: 4, fontWeight: 'bold' },
  umumVal: { width: '68%', borderLeftWidth: 1, borderColor: B, paddingLeft: 4, height: '100%', justifyContent: 'center' },

  // Checkbox items
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  // Bagian B memakai 4 kolom: 41 sumber bahaya kalau 3 kolom jadi 14 baris dan
  // mendorong sisa halaman terpotong.
  checkItem: { width: '25%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 0.5, paddingHorizontal: 2 },
  checkItemD: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 1, paddingHorizontal: 2 },
  checkBoxEmpty: { width: 4, height: 4, borderWidth: 1, borderColor: B, marginRight: 3, marginTop: 0.5 },
  checkBoxFilled: { width: 4, height: 4, borderWidth: 1, borderColor: B, backgroundColor: B, marginRight: 3, marginTop: 0.5 },

  // C. APD Category Group — 4 kolom, mengikuti tata letak form asli
  apdCatCol: { width: '25%', padding: 2 },
  apdCatTitle: { fontWeight: 'bold', marginBottom: 1, fontSize: fs },

  // D. Dokumen Pendukung
  docContainer: { flexDirection: 'row', padding: 2 },
  docCol: { flex: 1 },
  docColTitle: { fontWeight: 'bold', marginBottom: 2 },

  // E. SAFETY CHECKLIST
  tHeaderRow: { flexDirection: 'row', backgroundColor: SECTION_BG, borderBottomWidth: 1, borderColor: B, alignItems: 'stretch' },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  tCell: { paddingVertical: 0.1, paddingHorizontal: 2, borderRightWidth: 1, borderColor: B, justifyContent: 'center' },

  // Verifikasi (End of checklist)
  verifRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B },
  verifLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 2, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  verifContent: { width: '70%', flexDirection: 'column' },
  verifSubRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, minHeight: 8 },
  verifSubLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 2 },
  verifSubVal: { width: '70%', padding: 2 },

  // Footer 2-column layout
  footerColumns: { flexDirection: 'row', gap: 4 },
  footerLeft: { width: '42%', borderWidth: 1, borderColor: B },
  footerRight: { width: '58%', flexDirection: 'column', gap: 4 },
  footerBox: { borderWidth: 1, borderColor: B },

  // Signatures
  disclaimer: { fontSize: 4, padding: 1, borderBottomWidth: 1, borderColor: B },
  signRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  signCell: { flex: 1, borderRightWidth: 1, borderColor: B },
  signLabel: { textAlign: 'center', fontWeight: 'bold', borderBottomWidth: 1, borderColor: B, paddingBottom: 2, paddingTop: 2 },
  signNameRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B, minHeight: 6, alignItems: 'center' },
  signNameLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 },
  signNameVal: { width: '70%', padding: 1 },

  // Dihentikan / Penyelesaian Tables
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B, minHeight: 7, alignItems: 'center' },
  tableCell: { flex: 1, borderRightWidth: 1, borderColor: B, padding: 1, alignItems: 'center', justifyContent: 'center' },

  // Formulir Uji Kandungan Gas (page 2)
  gasStandardBox: { borderWidth: 1, borderColor: B, marginBottom: 8, width: '50%' },
  gasStandardRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  gasStandardCell: { flex: 1, borderRightWidth: 1, borderColor: B, padding: 3 },
  gasLogHeaderRow: { flexDirection: 'row', backgroundColor: SECTION_BG, borderWidth: 1, borderColor: B, alignItems: 'stretch' },
  gasLogRow: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: B, minHeight: 16, alignItems: 'stretch' },
  gasLogCell: { borderRightWidth: 1, borderColor: B, padding: 2, justifyContent: 'center' }
});

interface PtwPerson { worker_name?: string; worker_role?: string; name?: string; }
interface PtwAsset { name?: string; type?: string; }

/** PTW lain untuk pekerjaan yang sama — bagian D "Permit To Work Lainnya". */
import { overtimeMinutes, formatDuration, type PtwOvertime } from '@/lib/ptw-overtime';

export interface PtwSibling { ptw_type?: string | null; ptw_number?: string | null; }

interface PtwPDFProps {
  projectId: string;
  ptwNumber?: string | null;
  projectName?: string;
  vendorName?: string;
  location?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
  ptwType: PtwType;
  hazards: string[];
  apd: { [key: string]: string[] };
  pekerja: PtwPerson[];
  peralatan: PtwAsset[];
  gasTests?: PtwGasTestEntry[];
  /** Masa berlaku izin — milik PTW sendiri, bukan durasi proyek. */
  validFrom?: string | null;
  validTo?: string | null;
  workStart?: string | null;
  workEnd?: string | null;
  /** Khusus tipe panas. */
  hotWorkTypes?: string[];
  gasTestFrequency?: PtwGasTestFrequency;
  /** Nomor JSA rujukan pada bagian D. */
  jsaNumber?: string | null;
  /** PTW tipe lain di proyek yang sama, untuk referensi silang bagian D. */
  siblings?: PtwSibling[];
  /** Nama & tanggal penandatangan; kosong saat masih draft. */
  signatories?: PtwSignatories | null;
  /** Isian Sudah/Belum/Keterangan per hari, kosong kalau belum pernah diisi. */
  checklistData?: PtwSafetyChecklistData;
  /** Verifikasi harian (Pemegang/Pengawas) untuk PTW ini, dari ptw_daily_checks. */
  dailyChecks?: PtwDailyCheck[];
  /** Perpanjangan yang sudah disetujui (ptw.extensions) — tiap perpanjangan dicetak sebagai lembar PTW lengkap bernomor baru. */
  extensions?: PtwExtensionRecord[];
  /** Lembur PTW (ptw_overtimes); yang berstatus Disetujui dicetak di bagian A. */
  overtimes?: PtwOvertime[];
  /** ptw.extension_count; kalau lebih besar dari extensions.length, ada perpanjangan lama tanpa catatan nomor. */
  extensionCount?: number;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function PtwPDF({
  projectId,
  ptwNumber,
  projectName,
  vendorName,
  location,
  startDate,
  endDate,
  description,
  ptwType,
  hazards,
  apd,
  pekerja,
  peralatan,
  gasTests = [],
  validFrom,
  validTo,
  workStart,
  workEnd,
  hotWorkTypes = [],
  gasTestFrequency = {},
  jsaNumber,
  siblings = [],
  signatories,
  checklistData = {},
  dailyChecks = [],
  extensions = [],
  extensionCount,
  overtimes = [],
}: PtwPDFProps) {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];
  // Blok frekuensi uji gas di bagian E vs lampiran "Form UjiKand.Gas" —
  // tidak semua tipe yang punya blok frekuensi ikut melampirkan formulirnya.
  const requiresGasTest = PTW_GAS_TEST_TYPES.includes(ptwType);
  const hasGasForm = PTW_GAS_FORM_TYPES.includes(ptwType);
  const isHotWork = ptwType === 'panas';
  const hazardColumns = hazardColumnsFor(ptwType);

  // Verifikasi harian: baris per hari-ke (1..7) per peran, untuk kotak Verifikasi di bawah.
  const dailyCheckByHari = (hari: number, peran: 'pemegang' | 'pengawas') =>
    dailyChecks.find((c) => c.hari_ke === hari && c.peran === peran);

  // Masa berlaku PTW; jatuh kembali ke tanggal proyek untuk baris lama yang
  // dibuat sebelum kolom valid_from/valid_to ada.
  // Jumlah hari berlaku (termasuk hasil perpanjangan) dan jumlah lembar (7 hari per lembar).
  const totalDays = Math.max(1, ptwValidDayDates(validFrom, validTo).length);
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const berlakuMulai = validFrom || startDate;
  const berlakuSelesai = validTo || endDate;
  const jamMulai = workStart || '08:00';
  const jamSelesai = workEnd || '17:00';

  // Tiap perpanjangan dicetak sebagai lembar PTW LENGKAP. Perpanjangan yang sudah punya catatan nomor
  // (ptw.extensions) memakai nomornya; perpanjangan lama (disetujui sebelum nomor dicatat) diturunkan per
  // blok 7 hari dan tampil sebagai lembar lengkap dengan nomor "(belum diberi nomor)".
  const sortedExt = [...extensions].sort((a, b) => a.no - b.no);
  const fullyNumbered = sortedExt.length > 0 && (extensionCount ?? sortedExt.length) <= sortedExt.length;
  const addDaysStr = (d: string, n: number) => {
    const x = new Date(`${d.slice(0, 10)}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const extSheets: PtwExtensionRecord[] = fullyNumbered
    ? sortedExt
    : (totalWeeks > 1 && berlakuMulai && berlakuSelesai)
      ? Array.from({ length: totalWeeks - 1 }, (_, w) => {
          const from = addDaysStr(berlakuMulai, (w + 1) * 7);
          const lastDay = addDaysStr(berlakuMulai, (w + 2) * 7 - 1);
          const to = lastDay > berlakuSelesai.slice(0, 10) ? berlakuSelesai.slice(0, 10) : lastDay;
          const match = sortedExt.find((e) => e.from <= to && e.to >= from);
          return { no: w + 1, number: match?.number ?? '', from, to, decided_at: match?.decided_at ?? null };
        })
      : [];
  const hasExtSheets = extSheets.length > 0;
  const baseSelesai = hasExtSheets ? addDaysStr(extSheets[0].from, -1) : berlakuSelesai;

  // Bagian D — daftar dan urutannya diambil apa adanya dari tiap form; nomor
  // terisi otomatis kalau tipe itu memang diajukan untuk pekerjaan yang sama.
  const ptwLainnya = typeDef.crossRefs.map(ref => {
    const match = ref.type ? siblings.find(s => s.ptw_type === ref.type) : undefined;
    return {
      label: match?.ptw_number ? ref.label.replace('No…..', `No. ${match.ptw_number}`) : ref.label,
      checked: !!match,
    };
  });

  const dokumenPendukung = [
    { label: `Job Safety Analysis${jsaNumber ? ` : ${jsaNumber}` : ' : .....'}`, checked: !!jsaNumber },
    { label: 'Dokumen Dasar Pekerjaan (Kontrak Kerja, Surat Perintah Kerja, dll)', checked: false },
    { label: 'Jadwal Pelaksanaan Pekerjaan', checked: false },
    { label: 'Prosedur Pelaksanaan Pekerjaan', checked: false },
    { label: 'Daftar Identitas dan Sertifikat Pekerja', checked: pekerja.length > 0 },
    { label: 'Daftar APD, Peralatan Kerja, dan Sertifikat Kelayakan', checked: peralatan.length > 0 },
    { label: 'Berita Acara Pemeriksaan Lapangan (jika diperlukan)', checked: false },
    { label: 'Dokumen lainnya sesuai kebutuhan ….', checked: false },
  ];

  /** Satu blok tanda tangan; nilai kosong kalau tahapnya belum dilalui. */
  const SignBlock = ({ title, orang, merah = false, lastCell = false }: {
    title: string; orang?: PtwSignatory | null; merah?: boolean; lastCell?: boolean;
  }) => {
    const ink = merah ? { color: 'red' } : undefined;
    return (
      <View style={[styles.signCell, lastCell ? { borderRightWidth: 0 } : {}]}>
        <Text style={[styles.signLabel, ink as any]}>{title}</Text>
        <View style={[styles.signNameRow, { borderTopWidth: 0 }]}>
          <Text style={[styles.signNameLabel, ink as any]}>Nama</Text>
          <Text style={styles.signNameVal}>{orang?.nama || ''}</Text>
        </View>
        <View style={styles.signNameRow}>
          <Text style={[styles.signNameLabel, ink as any]}>Jabatan</Text>
          <Text style={styles.signNameVal}>{orang?.jabatan || ''}</Text>
        </View>
        <View style={[styles.signNameRow, { height: 22 }]}>
          <Text style={[styles.signNameLabel, ink as any, { alignSelf: 'center' }]}>Tanda Tangan</Text>
          <View style={[styles.signNameVal, { alignItems: 'center', justifyContent: 'center' }]}>
            {orang?.nama ? <Image src="/assets/approved.png" style={{ height: 19, objectFit: 'contain' }} /> : null}
          </View>
        </View>
        <View style={styles.signNameRow}>
          <Text style={[styles.signNameLabel, ink as any]}>Tanggal</Text>
          <Text style={styles.signNameVal}>{orang?.tanggal || ''}</Text>
        </View>
        <View style={styles.signNameRow}>
          <Text style={[styles.signNameLabel, ink as any]}>Catatan (jika ada)</Text>
          <Text style={styles.signNameVal}></Text>
        </View>
      </View>
    );
  };

  /** Satu baris checklist: kolom Ceklist, item, 7 pasang Sudah/Belum, keterangan. */
  const ChecklistRow = ({ marker, label, indent = false, bold = false, split = true, days, keterangan }: {
    marker: string; label: string; indent?: boolean; bold?: boolean; split?: boolean;
    days?: (boolean | null)[]; keterangan?: string;
  }) => (
    <View style={styles.tRow}>
      <View style={[styles.tCell, { width: '4%', alignItems: 'center' }]}><Text>{marker}</Text></View>
      <View style={[styles.tCell, { width: '31%' }]}>
        <Text style={{ fontSize: 4, lineHeight: 1.0, paddingLeft: indent ? 6 : 0, fontWeight: bold ? 'bold' : 'normal' }}>{label}</Text>
      </View>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const dayState = days?.[d - 1];
        return (
          <View key={d} style={[styles.tCell, { width: '8%', padding: 0, flexDirection: 'row' }]}>
            {split ? (
              <>
                <View style={{ flex: 1, borderRightWidth: 1, borderColor: B, alignItems: 'center', justifyContent: 'center' }}>
                  {dayState === true ? <Text style={{ fontSize: 4 }}>{'✓'}</Text> : null}
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {dayState === false ? <Text style={{ fontSize: 4 }}>{'✓'}</Text> : null}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      <View style={[styles.tCell, { width: '9%', borderRightWidth: 0 }]}><Text style={{ fontSize: 4 }}>{keterangan || ''}</Text></View>
    </View>
  );

  /** Satu lembar Safety Checklist + Verifikasi (7 hari). Lembar 0 = halaman utama; lembar berikutnya
   *  muncul bila PTW diperpanjang melewati Hari ke-7 dan dicetak menyatu dalam dokumen yang sama. */
  const SafetySheet = ({ weekIndex = 0, off: offProp, title: titleProp, showGas }: { weekIndex?: number; off?: number; title?: string; showGas?: boolean }) => {
    const off = offProp ?? weekIndex * 7;
    return (
      <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>
                {titleProp ?? (weekIndex === 0
                  ? (totalWeeks > 1 && !hasExtSheets ? `E. SAFETY CHECKLIST — HARI KE-1 S/D 7 (PTW DIPERPANJANG, LANJUTAN DI HALAMAN BERIKUTNYA)` : 'E. SAFETY CHECKLIST')
                  : `E. SAFETY CHECKLIST — LEMBAR LANJUTAN ${weekIndex} (HARI KE-${off + 1} S/D ${Math.min(off + 7, totalDays)})`)}
              </Text>

              {/* Table Header — tinggi tetap; "Hari ke-N" dan Sudah/Belum ditumpuk
                  di dalam sel, sisanya (Ceklist/Item/Keterangan) di tengah
                  vertikal, seperti sel yang di-merge 2 baris pada form asli. */}
              <View style={[styles.tHeaderRow, { height: 15 }]}>
                <View style={[styles.tCell, { width: '4%', alignItems: 'center' }]}><Text style={{ fontSize: 4 }}>Ceklist</Text></View>
                <View style={[styles.tCell, { width: '31%', alignItems: 'center' }]}><Text>Item</Text></View>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <View key={d} style={[styles.tCell, { width: '8%', padding: 0 }]}>
                    <View style={{ height: 7.5, borderBottomWidth: 1, borderColor: B, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 4 }}>Hari ke-{off + d}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flex: 1 }}>
                      <View style={{ flex: 1, borderRightWidth: 1, borderColor: B, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 3.5 }}>Sudah</Text></View>
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 3.5 }}>Belum</Text></View>
                    </View>
                  </View>
                ))}
                <View style={[styles.tCell, { width: '9%', borderRightWidth: 0, alignItems: 'center' }]}><Text style={{ fontSize: 4 }}>Keterangan</Text></View>
              </View>

              {/* Table Body — sub-item jadi baris tersendiri karena pada form
                  asli masing-masing punya kolom Sudah/Belum sendiri. */}
              {flattenSafetyChecklist(typeDef).map((row, i) => (
                <ChecklistRow
                  key={row.key ?? `hdr-${i}`}
                  marker={row.marker}
                  label={row.label}
                  indent={row.indent}
                  bold={row.bold}
                  split={row.checkable}
                  days={row.key ? checklistData[row.key]?.days?.slice(off, off + 7) : undefined}
                  keterangan={row.key ? checklistData[row.key]?.keterangan : undefined}
                />
              ))}

              {/* Frekuensi uji gas — ada pada form panas, listrik, ruang
                  terbatas, dan penggunaan kamera. */}
              {(showGas ?? weekIndex === 0) && requiresGasTest && (
                <View style={{ borderTopWidth: 1, borderColor: B }}>
                  <Text style={{ fontSize: fs_header, fontWeight: 'bold', paddingVertical: 1, paddingHorizontal: 2, backgroundColor: SECTION_BG }}>
                    Pengujian Kandungan Gas
                  </Text>
                  {([
                    ['O2', gasTestFrequency.o2],
                    ['Toxic', gasTestFrequency.toxic],
                    ['Combustible', gasTestFrequency.combustible],
                  ] as const).map(([label, value]) => (
                    <View key={label} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: B, minHeight: 8, alignItems: 'center' }}>
                      <Text style={{ width: '20%', padding: 1, borderRightWidth: 1, borderColor: B }}>{label}</Text>
                      <Text style={{ flex: 1, padding: 1 }}>
                        Dilakukan setiap {value || '…............................'} Jam/hari
                      </Text>
                    </View>
                  ))}
                  <Text style={{ fontSize: 4, padding: 1, borderTopWidth: 1, borderColor: B }}>
                    *Keterangan :  Untuk hasil uji kandungan gas WAJIB menggunakan Formulir Uji Kandungan Gas
                  </Text>
                </View>
              )}

              {/* Verifikasi — sejajar dengan kolom Hari ke-1..7 di atas, sama dengan
                  form asli: tanggal, waktu, lalu nama inisial + paraf per hari. */}
              <View style={{ borderTopWidth: 1, borderColor: B }} wrap={false}>
                <View style={{ flexDirection: 'row', backgroundColor: SECTION_BG, borderBottomWidth: 1, borderColor: B }}>
                  <Text style={{ width: '35%', fontWeight: 'bold', fontSize: fs_header, paddingVertical: 1, paddingHorizontal: 4 }}>Verifikasi</Text>
                </View>

                {/* Tanggal & Waktu — Tanggal dari check manapun yang ada hari itu; Waktu = waktu verifikasi Pemegang. */}
                {(['Tanggal (DD/MM)', 'Waktu'] as const).map((label) => (
                  <View key={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: B, height: 10 }}>
                    <View style={{ width: '35%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', paddingHorizontal: 4 }}><Text>{label}</Text></View>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const holder = dailyCheckByHari(off + d, 'pemegang');
                      const pengawas = dailyCheckByHari(off + d, 'pengawas');
                      const tanggal = (holder ?? pengawas)?.tanggal;
                      const value = label === 'Tanggal (DD/MM)'
                        ? (tanggal ? formatCheckDate(tanggal) : '')
                        : (holder?.diisi_pada ? formatCheckTime(holder.diisi_pada) : '');
                      return (
                        <View key={d} style={{ width: '8%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 4 }}>{value}</Text>
                        </View>
                      );
                    })}
                    <View style={{ width: '9%' }} />
                  </View>
                ))}

                {/* Pemegang PTW / Pengawas-Penerbit PTW: dua baris (Nama lengkap, Paraf) */}
                {(['pemegang', 'pengawas'] as const).map((peran, gi) => (
                  <View key={peran} style={{ flexDirection: 'row', borderBottomWidth: gi === 1 ? 0 : 1, borderColor: B }}>
                    <View style={{ width: '22%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', paddingHorizontal: 4 }}>
                      <Text>{peran === 'pemegang' ? 'Pemegang PTW' : 'Pengawas / Penerbit PTW'}</Text>
                    </View>
                    <View style={{ width: '78%' }}>
                      {(['Nama', 'Paraf'] as const).map((sub, si) => (
                        <View key={sub} style={{ flexDirection: 'row', height: 12, borderBottomWidth: si === 0 ? 1 : 0, borderColor: B }}>
                          <View style={{ width: '16.67%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ fontSize: 4 }}>{sub}</Text></View>
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                            const check = dailyCheckByHari(off + d, peran);
                            return (
                              <View key={d} style={{ width: '10.26%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', alignItems: 'center' }}>
                                {/* Nama lengkap (bukan inisial) dan tulisan "Check" sebagai paraf —
                                    simbol centang tidak tersedia di font PDF dan tampil kosong. */}
                                <Text style={{ fontSize: sub === 'Nama' ? 3.2 : 4, lineHeight: 1.05, textAlign: 'center', paddingHorizontal: 0.5 }}>
                                  {check ? (sub === 'Nama' ? (check.user_name || check.inisial) : 'Check') : ''}
                                </Text>
                              </View>
                            );
                          })}
                          <View style={{ width: '11.5%' }} />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                {/* Keterangan dinamis: penjabat yang ditugaskan dan uraian pekerjaan harian
                    dari Pemegang. Hanya muncul kalau ada isinya. */}
                {(() => {
                  const uraian = dailyChecks
                    .filter((c) => c.peran === 'pemegang' && c.uraian_pekerjaan && c.hari_ke > off && c.hari_ke <= off + 7)
                    .sort((a, b) => a.hari_ke - b.hari_ke);
                  const pemegangNama = signatories?.pemegang?.nama;
                  const pengawasNama = signatories?.pengawas?.nama;
                  if (uraian.length === 0 && !pemegangNama && !pengawasNama) return null;
                  return (
                    <View style={{ borderTopWidth: 1, borderColor: B, padding: 1.5 }}>
                      {(pemegangNama || pengawasNama) && (
                        <Text style={{ fontSize: 4 }}>
                          Pemegang PTW: {pemegangNama || '-'}   |   Pengawas PTW: {pengawasNama || '-'}
                        </Text>
                      )}
                      {uraian.length > 0 && (
                        <Text style={{ fontSize: 3.6, lineHeight: 1.1, marginTop: 0.5 }}>
                          <Text style={{ fontWeight: 'bold' }}>Uraian harian (Pemegang): </Text>
                          {uraian.map((c) => {
                            const teks = String(c.uraian_pekerjaan).replace(/\s+/g, ' ').trim();
                            return `H${c.hari_ke} ${formatCheckDate(c.tanggal)}: ${teks.length > 48 ? `${teks.slice(0, 45)}...` : teks}`;
                          }).join('  •  ')}
                        </Text>
                      )}
                    </View>
                  );
                })()}
              </View>

            </View>
    );
  };

  /** Satu lembar PTW lengkap (A–E + pengesahan). Dipakai untuk PTW asli dan untuk tiap perpanjangan bernomor. */
  const renderFormPage = (opts: {
    key: string; number?: string | null; mulai?: string | null; selesai?: string | null; pengesahan: string;
    off: number; sheetTitle?: string; nextNumber?: string | null; ext?: PtwExtensionRecord;
  }) => (
      <Page key={opts.key} size="A4" orientation="landscape" style={styles.page}>

        {/* TOP HEADER */}
        <View style={[styles.topHeader, { backgroundColor: typeDef.color }]}>
          <View style={styles.topHeaderLogo}>
            <Image src="/assets/logo/main-logo.png" style={{ width: '90%', objectFit: 'contain' }} />
          </View>
          <View style={styles.topHeaderCenter}>
            <Text style={[styles.headerTitle, { color: typeDef.textColor }]}>{typeDef.title.toUpperCase()}</Text>
            <Text style={[styles.headerSubtitle, { color: typeDef.textColor }]}>PT PERUSAHAAN GAS NEGARA Tbk</Text>
            {opts.ext && (
              <Text style={[styles.headerSubtitle, { color: typeDef.textColor }]}>
                PERPANJANGAN KE-{opts.ext.no} dari PTW No. {ptwNumber || '-'}  |  Hari ke-{opts.off + 1} s/d {opts.off + ptwValidDayDates(opts.ext.from, opts.ext.to).length}
              </Text>
            )}
            <Text style={[styles.headerRegion, { color: typeDef.textColor }]}>{location || '[wilayah]'}</Text>
          </View>
        </View>

        {/* MAIN BODY: 2 COLUMNS */}
        <View style={styles.mainColumns}>

          {/* LEFT COLUMN: A, B, C, D */}
          <View style={styles.leftColumn}>

            {/* A. UMUM */}
            <View style={styles.sectionBox} wrap={false}>
              <Text style={styles.sectionHeader}>A. UMUM</Text>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Nomor</Text>
                <Text style={styles.umumVal}>: {opts.number || (opts.ext ? '(belum diberi nomor)' : `Draft - ${projectId.slice(0, 8)}`)}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Tanggal pengesahan</Text>
                <Text style={styles.umumVal}>: {opts.pengesahan}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Masa Berlaku</Text>
                <View style={[styles.umumVal, { flexDirection: 'row', paddingLeft: 0, borderLeftWidth: 0 }]}>
                  <View style={{ flex: 1, borderLeftWidth: 1, borderColor: B, paddingLeft: 4, justifyContent: 'center' }}>
                     <Text>Tanggal: {formatDate(opts.mulai)} s/d {formatDate(opts.selesai)}</Text>
                  </View>
                  <View style={{ flex: 1, borderLeftWidth: 1, borderColor: B, paddingLeft: 4, justifyContent: 'center' }}>
                     <Text>Waktu: {jamMulai} s/d {jamSelesai}</Text>
                  </View>
                </View>
              </View>
              {(() => {
                const dari = (opts.mulai || '').slice(0, 10);
                const sampai = (opts.selesai || '9999-12-31').slice(0, 10);
                const lembur = overtimes
                  .filter((o) => o.status === 'Disetujui' && o.tanggal >= dari && o.tanggal <= sampai)
                  .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
                if (lembur.length === 0) return null;
                return (
                  <View style={styles.umumRow}>
                    <Text style={styles.umumLabel}>Lembur (disetujui)</Text>
                    <View style={[styles.umumVal, { paddingVertical: 1 }]}>
                      {lembur.map((o) => (
                        <Text key={o.id} style={{ fontSize: fs }}>
                          {formatDate(o.tanggal)}: {o.jam_mulai} s/d {o.jam_selesai}{o.jam_selesai <= o.jam_mulai ? ' (+1 hari)' : ''} — {formatDuration(overtimeMinutes(o.jam_mulai, o.jam_selesai))}
                        </Text>
                      ))}
                    </View>
                  </View>
                );
              })()}
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Lokasi Pekerjaan</Text>
                <Text style={styles.umumVal}>: {location || `Area Proyek ${projectName || projectId}`}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Pelaksana Pekerjaan</Text>
                <Text style={styles.umumVal}>: {vendorName || 'Vendor Terdaftar'}</Text>
              </View>
              {/* Khusus form Ijin Kerja Panas — pada form asli baris ini ada di
                  antara Pelaksana Pekerjaan dan Uraian Pekerjaan. Dua kolom,
                  dibaca ke bawah per kolom. */}
              {isHotWork && (
                <View style={[styles.umumRow, { minHeight: 20, alignItems: 'flex-start' }]}>
                  <Text style={[styles.umumLabel, { paddingTop: 2 }]}>Jenis Pekerjaan Panas</Text>
                  <View style={[styles.umumVal, { flexDirection: 'row', paddingVertical: 2 }]}>
                    {[HOT_WORK_JOB_TYPES.slice(0, 3), HOT_WORK_JOB_TYPES.slice(3)].map((kolom, ki) => (
                      <View key={ki} style={{ width: '50%' }}>
                        {kolom.map(item => (
                          <View key={item} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 1 }}>
                            <View style={hotWorkTypes.includes(item) ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                            <Text style={{ fontSize: fs }}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={[styles.umumRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.umumLabel}>Uraian Pekerjaan</Text>
                <Text style={styles.umumVal}>: {description || 'Pemeliharaan dan Perbaikan'}</Text>
              </View>
            </View>

            {/* B. IDENTIFIKASI SUMBER BAHAYA — enam kolom, dibaca ke bawah
                per kolom persis seperti form asli. */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>B. IDENTIFIKASI SUMBER BAHAYA ALAT/KEGIATAN</Text>
              <View style={[styles.gridContainer, { flexWrap: 'nowrap' }]}>
                {hazardColumns.map((kolom, ki) => (
                  <View key={ki} style={{ width: `${100 / hazardColumns.length}%`, paddingHorizontal: 1 }}>
                    {kolom.map((item, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 0.5 }}>
                        <View style={hazards.includes(item) ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                        <Text style={{ flex: 1, fontSize: 4, lineHeight: 1.15 }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* C. ALAT PELINDUNG DIRI — empat kolom; tiap kelompok ditutup
                baris isian "Others……….." seperti pada form. */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>C. ALAT PELINDUNG DIRI</Text>
              <View style={[styles.gridContainer, { flexDirection: 'row' }]}>
                {Object.entries(APD_ITEMS).map(([cat, items]) => (
                  <View key={cat} style={styles.apdCatCol}>
                    <Text style={styles.apdCatTitle}>{APD_CATEGORY_LABELS[cat] || cat}</Text>
                    {items.map(item => (
                      <View key={item} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0.5 }}>
                        <View style={apd[cat]?.includes(item) ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                        <Text style={{ fontSize: 4, lineHeight: 1.15 }}>{item}</Text>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0.5 }}>
                      <View style={styles.checkBoxEmpty} />
                      <Text style={{ fontSize: 4, lineHeight: 1.15 }}>{APD_OTHERS_LABEL}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* D. DOKUMEN PENDUKUNG — nomor PTW tipe lain untuk pekerjaan yang
                sama terisi otomatis sebagai referensi silang. */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>D. DOKUMEN PENDUKUNG DAN LAMPIRAN</Text>
              <View style={styles.docContainer}>
                <View style={styles.docCol}>
                   <Text style={styles.docColTitle}>Permit To Work Lainnya :</Text>
                   {ptwLainnya.map((item, i) => (
                     <View key={i} style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 0.5 }}>
                       <View style={item.checked ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                       <Text style={{ flex: 1, fontSize: 4, lineHeight: 1.15 }}>{item.label}</Text>
                     </View>
                   ))}
                </View>
                <View style={styles.docCol}>
                   <Text style={styles.docColTitle}>Dokumen Pendukung :</Text>
                   {dokumenPendukung.map((item, i) => (
                     <View key={i} style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 0.5 }}>
                       <View style={item.checked ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                       <Text style={{ flex: 1, fontSize: 4, lineHeight: 1.15 }}>{item.label}</Text>
                     </View>
                   ))}
                </View>
              </View>
            </View>

          </View>

          {/* RIGHT COLUMN: E */}
          <View style={styles.rightColumn}>
            {/* Jangan pakai flex: 1 di sini — parent-nya tidak punya tinggi
                tetap, jadi flex membuat blok ini melar menghabiskan sisa
                halaman dan mendorong footer ke halaman berikutnya. */}
            <SafetySheet off={opts.off} title={opts.sheetTitle} showGas />
          </View>

        </View>

        {/* FOOTER: 2 COLUMNS */}
        <View style={styles.footerColumns}>

          {/* Footer Left: PENGESAHAN */}
          <View style={styles.footerLeft}>
            <Text style={styles.shadedHeader}>PENGESAHAN DAN PERSETUJUAN PERMIT TO WORK</Text>
            <Text style={styles.disclaimer}>Saya memahami semua tindakan pencegahan dan akan memastikan pelaksanaan mitigasi sesuai dengan dokumen izin kerja yang ada.</Text>

            <View style={styles.signRow}>
              <SignBlock title="Pemohon Permit To Work" orang={signatories?.pemohon} />
              <SignBlock title="*Pemegang Permit To Work" orang={signatories?.pemegang} merah lastCell />
            </View>

            <Text style={styles.disclaimer}>* Diisi setelah PTW disetujui dan diserahkan di lokasi pekerjaan.</Text>
            <Text style={styles.disclaimer}>Saya sendiri telah memeriksa lokasi dan keadaannya, ijin ini menjamin untuk pekerjaan pada saat beroperasi.</Text>

            <View style={[styles.signRow, { borderBottomWidth: 0 }]}>
              <SignBlock title="Pemberi Permit To Work" orang={signatories?.pemberi} />
              <SignBlock title="Penerbit Permit To Work" orang={signatories?.penerbit} lastCell />
            </View>
          </View>

          {/* Footer Right: DIHENTIKAN & PENYELESAIAN */}
          <View style={styles.footerRight}>

            <View style={styles.footerBox}>
              <Text style={styles.shadedHeader}>DIHENTIKAN SEMENTARA</Text>
              <View style={{ padding: 2 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontSize: 4, lineHeight: 1.05 }}>
                    Saya menyatakan, saya menghentikan pekerjaan di PTW ini dan saya telah menginformasikan kepada penerbit PTW / wewenang operasi dengan ALASAN :
                  </Text>
                  <Text style={{ flex: 1, fontSize: 4, lineHeight: 1.05 }}>
                    Saya menyatakan pekerjaan di PTW ini bisa dimulai lagi setelah kondisi dan tindakan pencegahan telah dilakukan dengan baik dan layak. Saya juga sudah menginformasikan hal ini kepada pihak yang terkait.
                  </Text>
                </View>
                <Text style={{ marginBottom: 1, fontSize: 4 }}>................................................................................................................................................................</Text>

                <View style={styles.tableRow}>
                   <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text>Tanggal</Text></View>
                   <View style={styles.tableCell}><Text>Waktu</Text></View>
                   <View style={styles.tableCell}><Text>Nama</Text></View>
                   <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                   <View style={styles.tableCell}><Text>Tanggal</Text></View>
                   <View style={styles.tableCell}><Text>Waktu</Text></View>
                   <View style={styles.tableCell}><Text>Nama</Text></View>
                   <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                </View>
                <View style={[styles.tableRow, { height: 11, borderBottomWidth: 1 }]}>
                   <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text style={{ fontSize: 4, textAlign: 'center', fontWeight: 'bold' }}>APPROVED</Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text style={{ fontSize: 4, textAlign: 'center', fontWeight: 'bold' }}>APPROVED</Text></View>
                </View>

              </View>
            </View>

            <View style={styles.footerBox}>
              <Text style={styles.shadedHeader}>PENYELESAIAAN PERMIT TO WORK</Text>
              <View style={{ padding: 2 }}>
                <Text style={{ marginBottom: 1, fontSize: 4 }}>Kami yang bertandatangan di bawah ini menyatakan bahwa pekerjaan yang tercantum pada PTW ini :</Text>

                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: '40%' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0.5 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, fontSize: 4, lineHeight: 1.0 }}>Selesai dan diperiksa, lokasi kerja ditinggalkan dalam keadaan aman dan bahwa installasi dapat beroperasi kembali secara normal</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0.5 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, fontSize: 4, lineHeight: 1.0 }}>Tidak teralisasikan dan secara tegas di hentikan</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0.5 }}><View style={opts.nextNumber != null ? styles.checkBoxFilled : styles.checkBoxEmpty}/><Text style={{ flex: 1, fontSize: 4, lineHeight: 1.0 }}>Belum selesai dan akan dilanjutkan pada PTW No. {opts.nextNumber || '…......................................'}</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0.5 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, fontSize: 4, lineHeight: 1.0 }}>Beberapa langkah harus diambil sebelum installasi dapat dioperasikan kembali ….........</Text></View>
                  </View>
                  <View style={{ width: '60%', paddingLeft: 10 }}>
                      <View style={styles.tableRow}>
                         <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text>Tanggal</Text></View>
                         <View style={styles.tableCell}><Text>Waktu</Text></View>
                         <View style={styles.tableCell}><Text>Nama</Text></View>
                         <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                      </View>
                      <View style={[styles.tableRow, { height: 11, borderBottomWidth: 1 }]}>
                         <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text></Text></View>
                         <View style={styles.tableCell}><Text></Text></View>
                         <View style={styles.tableCell}><Text></Text></View>
                         <View style={styles.tableCell}><Text style={{ fontSize: 4, textAlign: 'center', fontWeight: 'bold' }}>APPROVED</Text></View>
                      </View>
                  </View>
                </View>

              </View>
            </View>

          </View>

        </View>

      </Page>
  );

  return (
    <Document>
      {renderFormPage({
        key: 'utama',
        number: ptwNumber,
        mulai: berlakuMulai,
        selesai: baseSelesai,
        pengesahan: currentDate,
        off: 0,
        sheetTitle: hasExtSheets ? 'E. SAFETY CHECKLIST' : undefined,
        nextNumber: hasExtSheets ? extSheets[0].number : null,
      })}

      {/* PERPANJANGAN BERNOMOR — tiap perpanjangan disetujui HSSE dicetak sebagai lembar PTW lengkap dengan nomor barunya. */}
      {extSheets.map((ext, k) => {
        const off = ptwValidDayDates(berlakuMulai, addDaysStr(ext.from, -1)).length;
        const hariAkhir = off + ptwValidDayDates(ext.from, ext.to).length;
        return renderFormPage({
          key: `ext-${ext.no}`,
          number: ext.number,
          mulai: ext.from,
          selesai: ext.to,
          pengesahan: ext.decided_at ? formatDate(ext.decided_at) : currentDate,
          off,
          sheetTitle: `E. SAFETY CHECKLIST — PERPANJANGAN KE-${ext.no} (HARI KE-${off + 1} S/D ${hariAkhir})`,
          nextNumber: extSheets[k + 1] ? extSheets[k + 1].number : null,
          ext,
        });
      })}
      {hasGasForm && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={{ fontSize: fs_title, fontWeight: 'bold', marginBottom: 4 }}>FORMULIR UJI KANDUNGAN GAS</Text>
          <Text style={{ fontSize: fs, marginBottom: 8 }}>
            PTW: {ptwNumber || `Draft - ${projectId.slice(0, 8)}`} — {typeDef.title}
          </Text>

          <Text style={{ fontSize: fs_header, fontWeight: 'bold', marginBottom: 3 }}>Standard Hasil Uji Kandungan Gas</Text>
          <View style={styles.gasStandardBox}>
            <View style={styles.gasStandardRow}>
              <Text style={[styles.gasStandardCell, { fontWeight: 'bold' }]}>Gas Item</Text>
              <Text style={[styles.gasStandardCell, { fontWeight: 'bold', borderRightWidth: 0 }]}>Standard</Text>
            </View>
            {GAS_TEST_STANDARDS.map(row => (
              <View key={row.item} style={[styles.gasStandardRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.gasStandardCell}>{row.item}</Text>
                <Text style={[styles.gasStandardCell, { borderRightWidth: 0 }]}>{row.standard}</Text>
              </View>
            ))}
          </View>

          <Text style={{ fontSize: fs_header, fontWeight: 'bold', marginBottom: 3 }}>Hasil Uji Kandungan Gas</Text>
          <View style={styles.gasLogHeaderRow}>
            <Text style={[styles.gasLogCell, { width: '4%', textAlign: 'center' }]}>No</Text>
            <Text style={[styles.gasLogCell, { width: '8%', textAlign: 'center' }]}>Tanggal</Text>
            <Text style={[styles.gasLogCell, { width: '7%', textAlign: 'center' }]}>Waktu</Text>
            <Text style={[styles.gasLogCell, { width: '10%', textAlign: 'center' }]}>O2 (Hasil / Sesuai)</Text>
            <Text style={[styles.gasLogCell, { width: '10%', textAlign: 'center' }]}>Toxic (Hasil / Sesuai)</Text>
            <Text style={[styles.gasLogCell, { width: '12%', textAlign: 'center' }]}>Combustible (Hasil / Sesuai)</Text>
            <Text style={[styles.gasLogCell, { width: '17%', textAlign: 'center' }]}>Keterangan</Text>
            <Text style={[styles.gasLogCell, { width: '15%', textAlign: 'center' }]}>Nama Pelaksana</Text>
            <Text style={[styles.gasLogCell, { width: '17%', textAlign: 'center', borderRightWidth: 0 }]}>Tanda Tangan</Text>
          </View>

          {gasTests.length === 0 ? (
            <View style={[styles.gasLogRow, { justifyContent: 'center' }]}>
              <Text style={{ fontSize: fs, padding: 4 }}>Belum ada data uji kandungan gas.</Text>
            </View>
          ) : (
            gasTests.map((row, i) => (
              <View key={i} style={styles.gasLogRow}>
                <Text style={[styles.gasLogCell, { width: '4%', textAlign: 'center' }]}>{i + 1}</Text>
                <Text style={[styles.gasLogCell, { width: '8%' }]}>{row.tanggal || '-'}</Text>
                <Text style={[styles.gasLogCell, { width: '7%' }]}>{row.waktu || '-'}</Text>
                <Text style={[styles.gasLogCell, { width: '10%' }]}>{row.o2Hasil || '-'} / {row.o2Sesuai ? 'Sesuai' : 'Tidak Sesuai'}</Text>
                <Text style={[styles.gasLogCell, { width: '10%' }]}>{row.toxicHasil || '-'} / {row.toxicSesuai ? 'Sesuai' : 'Tidak Sesuai'}</Text>
                <Text style={[styles.gasLogCell, { width: '12%' }]}>{row.combustibleHasil || '-'} / {row.combustibleSesuai ? 'Sesuai' : 'Tidak Sesuai'}</Text>
                <Text style={[styles.gasLogCell, { width: '17%' }]}>{row.keterangan || '-'}</Text>
                <Text style={[styles.gasLogCell, { width: '15%' }]}>{row.namaPelaksana || '-'}</Text>
                <Text style={[styles.gasLogCell, { width: '17%', borderRightWidth: 0, textAlign: 'center', fontWeight: 'bold', fontSize: 4 }]}>APPROVED</Text>
              </View>
            ))
          )}

          <Text style={{ fontSize: 4.5, marginTop: 8 }}>*Keterangan: Untuk hasil uji kandungan gas WAJIB menggunakan Formulir Uji Kandungan Gas ini.</Text>
        </Page>
      )}
    </Document>
  );
}

/**
 * Definisi formulir Permit To Work, disalin persis dari template resmi PGN di
 * `docs/templates/ptw-example/*.xlsx`.
 *
 * Teks di bawah ini sengaja mempertahankan salah ketik pada form aslinya
 * ("Ruang Tetutup", "safety breafing", "Alat Penagaman Mesin", "Lainya :",
 * "PENYELESAIAAN") supaya hasil cetak identik dengan formulir yang dipakai di
 * lapangan. Jangan "diperbaiki" tanpa konfirmasi ke pemilik form.
 *
 * Tipe `ketinggian` belum punya template — nomor 3 tidak ada di folder itu —
 * jadi isinya masih mengikuti struktur sementara dan belum terverifikasi.
 */

export type PtwType =
  | 'dingin'
  | 'panas'
  | 'listrik'
  | 'ruangTerbatas'
  | 'penggalian'
  | 'radiografi'
  | 'kamera'
  | 'diAtasPerairan'
  | 'dalamAir'
  | 'ketinggian';

/**
 * Satu baris di bawah butir checklist. Pada form asli tiap baris ini punya
 * kolom Sudah/Belum sendiri per hari, jadi ini baris tabel — bukan teks
 * penjelas.
 */
export interface PtwChecklistSub {
  /** Isi kolom "Ceklist": '1', '2', … atau '' kalau form aslinya tanpa nomor. */
  marker: string;
  label: string;
  /** Rincian yang menjorok lagi, mis. "- Blanking" di bawah "Diisolasi dengan :". */
  indent?: boolean;
}

export interface PtwSafetyChecklistItem {
  id: string;
  label: string;
  subItems?: PtwChecklistSub[];
  /**
   * Baris ini hanya judul kelompok — yang dicentang sub-itemnya. Dipakai form
   * Ketinggian yang terbagi jadi General / Perancah / Tangga.
   */
  groupOnly?: boolean;
}

/** Satu baris pada daftar "Permit To Work Lainnya" di bagian D. */
export interface PtwCrossRef {
  /** Teks persis dari form, mis. "PTW Memasuki Ruang Terbatas No…..". */
  label: string;
  /** Tipe yang dirujuk, dipakai untuk mengisi nomor otomatis. */
  type?: PtwType;
}

export interface PtwTypeDefinition {
  id: PtwType;
  title: string;
  color: string;
  textColor: string;
  checklist: PtwSafetyChecklistItem[];
  /** Daftar bagian D, urutannya berbeda-beda tiap form. */
  crossRefs: PtwCrossRef[];
}

const sub = (marker: string, label: string, indent = false): PtwChecklistSub => ({ marker, label, indent });
const bullets = (...labels: string[]): PtwChecklistSub[] => labels.map(l => sub('', l));

/** "c. Alat Pemadam Api Ringan" — sama di form panas, listrik, radiografi, kamera. */
const APAR_SUBS = bullets('APAR CO2', 'APAR Dry Chemical / Powder', 'APAR Busa', 'APAR Air', 'Lainnya….');

/** "b. Pengisolasian" — form dingin & panas. */
const ISOLASI_SUBS = bullets(
  'Isolasi Proses', 'Isolasi Mekanik', 'Isolasi Listrik', 'Isolasi Tekanan', 'Isolasi Kimia', 'lainnya….',
);

/** "a. Jalur tersebut sesungguhnya telah :" — form dingin & panas. */
const JALUR_SUBS: PtwChecklistSub[] = [
  sub('1', 'Dibebaskan dari tekanan atau Dikosongkan/drain'),
  sub('2', 'Didorong atau flush dengan air'),
  sub('3', 'Diisolasi dengan :'),
  sub('', '- Blanking', true),
  sub('', '- Dilepas', true),
  sub('', '- Kerangan dikunci', true),
  sub('', '- Diberi label', true),
  sub('4', 'Steaming out or Purging'),
];

/** "e. Semua penggerak utama peralatan listrik telah :" — form dingin & panas. */
const PENGGERAK_SUBS: PtwChecklistSub[] = [
  sub('1', 'Diisolasi dan diberi label.'),
  sub('2', 'Perlu pemeriksaan ulang.'),
];

/** Butir f–s yang sama persis di form dingin dan panas. */
const EKOR_DINGIN_PANAS: PtwSafetyChecklistItem[] = [
  { id: 'f', label: 'Semua peralatan telah di cek sertifikasi dan/atau kelayakannya' },
  { id: 'g', label: 'Sertifikasi / Kompetensi personil sesuai dengan pekerjaannya' },
  { id: 'h', label: 'Alat penanggulangan tumpahan' },
  { id: 'i', label: 'Tanda Peringatan / Penghalang' },
  { id: 'j', label: 'Scafolding / Perancah' },
  { id: 'k', label: 'Penggalian Manual' },
  { id: 'l', label: 'Penggalian dengan alat berat' },
  { id: 'm', label: 'Body Harness / Tali Pengaman Jatuh' },
  { id: 'n', label: 'Alat Penagaman Mesin' },
  { id: 'o', label: 'Pelampung' },
  { id: 'p', label: 'Lampu Penerangan Tambahan' },
  { id: 'q', label: 'Kendaraan Siaga / Kendaraan Emergency' },
  { id: 'r', label: 'Alat komunikasi (Radio, HT, Telephone)' },
  { id: 's', label: 'Lainya : ………………………………………………………………..' },
];

/** Label bagian D, dipakai untuk menyusun daftar per tipe. */
const REF: Record<string, PtwCrossRef> = {
  panas: { label: 'PTW Panas No…..', type: 'panas' },
  dingin: { label: 'PTW Dingin No…..', type: 'dingin' },
  ruangTerbatas: { label: 'PTW Memasuki Ruang Terbatas No…..', type: 'ruangTerbatas' },
  radiografi: { label: 'PTW Radiografi No…..', type: 'radiografi' },
  // Form Penggunaan Kamera menyebutnya "PTW Radiasi", bukan "PTW Radiografi".
  radiasi: { label: 'PTW Radiasi No…..', type: 'radiografi' },
  listrik: { label: 'PTW Listrik No…..', type: 'listrik' },
  ketinggian: { label: 'PTW Ketinggian No…..', type: 'ketinggian' },
  penggalian: { label: 'PTW Penggalian No…..', type: 'penggalian' },
  dalamAir: { label: 'PTW di dalam Air No…..', type: 'dalamAir' },
  diAtasPerairan: { label: 'PTW di atas Perairan No…..', type: 'diAtasPerairan' },
  // Form Di Dalam Air memakai kapital "Atas".
  diAtasPerairanKapital: { label: 'PTW di Atas Perairan No…..', type: 'diAtasPerairan' },
  kamera: { label: 'PTW Penggunaan Kamera No…..', type: 'kamera' },
  lainnya: { label: 'Lainnya …......' },
};
const refs = (...keys: string[]): PtwCrossRef[] => keys.map(k => REF[k]);

export const PTW_TYPES: PtwTypeDefinition[] = [
  {
    id: 'dingin',
    title: 'IJIN KERJA DINGIN (COLD WORK PERMIT)',
    color: '#00B050',
    textColor: '#FFFFFF',
    crossRefs: refs('ruangTerbatas', 'radiografi', 'listrik', 'penggalian', 'ketinggian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Jalur tersebut sesungguhnya telah :', subItems: JALUR_SUBS },
      { id: 'b', label: 'Pengisolasian', subItems: ISOLASI_SUBS },
      {
        id: 'c', label: 'Perlu dilakukan uji kandungan gas',
        subItems: bullets('Gas Mudah Terbakar (%LEL)', 'Oksigen (% O2)', 'Gas Beracun dan Berbahaya (%)'),
      },
      { id: 'd', label: 'Pengukuran Kandungan Gas Berkelanjutan' },
      { id: 'e', label: 'Semua penggerak utama peralatan listrik telah :', subItems: PENGGERAK_SUBS },
      ...EKOR_DINGIN_PANAS,
    ],
  },
  {
    id: 'panas',
    title: 'IJIN KERJA PANAS ( HOT WORK PERMIT )',
    color: '#FF0000',
    textColor: '#FFFFFF',
    crossRefs: refs('ruangTerbatas', 'radiografi', 'listrik', 'penggalian', 'ketinggian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Jalur tersebut sesungguhnya telah :', subItems: JALUR_SUBS },
      { id: 'b', label: 'Pengisolasian', subItems: ISOLASI_SUBS },
      { id: 'c', label: 'Alat Pemadam Api Ringan', subItems: APAR_SUBS },
      { id: 'd', label: 'Pengukuran Kandungan Gas Berkelanjutan' },
      { id: 'e', label: 'Semua penggerak utama peralatan listrik telah :', subItems: PENGGERAK_SUBS },
      ...EKOR_DINGIN_PANAS,
    ],
  },
  {
    id: 'listrik',
    title: 'IJIN KERJA LISTRIK ( ELECTRICAL WORK PERMIT )',
    color: '#0000FF',
    textColor: '#FFFFFF',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'radiografi', 'ketinggian', 'penggalian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Pengisolasian Listrik dilakukan dengan baik dan di beri label' },
      { id: 'b', label: 'Alat Pemadam Api Ringan', subItems: APAR_SUBS },
      { id: 'c', label: 'Tanda Peringatan / Penghalang' },
      { id: 'd', label: 'Pemasangan dan Penyambungan kabel' },
      { id: 'e', label: 'Peralatan dalam keadaan bergerak' },
      { id: 'f', label: 'Peralatan dalam keadaan panas' },
      { id: 'g', label: 'Tersedia jalan masuk dan keluar yang layak' },
      { id: 'h', label: 'Bahan mudah terbakar telah diamankan' },
      { id: 'i', label: 'Lampu penerangan tambaha / pendukung' },
      { id: 'j', label: 'Petugas pemadam kebakaran siap sedia' },
      { id: 'k', label: 'Petugas P3K siap sedia' },
      { id: 'l', label: 'Melakukan safety breafing sebelum pekerjaan' },
    ],
  },
  {
    id: 'ruangTerbatas',
    title: 'IJIN KERJA MEMASUKI RUANGAN TERBATAS',
    color: '#FFFF00',
    textColor: '#000000',
    crossRefs: refs('panas', 'dingin', 'listrik', 'radiografi', 'ketinggian', 'penggalian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Ruang Terbatas telah dibebaskan dari tekanan' },
      { id: 'b', label: 'Ruang Terbatas telah dikosongkan atau drain' },
      { id: 'c', label: 'Ruang terbatas telah di isolasi dengan baik' },
      { id: 'd', label: 'Tersedia ventilasi udara pembantu / fan pembantu' },
      { id: 'e', label: 'Alat Pemadam Api Ringan', subItems: APAR_SUBS },
      { id: 'f', label: 'Tersedia alat bantu pernafasan (SCBA / SABA / lainnya)' },
      { id: 'g', label: 'Tersedia tanda batas dan tanda peringatan darurat' },
      { id: 'h', label: 'Personil telah melakukan DCU dan dalam keadaan Fit To Work' },
      { id: 'i', label: 'Melakukan safety breafing sebelum pekerjaan' },
      { id: 'j', label: 'Tersedia petugas pengawas yang berkoordinasi secara rutin' },
      { id: 'k', label: 'Tim emergency siap sedia' },
    ],
  },
  {
    id: 'penggalian',
    title: 'IJIN KERJA PENGGALIAN (DIGGING PERMIT)',
    color: '#595959',
    textColor: '#FFFFFF',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'radiografi', 'listrik', 'ketinggian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Penggalian dilakukan secara manual' },
      { id: 'b', label: 'Penggalian dilakukan menggunakan alat berat' },
      { id: 'c', label: 'Kedalaman, Luasan dan Titik Penggalian telah diketahui semua pekerja' },
      { id: 'd', label: 'Area terdapat potensi bahaya longsor' },
      { id: 'e', label: 'Area terdapat potensi bahaya angin' },
      { id: 'f', label: 'Area terbebas dari potensi benda jatuh' },
      { id: 'g', label: 'Dinding pekerjaan perlu dipasang turap' },
      { id: 'h', label: 'Area kerja berada di area yang sempit' },
      { id: 'i', label: 'Area kerja perlu di pasang batas / penghalang / baricade' },
      { id: 'j', label: 'Tersedia rambu keselamatan' },
      { id: 'k', label: 'Personil telah melakukan DCU dan dalam keadaan Fit To Work' },
      { id: 'l', label: 'Melakukan safety breafing sebelum pekerjaan' },
      { id: 'm', label: 'Jalur penggalian terbebas dari kabel listrik bawah tanah' },
      { id: 'n', label: 'Jalur penggalian terbebas dari kabel telepon bawah tanah' },
      { id: 'o', label: 'Jalur penggalian terbebas dari kabel IT atau instrumen bawah tanah' },
      { id: 'p', label: 'Jalur penggalian terbebas dari gorong-gorong bawah tanah' },
      { id: 'q', label: 'Jalur penggalian terbebas dari pipa air bawah tanah' },
      { id: 'r', label: 'Jalur penggalian terbebas dari pipa gas / minyak bawah tanah' },
    ],
  },
  {
    id: 'radiografi',
    title: 'IJIN KERJA RADIOGRAFI (RADIOGRAPHIC WORK PERMIT )',
    color: '#9933FF',
    textColor: '#FFFFFF',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'listrik', 'ketinggian', 'penggalian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Petugas pemadam kebakaran siap sedia' },
      { id: 'b', label: 'Alat Pemadam Api Ringan', subItems: APAR_SUBS },
      { id: 'c', label: 'Tanda Peringatan / Penghalang Bahaya Radiasi' },
      { id: 'd', label: 'Peralatan dapat dioperasikan jarak jauh' },
      { id: 'e', label: 'Area bebas dari orang yang tidak berkepentingan' },
      { id: 'f', label: 'Radio komunikasi hanya dengan CCR' },
      { id: 'g', label: 'Jalur keluar dan masuk aman dari sumber radiasi' },
      { id: 'h', label: 'Bahan mudah terbakar telah diamankan' },
      { id: 'i', label: 'Semua peralatan las telah diamankan' },
      { id: 'j', label: 'Pengukuran radiasi pada pagar penghalang tidak lebih 0.75 mR/jam diudara' },
      { id: 'k', label: 'Melakukan safety breafing sebelum pekerjaan' },
      { id: 'l', label: 'Semua pekerja mengenakan APD dengan benar dan lengkap' },
    ],
  },
  {
    id: 'kamera',
    title: 'IJIN KERJA PENGGUNAAN KAMERA (CAMERA USE WORK PERMIT )',
    color: '#D9D9D9',
    textColor: '#000000',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'listrik', 'ketinggian', 'penggalian', 'dalamAir', 'diAtasPerairan', 'radiasi', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Petugas pemadam kebakaran siap sedia' },
      { id: 'b', label: 'Alat Pemadam Api Ringan', subItems: APAR_SUBS },
      { id: 'c', label: 'Penggunaan Kamera di Redzone' },
      { id: 'd', label: 'Penggunaan Kamera di area terlarang' },
      { id: 'e', label: 'Penggunaan Kamera Jarak Jauh / Drone' },
      { id: 'f', label: 'Pendampingan dan pengawasan dari penanggung jawab area' },
      { id: 'g', label: 'Kamera dan peralatan lainnya dalam keadaan aman dan tanpa sabotase' },
      { id: 'h', label: 'Melakukan toolbox meeting terkait detail pekerjaan yang dilakukan' },
      { id: 'i', label: 'Penggunaan Gas Detector' },
    ],
  },
  {
    id: 'diAtasPerairan',
    title: 'IJIN KERJA DIATAS PERAIRAN (ON THE WATER PERMIT)',
    color: '#D2DBE5',
    textColor: '#000000',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'radiografi', 'listrik', 'ketinggian', 'dalamAir', 'penggalian', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Kedalaman dan kondisi arus perairan telah diidentifikasi' },
      { id: 'b', label: 'Inspeksi dan pengamatan ulang area kerja sebelum dan saat bekerja' },
      { id: 'c', label: 'Penggunaan alat transportasi perairan (boat, sekoci, dll)' },
      { id: 'd', label: 'Kapasitas alat transportasi perairan sesuai dengan jumlah penumpang' },
      { id: 'e', label: 'Jaket pelampung terpakai dalam kondisi benar dan baik' },
      { id: 'f', label: 'Ring Buoy / Ring Pelampung Emergency tersedia dan dalam keadaan baik' },
      { id: 'g', label: 'Penggunaan alat komunikasi (Radio, HT , dan lainnya)' },
      { id: 'h', label: 'Terdapat potensi bahaya lumpur di area kerja dan telah di identifikasi' },
      { id: 'i', label: 'Terdapat potens bahaya longsor di area kerja dan telah di identifikasi' },
      { id: 'j', label: 'Terdapat potensi bahaya terhisap di area kerja dan telah di identifikasi' },
      { id: 'k', label: 'Area kerja perlu di pasang batas / penghalang / baricade' },
      { id: 'l', label: 'Tersedia rambu keselamatan' },
      { id: 'm', label: 'Personil telah melakukan DCU dan dalam keadaan Fit To Work' },
      { id: 'n', label: 'Melakukan safety breafing sebelum pekerjaan' },
      { id: 'o', label: 'Terdapat standby person' },
      { id: 'p', label: 'Penerangan (jika pekerjaan di malam hari)' },
      { id: 'q', label: 'Terdapat petugas P3K' },
      { id: 'r', label: 'Tersedia peralatan emergency' },
    ],
  },
  {
    id: 'dalamAir',
    title: 'IJIN KERJA DIDALAM AIR (IN THE WATER PERMIT)',
    color: '#DBEEF4',
    textColor: '#000000',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'radiografi', 'listrik', 'ketinggian', 'diAtasPerairanKapital', 'penggalian', 'kamera', 'lainnya'),
    checklist: [
      { id: 'a', label: 'Kedalaman dan kondisi arus perairan telah diidentifikasi' },
      { id: 'b', label: 'Inspeksi dan pengamatan ulang area kerja sebelum dan saat bekerja' },
      { id: 'c', label: 'Penggunaan alat transportasi perairan (boat, sekoci, dll)' },
      { id: 'd', label: 'Kapasitas alat transportasi perairan sesuai dengan jumlah penumpang' },
      { id: 'e', label: 'Peralatan selam digunakan dalam kondisi benar dan baik' },
      { id: 'f', label: 'Ring Buoy / Ring Pelampung Emergency tersedia dan dalam keadaan baik' },
      { id: 'g', label: 'Penggunaan alat komunikasi (Radio, HT , dan lainnya)' },
      { id: 'h', label: 'Terdapat potensi bahaya lumpur di area kerja dan telah di identifikasi' },
      { id: 'i', label: 'Terdapat potens bahaya longsor di area kerja dan telah di identifikasi' },
      { id: 'j', label: 'Terdapat potensi bahaya terhisap di area kerja dan telah di identifikasi' },
      { id: 'k', label: 'Area kerja perlu di pasang batas / penghalang / baricade' },
      { id: 'l', label: 'Tersedia rambu keselamatan' },
      { id: 'm', label: 'Personil telah melakukan DCU dan dalam keadaan Fit To Work' },
      { id: 'n', label: 'Melakukan safety breafing sebelum pekerjaan' },
      { id: 'o', label: 'Terdapat standby person' },
      { id: 'p', label: 'Penerangan (jika pekerjaan di malam hari)' },
      { id: 'q', label: 'Terdapat petugas P3K' },
      { id: 'r', label: 'Terdapat peralatan emergency dan pertolongan pertama keadaan darurat' },
      { id: 's', label: 'Penyelam telah memiliki bukti kompetensi (Sertifikat)' },
      { id: 't', label: 'Terdapat pekerjaan pengelasan didalam air' },
      { id: 'u', label: 'Terdapat pekerjaan menggunakan listrik didalam air' },
    ],
  },
  {
    id: 'ketinggian',
    title: 'IZIN KERJA DI KETINGGIAN (WORKING AT HEIGHT PERMIT)',
    color: '#ED7D31',
    textColor: '#FFFFFF',
    crossRefs: refs('panas', 'dingin', 'ruangTerbatas', 'radiografi', 'listrik', 'penggalian', 'dalamAir', 'diAtasPerairan', 'kamera', 'lainnya'),
    // Belum ada template resmi untuk tipe ini; struktur di bawah masih sementara.
    checklist: [
      {
        id: 'general', label: 'General', groupOnly: true, subItems: [
          sub('a.', 'Sebagian pekerjaan dilakukan di permukaan tanah'),
          sub('b.', 'Jarak ketinggian sudah diketahui oleh semua pekerja terlibat'),
          sub('c.', 'Area terdapat potensi bahaya angin'),
          sub('d.', 'Area terbebas dari potensi benda jatuh'),
          sub('e.', 'Area terbebas dari semua aliran listrik'),
          sub('f.', 'Area kerja berada di permukaan yang landai'),
          sub('g.', 'Area kerja berada di permukaan yang becek, basah, dan berlumpur'),
          sub('h.', 'Area kerja berada di ruang yang sempit'),
          sub('i.', 'Tersedia rambu keselamatan'),
          sub('j.', 'Area kerja perlu dipasang barikade'),
          sub('k.', 'Personil telah melakukan DCU dan dalam keadaan Fit To Work'),
          sub('l.', 'Melakukan safety briefing sebelum pekerjaan'),
        ],
      },
      {
        id: 'perancah', label: 'Alat Perancah (Scaffolding)', groupOnly: true, subItems: [
          sub('a.', 'Memerlukan perancah untuk pekerjaan'),
          sub('b.', 'Alat perancah disusun oleh petugas alat perancah yang kompeten'),
          sub('c.', 'Komponen alat perancah dalam kondisi baik'),
          sub('d.', 'Komponen alat sudah terpasang dengan baik'),
        ],
      },
      {
        id: 'tangga', label: 'Tangga (Ladder / Step Ladder)', groupOnly: true, subItems: [
          sub('a.', 'Memerlukan tangga untuk pekerjaan'),
          sub('b.', 'Tangga dalam kondisi layak dan sesuai untuk digunakan'),
          sub('c.', 'Tangga mampu menahan gerakan saat naik/turun dan bekerja'),
          sub('d.', 'Tangga memiliki panjang yang cukup untuk digunakan'),
          sub('e.', 'Memiliki stopper / pin / pengunci yang dapat digunakan'),
          sub('f.', 'Menggunakan peralatan lain dan memastikan aman digunakan saat bekerja'),
        ],
      },
      {
        id: 'lainnya', label: 'Pemeriksaan lainnya jika diperlukan', groupOnly: true,
        subItems: [sub('a.', ''), sub('b.', ''), sub('c.', '')],
      },
    ],
  },
];

/**
 * Bagian B disusun enam kolom, dibaca ke bawah per kolom persis seperti form
 * asli. Jumlah butir tiap kolom memang tidak sama.
 */
export const HAZARD_COLUMNS: string[][] = [
  ['Alat listrik', 'Api Terbuka / Percikan', 'Cairan Hidrokarbon', 'Cairan/Gas Bertekanan', 'Moving part', 'Crane / Lifting', 'Getaran', 'Generator/ compressor'],
  ['Gas, …………', 'Ruang Tetutup', 'Listrik Statis', 'Listrik', 'Bahan kimia', 'Bising', 'Kejatuhan'],
  ['Ergonomi', 'Operasi dalam air', 'Bekerja diketinggian', 'Kerja diatas air', 'Bertekanan', 'Mudah terbakar', 'Biologi', 'Media Panas / Dingin'],
  ['Paparan Panas Matahari', 'Kerja di saluran pembuangan', 'Pengangkatan Manual', 'Peralatan Bergerak', 'Cuaca Buruk', 'Penggunaan Bahan Kimia', 'Cold cutting'],
  ['Lifting', 'Suhu Tinggi', 'Suhu Rendah', 'Penggalian', 'Uji Bertekanan', 'Drilling', 'Kalibrasi', 'Lainnya'],
  ['Bongkar Muat', 'Mesin Pembakaran', 'Pengecatan', 'Lainnya'],
];

/**
 * Form Ijin Kerja Panas menulis "Akses Sulit" di posisi kedua, bukan
 * "Api Terbuka / Percikan" seperti sembilan form lainnya.
 */
export const HAZARD_COLUMNS_PANAS: string[][] = HAZARD_COLUMNS.map((col, i) =>
  i === 0 ? col.map((v, j) => (j === 1 ? 'Akses Sulit' : v)) : col,
);

export function hazardColumnsFor(type: PtwType): string[][] {
  return type === 'panas' ? HAZARD_COLUMNS_PANAS : HAZARD_COLUMNS;
}

export function hazardSourcesFor(type: PtwType): string[] {
  return hazardColumnsFor(type).flat();
}

/** Daftar datar untuk penyimpanan/kompatibilitas. */
export const HAZARD_SOURCES: string[] = HAZARD_COLUMNS.flat();

export const APD_ITEMS = {
  kepala: ['Safety Helmet', 'Safety Glass', 'Goggle', 'Face Shield'],
  telinga: ['Ear Plug', 'Ear Muff'],
  kaki: ['Safety Shoes/Boot', 'Safety Rain Boot', 'Electrical Shoes/Boot'],
  ketinggian: ['Full Body Harness', 'Safety Line'],
  pernapasan: ['Half Mask Respirator', 'Full Face Respirator', 'Dust Mask', 'SCBA/Airline Set'],
  tangan: ['Cotton Glove', 'Leather Glove', 'Rubber Glove', 'Chemical Glove'],
  badan: ['Coverall', 'Chemical Suit', 'Apron', 'Life Vest'],
};

/** Judul kelompok APD sesuai form; kuncinya sengaja tetap agar data lama terbaca. */
export const APD_CATEGORY_LABELS: Record<string, string> = {
  kepala: 'Kepala/Wajah',
  telinga: 'Telinga',
  kaki: 'Kaki',
  ketinggian: 'Ketinggian',
  pernapasan: 'Pernapasan',
  tangan: 'Tangan',
  badan: 'Badan',
};

/** Baris isian kosong yang menutup tiap kelompok APD pada form asli. */
export const APD_OTHERS_LABEL = 'Others………..';

/**
 * Tipe yang punya blok "Pengujian Kandungan Gas" (frekuensi O2/Toxic/
 * Combustible) di bawah bagian E.
 */
export const PTW_GAS_TEST_TYPES: PtwType[] = ['panas', 'listrik', 'ruangTerbatas', 'kamera'];

/**
 * Tipe yang templatenya melampirkan sheet "Form UjiKand.Gas" sebagai halaman
 * terpisah. Kamera memakai blok frekuensi tapi tidak punya lampiran ini.
 */
export const PTW_GAS_FORM_TYPES: PtwType[] = ['panas', 'listrik', 'ruangTerbatas'];

export const GAS_TEST_STANDARDS = [
  { item: 'O2', standard: '19.5% - 22%' },
  { item: 'Toxic', standard: 'Not more than PEL' },
  { item: 'Combustible', standard: '< 10 % LEL' }
];

/**
 * Bagian "Jenis Pekerjaan Panas" pada bagian A form Ijin Kerja Panas.
 * Urutan mengikuti pembacaan per kolom pada form (dua kolom, tiga baris).
 */
export const HOT_WORK_JOB_TYPES = [
  'Menimbulkan Api',
  'Menimbulkan Bunga Api',
  'Mesin Gerinda / Alat Potong',
  'Hot Tapping',
  'Menyalakan Flare',
  'Lainnya…...',
];

/**
 * Frekuensi "Pengujian Kandungan Gas" — "O2 dilakukan setiap ...... Jam/hari",
 * dst. Disimpan sebagai teks bebas karena form aslinya juga isian bebas.
 */
export interface PtwGasTestFrequency {
  o2?: string;
  toxic?: string;
  combustible?: string;
}

/** Kelengkapan formulir PTW di luar bahaya/APD/pekerja/peralatan. */
export interface PtwFormDetails {
  validFrom?: string | null;
  validTo?: string | null;
  workStart?: string | null;
  workEnd?: string | null;
  /** Khusus tipe panas. */
  hotWorkTypes?: string[];
  /** Untuk tipe pada PTW_GAS_TEST_TYPES. */
  gasTestFrequency?: PtwGasTestFrequency;
}

/** Batas masa berlaku satu PTW, mengikuti kolom "Hari ke-1 s/d ke-7" pada form. */
export const PTW_MAX_VALID_DAYS = 7;

export interface PtwGasTestEntry {
  tanggal: string;
  waktu: string;
  o2Hasil: string;
  o2Sesuai: boolean;
  toxicHasil: string;
  toxicSesuai: boolean;
  combustibleHasil: string;
  combustibleSesuai: boolean;
  keterangan: string;
  namaPelaksana: string;
}

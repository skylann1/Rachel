export type PtwType =
  | 'dingin'
  | 'panas'
  | 'listrik'
  | 'ruangTerbatas'
  | 'penggalian'
  | 'radiografi'
  | 'kamera'
  | 'diAtasPerairan'
  | 'dalamAir';

export interface PtwSafetyChecklistItem {
  id: string;
  label: string;
}

export interface PtwTypeDefinition {
  id: PtwType;
  title: string;
  color: string;
  textColor: string;
  checklist: PtwSafetyChecklistItem[];
}

export const PTW_TYPES: PtwTypeDefinition[] = [
  {
    id: 'dingin',
    title: 'IJIN KERJA DINGIN (COLD WORK PERMIT)',
    color: '#00B050',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Jalur tersebut sesungguhnya telah : Dibebaskan dari tekanan atau Dikosongkan/drain' },
      { id: '2', label: 'Didorong atau flush dengan air' },
      { id: '3', label: 'Diisolasi' },
      { id: '4', label: 'Steaming out or Purging' },
      { id: '5', label: 'Pengisolasian' },
      { id: '6', label: 'Perlu dilakukan uji kandungan gas' },
      { id: '7', label: 'Pengukuran Kandungan Gas Berkelanjutan' },
      { id: '8', label: 'Semua penggerak utama peralatan listrik telah : Diisolasi dan diberi label / Perlu pemeriksaan ulang' },
      { id: '9', label: 'Semua peralatan telah di cek sertifikasi dan/atau kelayakannya' },
      { id: '10', label: 'Sertifikasi / Kompetensi personil sesuai dengan pekerjaannya' },
      { id: '11', label: 'Alat penanggulangan tumpahan' },
      { id: '12', label: 'Tanda Peringatan / Penghalang' },
      { id: '13', label: 'Scafolding / Perancah' },
      { id: '14', label: 'Penggalian Manual' },
      { id: '15', label: 'Penggalian dengan alat berat' },
      { id: '16', label: 'Body Harness / Tali Pengaman Jatuh' },
      { id: '17', label: 'Alat Pengaman Mesin' },
      { id: '18', label: 'Pelampung' },
      { id: '19', label: 'Lampu Penerangan Tambahan' },
      { id: '20', label: 'Kendaraan Siaga / Kendaraan Emergency' },
      { id: '21', label: 'Alat komunikasi (Radio, HT, Telephone)' }
    ]
  },
  {
    id: 'panas',
    title: 'IJIN KERJA PANAS (HOT WORK PERMIT)',
    color: '#FF0000',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Lokasi pekerjaan telah diperiksa dan dinyatakan aman' },
      { id: '2', label: 'Telah dilakukan test gas beracun/mudah terbakar' },
      { id: '3', label: 'Isolasi telah dilakukan pada aliran gas/cairan yang mudah terbakar' },
      { id: '4', label: 'Bahan-bahan yang mudah terbakar telah disingkirkan/diamankan' },
      { id: '5', label: 'Peralatan pemadam api (APAR) tersedia dan berfungsi' },
      { id: '6', label: 'Fire Blanket/Tirai Penahan Percikan Api telah dipasang' },
      { id: '7', label: 'Petugas Fire Watch (Pemantau Api) telah siap sedia' },
      { id: '8', label: 'Peralatan pengelasan/pemotongan dalam kondisi baik' },
      { id: '9', label: 'Sirkulasi udara/ventilasi di area kerja cukup memadai' }
    ]
  },
  {
    id: 'listrik',
    title: 'IJIN KERJA LISTRIK (ELECTRICAL WORK PERMIT)',
    color: '#0000FF',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Sistem LOTO (Lock Out Tag Out) telah diterapkan' },
      { id: '2', label: 'Sumber listrik utama telah diputuskan/diisolasi' },
      { id: '3', label: 'Telah dilakukan pengetesan tegangan (Zero Energy Verification)' },
      { id: '4', label: 'Grounding sementara telah dipasang (jika diperlukan)' },
      { id: '5', label: 'Peralatan/perkakas listrik sudah terinspeksi dan berisolasi' },
      { id: '6', label: 'Sistem peringatan/barikade telah dipasang' },
      { id: '7', label: 'Semua kabel dan sambungan dipastikan aman/terlindung' }
    ]
  },
  {
    id: 'ruangTerbatas',
    title: 'IJIN KERJA RUANG TERBATAS (CONFINED SPACE PERMIT)',
    color: '#FFFF00',
    textColor: '#000000',
    checklist: [
      { id: '1', label: 'Uji kandungan gas (O2, LEL, H2S, CO) telah dilakukan dan aman' },
      { id: '2', label: 'Ventilasi mekanik (Blower/Exhaust) terpasang dan berfungsi' },
      { id: '3', label: 'Isolasi ruang (Blind/Disconnect) telah dipastikan' },
      { id: '4', label: 'Penerangan bertegangan rendah (Max 24V) tersedia' },
      { id: '5', label: 'Petugas Standby (Hole Watcher) berada di lokasi' },
      { id: '6', label: 'Sistem komunikasi tersedia dan berfungsi dengan baik' },
      { id: '7', label: 'Peralatan penyelamatan (Tripod/Harness) telah siap sedia' },
      { id: '8', label: 'Sistem LOTO telah diterapkan pada alat terkait' }
    ]
  },
  {
    id: 'penggalian',
    title: 'IJIN KERJA PENGGALIAN (DIGGING PERMIT)',
    color: '#595959',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Penggalian dilakukan secara manual / dengan alat berat' },
      { id: '2', label: 'Kedalaman, Luasan dan Titik Penggalian telah diketahui' },
      { id: '3', label: 'Area terdapat potensi bahaya longsor/angin/benda jatuh' },
      { id: '4', label: 'Dinding pekerjaan perlu dipasang turap/shoring' },
      { id: '5', label: 'Area kerja perlu dipasang batas / penghalang / barikade' },
      { id: '6', label: 'Tersedia rambu keselamatan' },
      { id: '7', label: 'Jalur penggalian terbebas dari kabel listrik bawah tanah' },
      { id: '8', label: 'Jalur penggalian terbebas dari kabel telepon bawah tanah' },
      { id: '9', label: 'Jalur penggalian terbebas dari pipa air/gas bawah tanah' }
    ]
  },
  {
    id: 'radiografi',
    title: 'IJIN KERJA RADIOGRAFI (RADIOGRAPHIC WORK PERMIT)',
    color: '#9933FF',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Petugas pemadam kebakaran siap sedia & APAR tersedia' },
      { id: '2', label: 'Tanda Peringatan / Penghalang Bahaya Radiasi terpasang' },
      { id: '3', label: 'Peralatan dapat dioperasikan jarak jauh' },
      { id: '4', label: 'Area bebas dari orang yang tidak berkepentingan' },
      { id: '5', label: 'Radio komunikasi hanya dengan CCR' },
      { id: '6', label: 'Jalur keluar dan masuk aman dari sumber radiasi' },
      { id: '7', label: 'Bahan mudah terbakar / peralatan las telah diamankan' },
      { id: '8', label: 'Pengukuran radiasi pada pagar tidak lebih 0.75 mR/jam' }
    ]
  },
  {
    id: 'kamera',
    title: 'IJIN KERJA PENGGUNAAN KAMERA (CAMERA USE WORK PERMIT)',
    color: '#00a651',
    textColor: '#FFFFFF',
    checklist: [
      { id: '1', label: 'Petugas pemadam kebakaran siap sedia & APAR tersedia' },
      { id: '2', label: 'Penggunaan Kamera di Redzone' },
      { id: '3', label: 'Penggunaan Kamera di area terlarang' },
      { id: '4', label: 'Penggunaan Kamera Jarak Jauh / Drone' },
      { id: '5', label: 'Pendampingan dan pengawasan dari penanggung jawab area' },
      { id: '6', label: 'Kamera dan peralatan lainnya dalam keadaan aman tanpa sabotase' },
      { id: '7', label: 'Melakukan toolbox meeting terkait detail pekerjaan' },
      { id: '8', label: 'Penggunaan Gas Detector' }
    ]
  },
  {
    id: 'diAtasPerairan',
    title: 'IJIN KERJA DIATAS PERAIRAN (ON THE WATER PERMIT)',
    color: '#C6D9F1',
    textColor: '#000000',
    checklist: [
      { id: '1', label: 'Kedalaman dan kondisi arus perairan telah diidentifikasi' },
      { id: '2', label: 'Inspeksi dan pengamatan ulang area kerja sebelum dan saat bekerja' },
      { id: '3', label: 'Penggunaan alat transportasi perairan (boat, sekoci, dll)' },
      { id: '4', label: 'Kapasitas alat transportasi perairan sesuai dengan jumlah penumpang' },
      { id: '5', label: 'Jaket pelampung terpakai dalam kondisi benar dan baik' },
      { id: '6', label: 'Ring Buoy / Ring Pelampung Emergency tersedia' },
      { id: '7', label: 'Penggunaan alat komunikasi (Radio, HT, dll)' },
      { id: '8', label: 'Terdapat potensi bahaya lumpur / longsor / terhisap' },
      { id: '9', label: 'Area kerja perlu dipasang batas / penghalang / barikade' },
      { id: '10', label: 'Tersedia rambu keselamatan & petugas P3K' }
    ]
  },
  {
    id: 'dalamAir',
    title: 'IJIN KERJA DIDALAM AIR (IN THE WATER PERMIT)',
    color: '#DBEEF4',
    textColor: '#000000',
    checklist: [
      { id: '1', label: 'Kedalaman dan kondisi arus perairan telah diidentifikasi' },
      { id: '2', label: 'Inspeksi dan pengamatan ulang area kerja sebelum dan saat bekerja' },
      { id: '3', label: 'Penggunaan alat transportasi perairan (boat, sekoci, dll)' },
      { id: '4', label: 'Peralatan selam digunakan dalam kondisi benar dan baik' },
      { id: '5', label: 'Ring Buoy / Ring Pelampung Emergency tersedia' },
      { id: '6', label: 'Penggunaan alat komunikasi (Radio, HT, dll)' },
      { id: '7', label: 'Terdapat potensi bahaya lumpur / longsor / terhisap' },
      { id: '8', label: 'Personil telah melakukan DCU dan Fit To Work' },
      { id: '9', label: 'Terdapat standby person / petugas P3K / alat emergency' },
      { id: '10', label: 'Terdapat pekerjaan pengelasan / menggunakan listrik didalam air' }
    ]
  }
];

export const HAZARD_SOURCES = [
  'Alat listrik', 'Api Terbuka / Percikan', 'Cairan Hidrokarbon', 'Cairan/Gas Bertekanan', 'Moving part', 'Crane / Lifting', 'Getaran', 'Generator/ compressor',
  'Gas Berbahaya', 'Ruang Tertutup', 'Listrik Statis', 'Listrik', 'Bahan kimia', 'Bising', 'Kejatuhan', 'Media Panas / Dingin',
  'Ergonomi', 'Operasi dalam air', 'Bekerja diketinggian', 'Kerja diatas air', 'Bertekanan', 'Mudah terbakar', 'Biologi', 'Lainnya',
  'Paparan Panas Matahari', 'Kerja di saluran pembuangan', 'Pengangkatan Manual', 'Peralatan Bergerak', 'Cuaca Buruk', 'Penggunaan Bahan Kimia', 'Cold cutting', 'Lainnya',
  'Lifting', 'Suhu Tinggi', 'Suhu Rendah', 'Penggalian', 'Uji Bertekanan', 'Drilling', 'Kalibrasi', 'Bongkar Muat', 'Mesin Pembakaran', 'Pengecatan'
];

export const APD_ITEMS = {
  kepala: ['Safety Helmet', 'Safety Glass', 'Goggle', 'Face Shield'],
  telinga: ['Ear Plug', 'Ear Muff'],
  kaki: ['Safety Shoes/Boot', 'Safety Rain Boot', 'Electrical Shoes/Boot'],
  ketinggian: ['Full Body Harness', 'Safety Line'],
  pernapasan: ['Half Mask Respirator', 'Full Face Respirator', 'Dust Mask', 'SCBA/Airline Set'],
  tangan: ['Cotton Glove', 'Leather Glove', 'Rubber Glove', 'Chemical Glove'],
  badan: ['Coverall', 'Chemical Suit', 'Apron', 'Life Vest']
};

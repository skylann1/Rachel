export const allPermissionModules = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Akses ke halaman utama dashboard dan statistik keseluruhan.',
    items: [
      { key: 'view', label: 'Melihat Statistik & Metrik', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
    ]
  },
  {
    id: 'inspection',
    title: 'Modul Inspeksi & Temuan K3',
    description: 'Manajemen inspeksi lapangan dan temuan unsafe act / unsafe condition.',
    items: [
      { key: 'view', label: 'Melihat Daftar Inspeksi', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'create', label: 'Membuat Laporan Inspeksi Baru', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage', label: 'Mengelola / Menutup Temuan', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
  {
    id: 'incident',
    title: 'Modul Laporan Insiden',
    description: 'Pencatatan dan investigasi kecelakaan atau insiden.',
    items: [
      { key: 'view', label: 'Melihat Daftar Insiden', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'create', label: 'Melaporkan Insiden', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'investigate', label: 'Investigasi & Tindak Lanjut', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
  {
    id: 'approval',
    title: 'Verifikasi Dokumen',
    description: 'Akses ke halaman daftar proyek yang butuh tindakan K3 (Kelola Proyek / Proyek Berjalan / Arsip Proyek). Approve/reject sebenarnya dikontrol per-tahap lewat modul Prosedur Kerja, JSA, dan PTW di bawah.',
    items: [
      { key: 'view', label: 'Melihat Dokumen Masuk', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review Prosedur Kerja — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review Prosedur Kerja — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'review', label: 'Review & Approve Prosedur Kerja', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
  {
    id: 'jsa',
    title: 'Modul JSA (Job Safety Analysis)',
    description: 'Hak akses terkait manajemen Job Safety Analysis. Review PGSOL dan Approve PGN wajib dilakukan oleh dua orang berbeda.',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru', allowedTypes: ['vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — JSA', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review JSA — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review JSA — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer/HSE PGSOL per Proyek', allowedTypes: ['pgsol'] },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN', allowedTypes: ['pgn'] },
      { key: 'delete', label: 'Menghapus Data JSA', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'ptw',
    title: 'Modul PTW (Permit to Work)',
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — lima tahap approval berurutan.',
    items: [
      { key: 'view', label: 'Melihat Daftar PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'edit_safety_checklist', label: 'Mengisi & Mengedit Safety Checklist PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — PTW', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review PTW — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review PTW — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)', allowedTypes: ['pgn'] },
      { key: 'review_issuer', label: 'Review Tahap PTW Issuer', allowedTypes: ['pgn'] },
      { key: 'numbering_hsse', label: 'Penomoran & Penerbitan PTW (HSSE)', allowedTypes: ['pgn'] },
      { key: 'resume_work', label: 'Membatalkan Stop Work Authority (Resume PTW)', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'siteOps',
    title: 'Toolbox Meeting & Kehadiran Lapangan',
    description: 'Status toolbox meeting harian dan siapa saja yang sedang check-in di lokasi kerja lewat halaman QR check-in.',
    items: [
      { key: 'view', label: 'Melihat Status Kehadiran & Toolbox Meeting', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage', label: 'Mencatat Toolbox Meeting dari Dashboard', allowedTypes: ['vendor'] },
    ]
  },
  {
    id: 'masterData',
    title: 'Master Data',
    description: 'Akses ke data inti sistem seperti Akun, Role, dan Vendor.',
    items: [
      { key: 'view_vendor', label: 'Melihat Data Vendor', allowedTypes: ['pgn', 'pgsol'] },
      { key: 'manage_vendor', label: 'Mengelola Data Vendor', allowedTypes: ['pgn'] },
      { key: 'view_account', label: 'Melihat Data Akun', allowedTypes: ['pgn', 'pgsol'] },
      { key: 'manage_account', label: 'Mengelola Data Akun', allowedTypes: ['pgn'] },
      { key: 'manage_org_staff', label: 'Mengelola Staff Organisasi Sendiri', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage_role', label: 'Mengelola Role & Permission', allowedTypes: ['pgn'] },
      { key: 'view_project', label: 'Melihat Master Proyek', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage_project', label: 'Mengelola Master Proyek', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'vendorResources',
    title: 'Sumber Daya Vendor (Pekerja, Alat, Material)',
    description: 'Manajemen data master spesifik milik vendor (pekerja, peralatan, material) dan upload dokumen persyaratan.',
    items: [
      { key: 'view_worker', label: 'Melihat Data Pekerja', allowedTypes: ['vendor', 'pgn', 'pgsol'] },
      { key: 'manage_worker', label: 'Mengelola Data Pekerja', allowedTypes: ['vendor'] },
      { key: 'view_equipment', label: 'Melihat Data Peralatan', allowedTypes: ['vendor', 'pgn', 'pgsol'] },
      { key: 'manage_equipment', label: 'Mengelola Data Peralatan', allowedTypes: ['vendor'] },
      { key: 'view_material', label: 'Melihat Data Material', allowedTypes: ['vendor', 'pgn', 'pgsol'] },
      { key: 'manage_material', label: 'Mengelola Data Material', allowedTypes: ['vendor'] },
      { key: 'manage_docs', label: 'Mengunggah Dokumen K3 Vendor', allowedTypes: ['vendor'] },
    ]
  },
  {
    id: 'vendorDocs',
    title: 'Dokumen Vendor',
    description: 'Akses untuk melihat dan memverifikasi (Approve/Reject) dokumen persyaratan vendor.',
    items: [
      { key: 'view', label: 'Melihat Dokumen Vendor', allowedTypes: ['pgn', 'pgsol'] },
      { key: 'approve', label: 'Menyetujui / Menolak Dokumen', allowedTypes: ['pgn'] },
    ]
  }
];

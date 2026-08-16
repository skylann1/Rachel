export const allPermissionModules = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Akses ke halaman utama dashboard dan statistik keseluruhan.',
    items: [
      { key: 'view', label: 'Melihat Statistik & Metrik' },
    ]
  },
  {
    id: 'inspection',
    title: 'Modul Inspeksi & Temuan K3',
    description: 'Manajemen inspeksi lapangan dan temuan unsafe act / unsafe condition.',
    items: [
      { key: 'view', label: 'Melihat Daftar Inspeksi' },
      { key: 'create', label: 'Membuat Laporan Inspeksi Baru' },
      { key: 'manage', label: 'Mengelola / Menutup Temuan' },
    ]
  },
  {
    id: 'incident',
    title: 'Modul Laporan Insiden',
    description: 'Pencatatan dan investigasi kecelakaan atau insiden.',
    items: [
      { key: 'view', label: 'Melihat Daftar Insiden' },
      { key: 'create', label: 'Melaporkan Insiden' },
      { key: 'investigate', label: 'Investigasi & Tindak Lanjut' },
    ]
  },
  {
    id: 'approval',
    title: 'Verifikasi Dokumen',
    description: 'Persetujuan dan verifikasi berbagai dokumen administratif K3.',
    items: [
      { key: 'view', label: 'Melihat Dokumen Masuk' },
      { key: 'approve', label: 'Menyetujui / Menolak Dokumen' },
    ]
  },
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja' },
      { key: 'review', label: 'Review & Approve Prosedur Kerja' },
    ]
  },
  {
    id: 'jsa',
    title: 'Modul JSA (Job Safety Analysis)',
    description: 'Hak akses terkait manajemen Job Safety Analysis. Review PGSOL dan Approve PGN wajib dilakukan oleh dua orang berbeda.',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL' },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN' },
      { key: 'delete', label: 'Menghapus Data JSA' },
    ]
  },
  {
    id: 'ptw',
    title: 'Modul PTW (Permit to Work)',
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — tiga tahap approval berurutan.',
    items: [
      { key: 'view', label: 'Melihat Daftar PTW' },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)' },
      { key: 'review_issuer', label: 'Review Tahap PTW Issuer' },
      { key: 'numbering_hsse', label: 'Penomoran & Penerbitan PTW (HSSE)' },
    ]
  },
  {
    id: 'masterData',
    title: 'Master Data',
    description: 'Akses ke data inti sistem seperti Akun, Role, dan Vendor.',
    items: [
      { key: 'view_vendor', label: 'Melihat Data Vendor' },
      { key: 'manage_vendor', label: 'Mengelola Data Vendor' },
      { key: 'view_account', label: 'Melihat Data Akun' },
      { key: 'manage_account', label: 'Mengelola Data Akun' },
      { key: 'manage_role', label: 'Mengelola Role & Permission' },
      { key: 'view_project', label: 'Melihat Master Proyek' },
      { key: 'manage_project', label: 'Mengelola Master Proyek' },
    ]
  },
  {
    id: 'vendorDocs',
    title: 'Dokumen Vendor',
    description: 'Akses untuk melihat dan memverifikasi (Approve/Reject) dokumen persyaratan vendor.',
    items: [
      { key: 'view', label: 'Melihat Dokumen Vendor' },
      { key: 'approve', label: 'Menyetujui / Menolak Dokumen' },
    ]
  }
];

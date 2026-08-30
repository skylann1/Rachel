# Urutan Migrasi Fase 2 — Per-Project Approver Assignment

Jalankan di Supabase SQL editor, SATU PER SATU, setelah semua migrasi
Fase 1 (`supabase/README_org_migration_order.md`) sudah dijalankan:

1. `schema_stage_assignments.sql`
2. `schema_stage_assignment_permissions.sql`

## Verifikasi manual

- [ ] Sebagai admin PGN, buka detail proyek, assign 2 orang ke tahap
      "Persetujuan JSA (PGN)". Simpan — pastikan checkbox terkunci untuk
      tahap yang sudah punya assignment aktif hanya SETELAH salah satu
      approve, bukan langsung setelah disimpan.
- [ ] Sebagai admin PGSOL, buka `/pgsol/dashboard/projects`, assign 2
      reviewer ke satu proyek. Approve sebagai reviewer pertama — status
      JSA proyek itu harus TETAP di "Review PGSOL" (belum semua approve).
      Approve sebagai reviewer kedua — status harus maju ke "Persetujuan
      PGN", dan kedua PGN approver yang ditugaskan harus menerima
      notifikasi.
- [ ] Reject JSA sebagai salah satu dari 2 approver PGN yang ditugaskan —
      status harus langsung balik ke Draft (tidak menunggu approver PGN
      kedua memutuskan), dan SEMUA baris assignment tahap PGSOL maupun PGN
      untuk JSA itu harus kembali ke `pending`.
- [ ] Proyek dengan 0 orang ditugaskan ke `ptw.approve_pm` — pastikan PTW
      tidak bisa di-approve sama sekali (pesan error jelas, bukan crash).
- [ ] Login sebagai seseorang yang ditugaskan sebagai reviewer JSA tahap
      PGSOL — pastikan tugas itu muncul di `/dashboard/my-task`, dan
      TIDAK muncul di situ untuk staff lain yang punya permission
      `jsa.review_pgsol` yang sama tapi tidak ditugaskan ke proyek ini.
- [ ] Konfirmasi `requireDistinctApprover` masih mencegah 1 orang yang
      kebetulan ditugaskan ke `ptw.approve_pm` DAN `ptw.review_issuer`
      pada proyek yang sama dari menyetujui kedua tahap itu sendirian.

# Urutan Migrasi Fase 1 — Fondasi Multi-Tenant

Jalankan file-file ini di Supabase SQL editor, SATU PER SATU, PERSIS
urutan ini (lompat urutan akan gagal — beberapa file sengaja harus jadi
transaksi sendiri, lihat komentar di tiap file):

1. `schema_organizations.sql`
2. `schema_org_add_pgsol_type.sql`
3. `schema_org_backfill_internal.sql` — **jangan dijalankan dua kali**,
   akan membuat organisasi PGN/PGSOL duplikat.
4. `schema_org_backfill_vendor.sql` — sebelum menjalankan ini, cek nama
   constraint FK asli lewat `\d vendor_profiles` (Supabase SQL editor,
   tab Table Editor > vendor_profiles > constraints tab juga bisa) dan
   sesuaikan baris `DROP CONSTRAINT vendor_profiles_id_fkey` kalau
   namanya beda dari yang tertulis di file.
5. `schema_org_rename_type_labels.sql`
6. `schema_org_fix_type_functions.sql`
7. `schema_org_rls_vendor_scope.sql`
8. `schema_org_roles.sql`

## Verifikasi manual setelah semua file di atas dijalankan

- [ ] Login sebagai akun vendor lama (pre-migrasi) — pastikan masih bisa
      melihat proyek miliknya seperti biasa.
- [ ] Buat akun vendor staff KEDUA di company yang sama (lewat
      `/dashboard/master-data/account`, pilih company yang sudah ada —
      catatan: form saat ini hanya mendukung membuat company BARU;
      menambah staff ke company existing dilakukan lewat
      `/vendor/dashboard/staff` setelah staff pertamanya login dan
      mengundang staff kedua, ATAU lewat SQL manual untuk pengujian awal:
      `UPDATE profiles SET org_id = '<org id vendor lama>' WHERE id = '<user id staff baru>'`
      setelah staff baru dibuat via `auth.admin.createUser`).
- [ ] Login sebagai staff kedua ini — pastikan BISA melihat proyek yang
      sama dengan staff pertama (ini bukti utama RLS org-scoping bekerja).
- [ ] Login sebagai vendor company LAIN (company B) — pastikan TIDAK BISA
      mengakses proyek company A walau tahu id proyeknya (coba lewat URL
      langsung, bukan cuma dari daftar).
- [ ] Login sebagai akun `pgsol_reviewer` lama — pastikan diarahkan ke
      `/pgsol/login` (bukan lagi `/auth/login`), dan setelah login bisa
      membuka `/dashboard/approval` (tapi tidak bisa membuka
      `/dashboard/master-data` atau path `/dashboard/*` lain).
- [ ] Login sebagai akun PGN (`type='pgn'`) — pastikan tetap bisa
      mengakses seluruh `/dashboard/*` seperti sebelum migrasi ini, tanpa
      regresi.
- [ ] Coba `updateAccount`/`suspendAccount` dari akun vendor_admin company
      A terhadap id staff company B — pastikan ditolak dengan pesan
      "Akun ini bukan bagian dari organisasi Anda." (bukan cuma
      disembunyikan di UI — panggil action-nya, bukan cuma cek tombolnya
      tidak muncul).

# Urutan Migrasi Fase 1 — Fondasi Multi-Tenant

> **Mau sekali paste-jalankan saja?** Pakai
> `supabase/RUN_ALL_migrations_2026-08-30.sql` — gabungan file ini +
> seluruh migrasi Fase 2 jadi satu file, dengan `BEGIN;`/`COMMIT;` di
> titik-titik yang wajib jadi transaksi terpisah. Cek dulu peringatan
> di bagian atas file itu (nama constraint FK `vendor_profiles`) sebelum
> menjalankannya. Bagian di bawah ini tetap berguna sebagai referensi isi
> & alasan tiap langkah, dan sebagai jalur mundur kalau mau jalankan
> satu-satu.

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
9. `schema_org_fix_vendor_trigger_and_policies.sql` — memperbaiki
   `handle_new_user()` (berhenti menyisipkan `vendor_profiles` pada id
   auth user, yang sejak langkah 4 selalu melanggar FK dan menggagalkan
   SELURUH pembuatan akun), menambah policy SELECT "anggota org boleh
   membaca profil rekan satu org" di `profiles` (tanpa ini daftar staff
   selalu berisi 1 baris), dan mengganti policy self-update
   `vendor_profiles` supaya memakai id organisasi, bukan `auth.uid()`.
   Butuh `current_vendor_org_id()` dari langkah 7 — jangan dijalankan
   sebelum itu.

## Alur menambah staff ke perusahaan vendor / PGSOL

Setelah semua migrasi di atas dijalankan, alur resminya seperti ini
(tidak ada lagi jalur SQL manual — jangan pakai `UPDATE profiles SET
org_id = ...` untuk ini):

1. **Akun pertama sebuah company vendor baru** dibuat oleh superadmin PGN
   (pemegang permission `masterData.manage_account`) lewat
   `/dashboard/master-data/account` → tombol "Tambah Akun", pilih tipe
   `Vendor` dan isi **Nama Perusahaan**. Action `addAccount` yang membuat
   baris `organizations` (`kind = 'vendor'`) baru sekaligus baris
   `vendor_profiles` pada id organisasi itu, lalu menautkan
   `profiles.org_id` akun baru ke organisasi tersebut.
   (Alur lama lewat `/dashboard/master-data/vendor` → "Tambah Vendor"
   melakukan hal yang persis sama.)
2. Beri akun pertama itu role **`vendor_admin`** — role ini membawa
   permission `masterData.manage_org_staff`.
3. **Staff berikutnya di company yang sama** ditambahkan sendiri oleh
   `vendor_admin` tersebut lewat `/vendor/dashboard/staff`. Halaman itu
   memakai jalur org-scoped: `addAccount` memaksa `type` dan `org_id`
   akun baru mengikuti milik aktor dan TIDAK pernah membuat organisasi
   baru, jadi staff kedua otomatis berbagi `org_id` (dan karenanya
   proyek/aset) dengan staff pertama.
4. Pola yang sama berlaku untuk PGSOL: superadmin PGN membuat akun
   pertama bertipe `PGSOL` dengan role **`pgsol_admin`**, lalu admin itu
   menambah staff PGSOL lainnya lewat `/pgsol/dashboard/staff`.

Role yang boleh diberikan oleh admin org ter-scope dibatasi server-side:
hanya role dengan `roles.type` yang sama dengan tipe organisasi aktor,
dan role `admin` tidak pernah boleh diberikan dari jalur ini.

## Verifikasi manual setelah semua file di atas dijalankan

- [ ] Login sebagai akun vendor lama (pre-migrasi) — pastikan masih bisa
      melihat proyek miliknya seperti biasa.
- [ ] Buat akun vendor staff KEDUA di company yang sama, mengikuti alur
      di bagian "Alur menambah staff" di atas (akun pertama diberi role
      `vendor_admin`, lalu staff kedua dibuat dari
      `/vendor/dashboard/staff`).
- [ ] Login sebagai staff kedua ini — pastikan BISA melihat proyek yang
      sama dengan staff pertama (ini bukti utama RLS org-scoping bekerja),
      dan pastikan daftar di `/vendor/dashboard/staff` menampilkan KEDUA
      akun (bukti policy SELECT dari langkah 9 aktif).
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
- [ ] Coba `updateAccount` dari akun `vendor_admin` terhadap akunnya
      sendiri dengan `role = 'admin'` — pastikan ditolak dengan pesan
      "Role admin tidak dapat diberikan dari halaman ini." (tanpa ini
      admin org bisa mempromosikan dirinya jadi superadmin lintas org).

## Migrasi terbaru (sweep riset, jalankan di SQL editor sesuai urutan ini)

Jalankan SATU PER SATU di Supabase SQL editor setelah semua langkah di atas
(dan migrasi `schema_swa_toolbox_checkin.sql` — default kolom
`toolbox_meetings.meeting_date` harus sudah ada):

1. `schema_ptw_vendor_update_policy.sql` — versi diperbarui: halaman ini
   masih berisi perbaikan policy UPDATE PTW oleh vendor (scoping org +
   status `Review Internal Vendor`). Aman dijalankan ulang (DROP + CREATE).
2. `schema_inspections_rls.sql` — menambahkan 5 policy RLS pada tabel
   `inspections` (internal baca semua, vendor baca punya sendiri,
   internal insert/update, vendor update punya sendiri). Aman dijalankan
   ulang.
3. `schema_vendor_documents_bucket.sql` — membuat bucket storage
   `vendor-documents` (public) + policy SELECT/INSERT untuk pengguna
   terautentikasi. Aman dijalankan ulang.
4. `schema_meeting_date_timezone.sql` — set default `meeting_date` ke
   tanggal Asia/Jakarta (bukan `CURRENT_DATE` zona sesi). **Bukan
   idempotent untuk efek samping**, cukup sekali.
5. `schema_ptw_numbering.sql` — tabel counter `ptw_numbering` + fungsi
   `get_next_ptw_number()` untuk penomoran PTW yang atomik (pengganti
   `count()+1` dari sisi aplikasi yang rawan race). Wajib ada SEBELUM
   deploy kode aplikasi terbaru (approval actions memanggil RPC-nya).
   Aman dijalankan ulang.
6. `schema_jsa_step_kebutuhan.sql` — kolom `jsa_steps.kebutuhan` (JSONB,
   default `{}`) untuk kebutuhan sumber daya per langkah JSA (asal prosedur
   kerja, dipakai prefill PTW). Additive — aman dijalankan ulang.
7. `schema_announcements_and_audit_photos.sql` — membuat tabel
   `announcements` (konten carousel Pengumuman di halaman utama) dan
   `inspection_photos` (multi-foto untuk laporan Inspeksi Temuan). **Wajib
   ada SEBELUM deploy kode aplikasi terbaru** — `getInspections()` dan
   `getVendorInspections()` sekarang melakukan `.select()` dengan join ke
   `inspection_photos`; tanpa migrasi ini PostgREST akan menolak seluruh
   `select` tersebut (relationship belum ada di schema cache) sehingga
   daftar Inspeksi Temuan tampil kosong di dashboard internal maupun
   vendor. Aman dijalankan ulang (memakai `CREATE TABLE IF NOT EXISTS` +
   `DROP POLICY IF EXISTS` di seluruh file).
8. `schema_profile_jabatan.sql` — kolom `profiles.jabatan` (TEXT, nullable)
   untuk jabatan/posisi bebas isian per akun, ditampilkan berdampingan
   dengan nama di Riwayat Dokumen dan timeline approval. Additive, aman
   dijalankan ulang (`ADD COLUMN IF NOT EXISTS`). Sudah diterapkan di
   project Supabase live lewat MCP pada 2026-10-05.
9. `schema_activity_log.sql` — tabel `activity_logs` (jejak login/logout dan
   CRUD Master Data) dan `user_presence` (heartbeat pengguna online +
   halaman yang sedang dibuka), untuk halaman Master Data → Log Aktivitas.
   Additive dan tidak bergantung migrasi lain; aman dijalankan ulang
   (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`). Kode aplikasi
   menelan error insert log, jadi deploy sebelum migrasi tidak merusak
   login/CRUD — tapi halaman Log Aktivitas akan kosong sampai file ini
   dijalankan. Sudah diterapkan di project Supabase live lewat MCP pada
   2026-10-10.

# Urutan Migrasi Fase 2 — Per-Project Approver Assignment

> **Mau sekali paste-jalankan saja?** Pakai
> `supabase/RUN_ALL_migrations_2026-08-30.sql` — gabungan Fase 1 + Fase 2
> **+ Fase 3** jadi satu file (Fase 3 ditambahkan belakangan sebagai
> Transaksi 5 di file yang sama, nama file tetap dipertahankan). Bagian
> di bawah ini tetap berguna sebagai referensi.

Jalankan di Supabase SQL editor, SATU PER SATU, setelah semua migrasi
Fase 1 (`supabase/README_org_migration_order.md`) sudah dijalankan:

1. `schema_stage_assignments.sql`
2. `schema_stage_assignment_permissions.sql`

Lanjut ke migrasi Fase 3 di bagian bawah dokumen ini setelah keduanya
selesai dan checklist verifikasi manual Fase 2 (di bawah) sudah dijalankan.

## ⚠️ WAJIB DIBACA SEBELUM CUTOVER — semua dokumen berjalan langsung macet

Begitu `schema_stage_assignments.sql` dijalankan, **SELURUH Prosedur/JSA/PTW
yang sedang berjalan di semua proyek yang sudah ada langsung tidak bisa
di-approve** sampai admin membuka proyeknya dan mengisi assignment untuk tahap
yang sedang ditunggu.

Penyebabnya: sejak Fase 2, `approveProcedure`/`approveJsa`/`approvePtw` tidak
lagi bertanya "apakah Anda punya permission tahap ini", melainkan "apakah ada
baris `stage_assignments` berstatus `pending` atas nama Anda untuk (proyek,
doc_type, stage_key) ini". Tabelnya kosong tepat setelah migrasi, jadi jawaban
untuk semua orang adalah "tidak". Ini **perilaku fail-closed yang memang
disengaja** (lebih baik macet daripada siapa pun bisa approve), bukan bug —
tapi gejala pertama yang dilihat operator adalah approver kebingungan menerima
error "Anda tidak ditugaskan untuk tahap ini pada proyek ini."

Karena itu, sebagai langkah **pra-cutover atau segera setelah cutover** (jangan
ditunda):

- [ ] Daftar semua proyek aktif beserta tahap yang sedang ditunggu, mis.:

      ```sql
      SELECT p.id, p.name, 'procedure' AS doc, pr.status
        FROM projects p JOIN procedures pr ON pr.project_id = p.id
       WHERE pr.status NOT IN ('Draft', 'Disetujui')
      UNION ALL
      SELECT p.id, p.name, 'jsa', j.status
        FROM projects p JOIN jsa j ON j.project_id = p.id
       WHERE j.status NOT IN ('Draft', 'Disetujui')
      UNION ALL
      SELECT p.id, p.name, 'ptw', t.status
        FROM projects p JOIN ptw t ON t.project_id = p.id
       WHERE t.status NOT IN ('Draft', 'Aktif', 'Expired', 'Selesai');
      ```

      (Sesuaikan nilai status dengan konstanta di `lib/procedure-status.ts`,
      `lib/jsa-status.ts`, dan `lib/ptw-status.ts` — daftar di atas hanya
      ancar-ancar.)
- [ ] Untuk tiap proyek pada daftar itu: admin PGN membuka
      `/dashboard/master-data/project/{id}` dan mengisi 5 slot PGN; admin PGSOL
      membuka `/pgsol/dashboard/projects/{id}/assign` dan mengisi slot
      `jsa.review_pgsol`. Minimal isi tahap yang sedang ditunggu **sekarang**;
      sisanya boleh menyusul sebelum dokumen sampai ke sana.
- [ ] Umumkan ke approver bahwa daftar tugas mereka akan menyusut: mulai
      sekarang mereka hanya melihat proyek yang menugaskan mereka secara
      eksplisit, bukan semua proyek yang cocok dengan permission mereka.

## Keterbatasan yang diketahui — dua dokumen sejenis pada satu proyek

`stage_assignments` belum menyimpan identitas dokumen: kuncinya hanya
`(project_id, doc_type, stage_key, assignee_id)`. Artinya semua dokumen dengan
`doc_type` yang sama pada satu proyek **berbagi baris assignment yang sama**.

Saat ini hal itu hanya bisa terjadi pada PTW (satu proyek boleh punya beberapa
`ptw_type`; Prosedur dan JSA masing-masing satu per proyek). Konsekuensinya:

- **Berurutan — aman.** Tipe PTW kedua diajukan setelah tipe pertama selesai
  (atau ditolak) di suatu tahap: `savePtw` mereset baris `ptw.approve_pm` ke
  `pending`, jadi ronde baru dimulai bersih.
- **Tumpang tindih — belum benar.** Kalau tipe PTW kedua diajukan saat tipe
  pertama MASIH mengambang di tahap yang sama, reset itu menghapus keputusan
  yang sudah tercatat untuk tipe pertama, dan approval berikutnya dinilai
  terhadap kumpulan baris yang sama untuk kedua dokumen.

Perbaikan penuhnya butuh perubahan skema (menambahkan kolom identitas dokumen
ke `stage_assignments` dan memasukkannya ke UNIQUE constraint serta ke semua
query di `lib/stage-assignments.ts`) — **di luar cakupan Fase 2**. Sampai itu
dikerjakan, ajukan tipe-tipe PTW pada satu proyek secara berurutan, bukan
serentak.

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

---

# Urutan Migrasi Fase 3 — Vendor Internal Review Stage

Jalankan di Supabase SQL editor, SATU PER SATU, setelah semua migrasi
Fase 1 + Fase 2 di atas (dan checklist verifikasi manual Fase 2) sudah
selesai:

1. `schema_stage_assignments_vendor_review.sql`
2. `schema_vendor_review_permissions.sql`

Tidak ada perubahan enum di kedua file ini, jadi tidak perlu urutan
BEGIN/COMMIT khusus seperti Fase 1 — bisa langsung paste keduanya
berurutan, atau pakai `RUN_ALL_migrations_2026-08-30.sql` yang sudah
menyertakan keduanya di Transaksi 5.

## ⚠️ Cutover Fase 3 — sama pola fail-closed dengan Fase 2, tapi lingkupnya beda

`schema_stage_assignments_vendor_review.sql` HANYA menambah satu policy
baru (izin tulis untuk vendor pada 3 `stage_key` barunya) — tidak
mengosongkan atau mereset baris apa pun di `stage_assignments`. Jadi
proyek yang sudah lewat tahap `Draft` sebelum migrasi ini tetap jalan
seperti biasa, tidak macet.

Yang fail-closed adalah alur **submit baru**: begitu kode aplikasi (sudah
di-deploy sebelum atau bersamaan dengan migrasi ini) mengarahkan submit
Prosedur/JSA/PTW ke status `Review Internal Vendor`, dokumen itu macet di
situ sampai admin vendor mengisi assignment 3 slot barunya
(`procedure.review_vendor` / `jsa.review_vendor` / `ptw.review_vendor`)
untuk proyek yang bersangkutan — sama seperti pola Fase 2, tapi sekarang
tanggung jawabnya ada di admin vendor, bukan admin PGN/PGSOL.

- [ ] Sebelum atau segera setelah deploy: umumkan ke seluruh vendor_admin
      bahwa mereka perlu membuka tab "Assignment Reviewer" di setiap
      proyek aktif (`/vendor/dashboard/projects/{id}`) dan menunjuk
      minimal satu reviewer per jenis dokumen yang masih akan diajukan.
      Berkat migrasi grant permission (`schema_vendor_review_permissions.sql`),
      `vendor_admin` sendiri otomatis jadi kandidat reviewer default —
      perusahaan dengan satu admin saja tetap bisa langsung pakai fitur
      ini tanpa setup role tambahan.

## Verifikasi manual — Fase 3

- [ ] Sebagai vendor_admin, assign 2 staff ke slot `procedure.review_vendor`
      sebuah proyek. Ajukan Prosedur Kerja sebagai vendor — status harus
      `Review Internal Vendor` (BUKAN langsung `Menunggu Review PM`), dan
      kedua staff yang ditugaskan harus melihat item "Review Internal —
      Prosedur Kerja" di `/vendor/dashboard/my-task`.
- [ ] Approve sebagai reviewer pertama — status harus TETAP di
      `Review Internal Vendor`. Approve sebagai reviewer kedua — status
      harus maju ke `Menunggu Review PM`, dan PM (sisi internal) baru
      SEKARANG melihat dokumennya di `/dashboard/approval` — tidak
      sebelum kedua reviewer vendor selesai.
- [ ] Reject sebagai salah satu dari 2 reviewer yang ditugaskan, dengan
      catatan — status harus balik ke `Draft`, catatan revisi tercatat,
      dan KEDUA baris assignment `procedure.review_vendor` untuk proyek
      itu harus kembali ke `pending` saat vendor mengajukan ulang (bukan
      cuma baris milik yang menolak). Konfirmasi PGSOL/PGN TIDAK menerima
      notifikasi apa pun untuk siklus reject ini.
- [ ] Proyek dengan 0 orang ditugaskan ke `jsa.review_vendor` — ajukan
      JSA, pastikan tidak ada yang bisa approve sama sekali (tombol
      Approve/Reject tidak tampil untuk siapa pun karena tidak ada baris
      assignment `pending` atas nama siapa pun).
- [ ] Konfirmasi status `Review Internal Vendor` TIDAK PERNAH muncul di
      `/dashboard/my-task` (task list internal PGN/PGSOL) untuk ketiga
      jenis dokumen — tahap ini murni urusan internal vendor.
- [ ] Login sebagai vendor_admin baru (belum pernah setup role custom)
      di perusahaan yang baru mendaftar setelah migrasi — konfirmasi dia
      langsung muncul sebagai kandidat di ketiga slot
      `*.review_vendor` tanpa perlu ke halaman Role & Permission dulu.

---

# Urutan Migrasi Fase 3.1 — Gerbang PGSOL untuk Prosedur Kerja

Jalankan setelah semua migrasi Fase 1, Fase 2, dan Fase 3 di atas sudah
selesai:

1. `schema_procedure_pgsol_permission.sql`

Tidak ada perubahan enum atau RLS di file ini — bisa langsung paste, atau
pakai `RUN_ALL_migrations_2026-08-30.sql` yang sudah menyertakannya di
Transaksi 6.

## ⚠️ Cutover — pola fail-closed yang sama, lingkup lebih sempit lagi

File ini HANYA menambah permission `procedure.review_pgsol` ke role
`pgsol_reviewer` — tidak mengosongkan atau mereset baris apa pun. Migrasi
ini murni aditif dan inert tanpa kode aplikasinya (cuma memberi permission
yang belum dipakai jalur kode manapun), jadi menjalankannya lebih awal
tidak berbahaya. Yang justru berbahaya adalah urutan sebaliknya: deploy
kode aplikasi SEBELUM migrasi ini berarti Prosedur Kerja baru bisa
mencapai status `Review PGSOL` sementara belum ada satu pun role yang
memegang permission `procedure.review_pgsol` — `getEligibleAssignees`
akan mengembalikan daftar kosong dan admin PGSOL tidak bisa menugaskan
siapa pun, sehingga dokumen macet tanpa jalan keluar. **Migrasi ini WAJIB
dijalankan SEBELUM (atau paling lambat bersamaan dengan, tapi tidak
pernah SESUDAH) deploy kode aplikasi** — begitu kode aplikasi ter-deploy
dan mengarahkan Prosedur Kerja ke status `Review PGSOL`, dokumen itu macet
di situ sampai admin PGSOL mengisi assignment `procedure.review_pgsol`
untuk proyek yang bersangkutan.

- [ ] Sebelum atau segera setelah deploy: umumkan ke admin PGSOL bahwa
      halaman `/pgsol/dashboard/projects/{id}/assign` sekarang punya dua
      panel assignment (Prosedur Kerja dan JSA), dan Prosedur Kerja proyek
      aktif butuh diisi sebelum vendor bisa lanjut ke tahap PM.

## Verifikasi manual — Fase 3.1

- [ ] Assign 2 PGSOL reviewer ke `procedure.review_pgsol` sebuah proyek.
      Ajukan Prosedur Kerja sebagai vendor — status harus `Review PGSOL`
      (bukan langsung `Menunggu Review PM`).
- [ ] Approve sebagai reviewer pertama — status tetap `Review PGSOL`.
      Approve sebagai reviewer kedua — status maju ke `Menunggu Review PM`,
      dan PM (sisi PGN) baru sekarang melihat dokumennya.
- [ ] Reject JSA sebagai reviewer PGSOL atau PGN — pastikan status balik ke
      `Draft` (BUKAN `Review PGSOL`), dan submit ulang sebagai vendor benar
      memicu `Review Internal Vendor` lagi sebelum PGSOL melihatnya.
- [ ] Login sebagai pemegang `jsa.review_pgsol` yang TIDAK ditugaskan ke
      suatu proyek — buka proyek itu, kartu approval Prosedur/JSA tetap
      terlihat (transparansi) tapi tombol Setujui/Tolak tidak muncul, dan
      ada indikator "N dari M sudah menyetujui".
- [ ] `/dashboard/my-task` untuk reviewer PGSOL menampilkan tugas Prosedur
      Kerja hanya selagi benar ditugaskan dengan baris pending — tidak ada
      entri phantom selagi dokumen masih `Draft`.

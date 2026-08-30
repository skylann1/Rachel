# Urutan Migrasi Fase 2 — Per-Project Approver Assignment

Jalankan di Supabase SQL editor, SATU PER SATU, setelah semua migrasi
Fase 1 (`supabase/README_org_migration_order.md`) sudah dijalankan:

1. `schema_stage_assignments.sql`
2. `schema_stage_assignment_permissions.sql`

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

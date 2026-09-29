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

---

# Urutan Migrasi — Gerbang HSE PGSOL (Prosedur/JSA/PTW) + Gerbang PGSOL untuk PTW

Jalankan setelah semua migrasi di atas (Fase 1 s/d Fase 3.1) sudah selesai:

1. `schema_ptw_pgsol_gate_vendor_policy.sql`

Tidak ada file migrasi lain untuk fase ini — status/stage-key baru
(`procedure.hse_pgsol`, `jsa.hse_pgsol`, `ptw.review_pgsol`, `ptw.hse_pgsol`)
murni kode aplikasi, `stage_key`/`doc_type`/`status` adalah kolom TEXT polos
tanpa constraint. Permission `hse_pgsol`/`review_pgsol` yang baru TIDAK
di-auto-grant ke role manapun (keputusan sadar) — PGSOL admin harus membuat
atau mengedit role lewat halaman Role & Permission sendiri.

## ⚠️ Cutover — dua risiko fail-closed berbeda arah

**1. Migrasi RLS di atas WAJIB dijalankan SEBELUM (atau paling lambat
bersamaan dengan, tidak pernah SESUDAH) deploy kode aplikasi.** Tanpanya,
setiap PTW yang vendor selesaikan review internalnya akan diam-diam gagal
pindah status sama sekali (RLS menolak UPDATE-nya tanpa error eksplisit di
UI) — PTW itu macet permanen di `Review Internal Vendor`.

**2. Setiap Prosedur Kerja/JSA/PTW yang mencapai status `Review PGSOL` atau
`Review HSE PGSOL` akan macet sampai admin PGSOL:**
   - membuat/mengedit role dan mencentang permission `hse_pgsol` (Prosedur
     & JSA) dan `review_pgsol`+`hse_pgsol` (PTW) lewat halaman Role &
     Permission,
   - lalu mengisi 6 slot assignment (Reviewer + HSE, untuk masing-masing
     Prosedur Kerja, JSA, PTW) di `/pgsol/dashboard/projects/{id}/assign`
     per proyek yang sedang berjalan.

Tidak ada auto-grant untuk permission baru ini (beda dari Fase 3.1 yang
langsung menggrant `procedure.review_pgsol` ke role `pgsol_reviewer`) —
ini keputusan sadar, bukan celah yang terlewat.

- [ ] Sebelum atau segera setelah deploy: umumkan ke admin PGSOL bahwa
      halaman assign sekarang punya 6 slot (Reviewer + HSE untuk Prosedur
      Kerja/JSA/PTW), dan proyek yang sedang berjalan butuh diisi ulang.

## Verifikasi manual

- [ ] Ajukan PTW baru sebagai vendor sampai tahap Review Internal Vendor,
      lalu approve sebagai reviewer internal vendor — status harus maju ke
      `Review PGSOL` (BUKAN gagal diam-diam, BUKAN langsung ke
      `Menunggu Approval PM`).
- [ ] Assign seorang PGSOL Reviewer ke `ptw.review_pgsol` dan seorang PGSOL
      HSE ke `ptw.hse_pgsol` untuk proyek itu. Approve sebagai Reviewer —
      status maju ke `Review HSE PGSOL`. Approve sebagai HSE — status maju
      ke `Menunggu Approval PM`, alur PM/Issuer/Penomoran HSSE yang sudah
      ada berjalan seperti biasa dari situ.
- [ ] Reject JSA di tahap `Review HSE PGSOL` — pastikan status balik ke
      `Draft`, dan baris assignment `jsa.review_pgsol` ikut ter-reset ke
      `pending` (query `stage_assignments` langsung, atau ajukan ulang dan
      pastikan Reviewer PGSOL diminta review lagi, bukan langsung lompat
      ke HSE).

---

# Fix — RLS UPDATE vendor untuk Prosedur Kerja & JSA tidak punya whitelist status

`schema_procedure_jsa_vendor_update_policy.sql` (dijalankan langsung, di
luar urutan fase — ditemukan saat audit RLS Prosedur Kerja setelah
`schema_ptw_pgsol_gate_vendor_policy.sql` di atas). Policy vendor UPDATE
lama untuk `procedures`/`jsa` (`schema_update_rls_policies.sql`) cuma cek
kepemilikan proyek, TANPA `WITH CHECK` sama sekali — secara teori vendor
bisa memanggil Supabase client langsung dan menyetel `status` proyek
mereka sendiri ke nilai apa pun, termasuk lompat langsung ke "Disetujui",
melewati semua tahap review. Kode aplikasi tidak pernah melakukan ini,
tapi RLS harus menegakkannya sendiri, bukan cuma dipercayakan ke kode.

Sudah dijalankan ke Supabase live dan diverifikasi lewat `pg_policies`.
Vendor sekarang hanya boleh UPDATE baris yang masih `Draft`/`Review
Internal Vendor`, dan hasil akhirnya dibatasi ke `Draft`/`Review Internal
Vendor`/`Review PGSOL` — persis set status yang sudah dipakai
`saveProsedur`/`saveJsa` dan `approveVendorInternalReview`/
`rejectVendorInternalReview`. Policy UPDATE milik internal PGN/PGSOL
(`Internal users can update all procedures/jsa`) SENGAJA tidak disentuh —
tahapnya dinamis lewat `roles.permissions` + `stage_assignments`, bukan
celah yang lupa ditutup seperti punya vendor.

---

# Kolom `jsa_steps.kebutuhan` — dijalankan 2026-09-29

`schema_jsa_step_kebutuhan.sql` (di luar urutan fase). Ditemukan saat audit
DB live: berkas migrasinya sudah ada di repo sejak fitur kebutuhan
2026-09-23, tapi **belum pernah dijalankan ke Supabase**, sehingga
`jsa_steps` tidak punya kolom `kebutuhan` sama sekali. Akibatnya seluruh
rantai prosedur → JSA → PTW (termasuk fitur sumber bahaya 2026-09-28 yang
dibangun di atasnya) tidak bisa menyimpan apa pun.

Sudah dijalankan ke Supabase live dan diverifikasi lewat
`information_schema.columns`. Migrasinya aditif dan idempotent
(`ADD COLUMN IF NOT EXISTS`), baris lama bernilai `{}` — dan itu memang yang
diandalkan `hasStoredKebutuhan()` sebagai penanda "belum pernah disimpan",
sehingga langkah JSA lama disemai ulang dari prosedur, bukan dianggap
sengaja dikosongkan.

---

# Penomoran PTW macet karena RLS — diperbaiki 2026-09-29

`schema_ptw_numbering_security_definer.sql` (di luar urutan fase). Ditemukan
saat audit DB live yang sama.

`ptw_numbering` punya RLS aktif dengan **nol policy** (Supabase meng-enable
RLS otomatis pada tabel baru; `schema_ptw_numbering.sql` tidak pernah membuat
policy), sementara `get_next_ptw_number()` dibuat SECURITY INVOKER dan
dipanggil lewat `supabase.rpc()` dengan klien yang terikat RLS
(`app/dashboard/approval/actions.ts:636`). INSERT/UPDATE counter di dalam
fungsi itu karenanya selalu ditolak untuk user biasa, dan tahap
`Menunggu Penomoran HSSE` — langkah TERAKHIR sebelum PTW Aktif — gagal. Efek
praktisnya: tidak ada PTW yang bisa terbit sama sekali.

Perbaikannya menjadikan fungsi itu SECURITY DEFINER dengan `search_path`
dipatok, pola yang sama dengan `public.update_ptw_safety_checklist()`.
Tabel `ptw_numbering` SENGAJA tetap tanpa policy — satu-satunya jalan masuk ke
counter adalah fungsi ini. Ditambah dua pengetatan: pengecekan
`is_internal_user()` di dalam fungsi (penomoran murni urusan internal PGN;
tanpa ini SECURITY DEFINER memungkinkan siapa pun yang login membakar nomor
PTW sehingga deretnya berlubang), dan EXECUTE dicabut dari `anon`.

Sudah dijalankan ke Supabase live dan diverifikasi: `prosecdef = true`,
`proconfig = {search_path=public}`, `anon` EXECUTE = false, `authenticated`
EXECUTE = true, dan counter tidak bergerak (tetap 4) saat verifikasi.

# Penyelesaian PTW & Penyelesaian Proyek — Design

Status: DRAFT, menunggu persetujuan. Belum ada kode.

## Masalah
- PTW berhenti di `PTW Aktif` / `Expired` / `Dihentikan (SWA)`. Tidak ada langkah "pekerjaan selesai, izin ditutup" (`lib/ptw-status.ts`). QR check-in dan daily check tetap hidup sampai izin lewat tanggal.
- Proyek sudah punya status `Selesai` (arsip, filter, `getProjectStage`), tapi satu-satunya jalan adalah admin mengganti dropdown status di edit proyek, tanpa syarat apa pun.

## Bagian 1 — Penutupan PTW

### Alur
`PTW Aktif` (atau `Expired`) -> vendor/pemegang mengajukan penutupan -> `Penutupan Diajukan` -> verifikasi HSSE -> `Selesai`.
Ditolak verifikator: kembali ke status sebelumnya (`PTW Aktif`/`Expired`) dengan catatan; pemegang memperbaiki lalu ajukan ulang.

- Penutupan boleh untuk PTW yang sudah `Expired` (izin lewat tanggal tapi pekerjaan belum resmi ditutup).
- `Dihentikan (SWA)` tidak bisa ditutup langsung; harus di-resume dulu (`resumePtw`) atau dibatalkan lewat jalur yang ada.

### Form penutupan (diisi pemegang)
Checklist: pekerjaan selesai, area dibersihkan/housekeeping, peralatan & material dikeluarkan, tidak ada sumber energi/bahaya tersisa, semua pekerja sudah check-out. Plus catatan wajib dan tanggal-jam selesai.

### Syarat sistem (fail-closed)
- Tidak ada `site_checkins` terbuka (belum check-out) pada PTW itu.
- Tidak ada penutupan lain yang sedang menunggu pada PTW yang sama.

### Setelah `Selesai`
- QR check-in/toolbox/daily check untuk PTW itu ditolak.
- Tidak dihitung "Aktif" di kartu proyek, banner jatuh tempo, atau sidebar badge.
- Tidak bisa di-rollback (`rollbackStage` sudah menolak status final; tambahkan `Selesai` ke daftar final).
- PDF PTW dapat cap "CLOSED" + data penutupan; tercatat di `document_logs`.

### Data
Migrasi baru `supabase/schema_ptw_closure.sql` (+ catatan di README migration order):
`ptw.closure_requested_at`, `closure_requested_by`, `closure_checklist jsonb`, `closure_note`, `closed_at`, `closed_by`. `ptw.status` bertipe teks sehingga cukup dua nilai baru: `Penutupan Diajukan`, `Selesai`. Policy RLS update vendor harus mengizinkan transisi `Aktif/Expired -> Penutupan Diajukan` saja.

### Kode
- `lib/ptw-status.ts`: dua status baru, `PTW_CLOSURE_*` helper, `ptwStageIndex` mengenali keduanya.
- `lib/stage-assignments.ts`: slot baru `ptw.closure` (stage_key + permission `ptw.verify_closure`, `allowedTypes` mengikuti `numbering_hsse`). Approve butuh baris `stage_assignments` pending, sama seperti tahap lain.
- Role constants: permission `ptw.request_closure` (pemegang vendor) dan `ptw.verify_closure`.
- Action baru: `requestPtwClosure`, `approvePtwClosure`, `rejectPtwClosure`.
- UI: tombol "Ajukan Penutupan" di tab Dokumen K3 vendor; kartu tugas di halaman approval internal; badge status di semua tempat yang menampilkan status PTW.

## Bagian 2 — Penyelesaian Proyek

### Alur
Semua PTW proyek `Selesai` -> vendor menekan "Ajukan Penyelesaian Proyek" -> internal memverifikasi -> `projects.status = 'Selesai'` + `completed_at`.

### Syarat sistem (fail-closed)
- Tidak ada PTW berstatus `PTW Aktif`/`Penutupan Diajukan`/`Dihentikan (SWA)`. PTW `Expired` yang belum ditutup juga memblokir (harus ditutup dulu).
- Tidak ada Inspeksi Temuan terbuka untuk proyek itu.
- Tidak ada check-in terbuka.
- Prosedur/JSA tidak sedang menunggu review.

### Data
Migrasi `supabase/schema_project_completion.sql`: `projects.completion_requested_at`, `completion_requested_by`, `completion_note`, `completed_at`, `completed_by`. Sengaja TIDAK menambah nilai enum `project_status` (butuh transaksi sendiri dan berisiko); keadaan "diajukan" dibaca dari `completion_requested_at IS NOT NULL AND status <> 'Selesai'`. Perlu dicek apakah `project_status` masih enum di DB produksi sebelum menulis migrasi.

### Kode
- Slot assignment `project.completion` (permission `project.verify_completion`).
- Action: `requestProjectCompletion`, `approveProjectCompletion`, `rejectProjectCompletion`.
- Dropdown status di `master-data/project/[id]/page.tsx`: opsi `Selesai` dibuang; penyelesaian hanya lewat alur ini (admin override tetap bisa lewat izin terpisah bila diminta).
- `getProjectStage` menambah keadaan "Penyelesaian diajukan"; proyek `Selesai` otomatis masuk Arsip (sudah ada).
- Banner di ringkasan vendor: "Semua PTW sudah ditutup — ajukan penyelesaian proyek".

## Di luar cakupan
- Perpanjangan PTW (mengubah `valid_to` PTW yang sudah aktif). Akan dibuat sebagai fitur terpisah setelah ini; penutupan tidak bergantung padanya.
- Migrasi data lama: PTW `Aktif`/`Expired` yang sudah ada tetap apa adanya sampai ditutup manual.

## Urutan kerja
1. Migrasi + README order -> 2. `lib/` status & stage-assignments & permissions -> 3. server actions penutupan PTW -> 4. UI vendor + internal PTW -> 5. blokir QR/daily check untuk PTW `Selesai` -> 6. proyek: migrasi, actions, UI -> 7. `tsc` + `lint` + `build`.
Tiap migrasi dijalankan manual di Supabase SQL editor sebelum kode dideploy.

## Keputusan yang perlu dikonfirmasi
1. Verifikator penutupan PTW: HSSE (usulan) atau PGSOL dulu baru HSSE?
2. Verifikator penyelesaian proyek: PM PGN (usulan) atau cukup PGSOL?
3. Proyek boleh diselesaikan jika ada Inspeksi Temuan terbuka? (usulan: tidak)

## Keputusan final (diimplementasi)
- Form penutupan diisi vendor (checklist wajib semua, waktu selesai, catatan), baru diverifikasi. Syarat sistem: tidak ada check-in terbuka.
- Verifikator penutupan PTW = HSSE yang ditugaskan di tahap `ptw.numbering_hsse` proyek itu (+ permission `ptw.verify_closure`). Tidak ada slot assignment baru.
- Penyelesaian proyek: vendor mengajukan (semua PTW `Selesai`, tidak ada Inspeksi Temuan non-`Closed`), diverifikasi PM yang ditugaskan di `ptw.approve_pm` (+ `ptw.verify_project_completion`). Syarat dicek ulang saat disetujui.
- Transisi status lewat RPC `SECURITY DEFINER`; policy RLS vendor tidak diubah. Tidak ada penambahan nilai enum.
- Nomor PTW kini diinput manual HSSE di tahap Penomoran (unik, maks 60 karakter).
- Role siap pakai: `vendor_pemegang_ptw` (vendor) dan `pgn_pengawas_ptw` (PGN).
- Opsi "Selesai" dihapus dari daftar status edit proyek.

## Perpanjangan PTW (diimplementasi)
- Vendor mengajukan tanggal berlaku baru + alasan selagi PTW `PTW Aktif` dan belum lewat `valid_to`. PTW tetap Aktif selama menunggu.
- Total masa berlaku tetap maksimal 7 hari sejak `valid_from` (kolom Hari ke-1..7 pada form dan daily check). Lebih dari itu bukan perpanjangan.
- Verifikator: HSSE yang ditugaskan di `ptw.numbering_hsse` + permission `ptw.verify_extension`. Disetujui -> `valid_to` diganti dan `extension_count` +1; ditolak -> catatan ke vendor.
- Migrasi: `supabase/schema_ptw_extension.sql`. Aksi: `requestPtwExtension` / `decidePtwExtension` di `completion-actions.ts`.
- Batasan: PTW `Expired` tidak bisa diperpanjang (harus ditutup). Satu PTW per (proyek, tipe) masih berlaku, jadi PTW tipe sama tidak bisa diterbitkan ulang setelah ditutup.

## Perpanjangan PTW — revisi (multi-lembar)
- Perpanjangan tetap pada PTW yang SAMA (bukan PTW baru). Tiap pengajuan menambah maksimal 7 hari dari `valid_to` saat ini dan boleh diajukan berulang selagi PTW Aktif.
- Satu lembar formulir = 7 hari. Hari ke-8 dst dicatat di tab Daily Check / Safety Check (kolom hari bertanda "Lembar N") dan dicetak sebagai **lembar lanjutan** pada PDF yang sama (`PtwPDF.tsx`, satu `<Page>` per 7 hari, judul "LEMBAR LANJUTAN", keterangan "halaman X dari N").
- Batas teknis 366 hari (`PTW_TRACK_MAX_DAYS`); penerbitan awal tetap maksimal 7 hari (`PTW_MAX_VALID_DAYS`).
- Migrasi: `supabase/schema_ptw_extension_multi_sheet.sql`. Menggantikan batas "total 7 hari" di bagian "Perpanjangan PTW (diimplementasi)".

# PTW Field Roles (Pemegang & Pengawas) + Daily Check

Date: 2026-10-18

## Problem

Form PTW asli punya kotak **Verifikasi** (Hari ke-1..7): baris Tanggal, Waktu, dan
dua baris paraf — *Pemegang PTW* (vendor, di lokasi kerja) dan *Pengawas /
Penerbit PTW* (PGN). Di aplikasi kotak ini hanya tata letak kosong di
`components/ptw/PtwPDF.tsx`. Belum ada: siapa Pemegang/Pengawas sebuah PTW,
cara mereka memverifikasi tiap hari, maupun penggantian orang di tengah masa
berlaku (maks. `PTW_MAX_VALID_DAYS` = 7 hari).

## Decisions (from brainstorming)

- Pemegang = akun **staf vendor yang sudah ada** (org yang sama) dengan role baru
  berakses terbatas. Pekerja tanpa akun tidak termasuk cakupan.
- Pengawas = akun internal **PGN** yang ditugaskan admin PGN **per PTW**.
- Hanya **satu** orang aktif per peran per PTW; pergantian = *switch* dengan riwayat.
- Pemegang: verifikasi/paraf harian + **uraian singkat pekerjaan hari itu**.
- Pengawas: mengisi **safety checklist** hari itu (fitur yang sudah ada) + paraf.
- Penugasan dibuat saat PTW berstatus **PTW Aktif**.
- Pendekatan data: dua tabel baru kunci per PTW (bukan `stage_assignments`, yang
  per proyek+tipe dokumen dan bentrok antar-PTW sejenis; bukan JSONB di `ptw`).

## Data model — `supabase/schema_ptw_field_assignments.sql`

`ptw_field_assignments`
- `id`, `ptw_id` (FK `ptw`), `peran` (`pemegang` | `pengawas`), `user_id`
  (FK `profiles`), `aktif_dari` (default `now()`), `aktif_sampai` (NULL = aktif),
  `ditugaskan_oleh`, `alasan` (opsional, diisi saat switch).
- Unique index parsial `(ptw_id, peran) WHERE aktif_sampai IS NULL`.

`ptw_daily_checks`
- `id`, `ptw_id`, `hari_ke` (1..7), `tanggal`, `peran`, `user_id` (yang benar-benar
  mengisi), `diisi_pada` (waktu server), `inisial`, `uraian_pekerjaan`
  (wajib untuk `pemegang`, NULL untuk `pengawas`).
- Unique `(ptw_id, hari_ke, peran)`. Tidak ada UPDATE/DELETE untuk user (terkunci).

RPC `ptw_switch_field_assignment(ptw_id, peran, user_baru, alasan)`: atomik —
menutup baris aktif (`aktif_sampai = now()`) dan membuat baris baru dalam satu
transaksi; juga dipakai untuk penugasan pertama (tidak ada baris lama).

RLS mengikuti pola `current_vendor_org_id()` / `is_internal_user()`: vendor hanya
melihat/menulis penugasan & check milik PTW organisasinya; internal melihat semua.
Penulisan lewat server action + RPC `SECURITY DEFINER` yang memeriksa permission
dan org/type pemanggil.

Migrasi manual; tambahkan catatan urutan di
`supabase/README_org_migration_order.md`.

## Permissions & role

Modul `ptw` di `app/dashboard/master-data/role/constants.ts` **dan** salinan vendor
`app/vendor/dashboard/role/constants.ts` (belum disatukan):

| Key | allowedTypes | Fungsi |
|---|---|---|
| `field_pengawas` | `pgn` | Boleh ditugaskan sebagai Pengawas |
| `assign_pengawas` | `pgn` | Menugaskan / mengganti Pengawas |
| `field_holder` | `vendor` | Boleh ditugaskan sebagai Pemegang |
| `assign_holder` | `vendor` | Menugaskan / mengganti Pemegang |

Role "Pemegang PTW" dibuat vendor lewat UI Role (data-driven): `field_holder`,
baca-saja `ptw.view`, `incident.view`, view Data Pekerja/Peralatan/Material/
Proyek, dan My Task. Tanpa permission buat/edit/approve.

**Fail-closed:** permission membuka fitur, penugasan aktif membuka tindakan.
- Daily check Pemegang hanya jika ada baris `ptw_field_assignments` aktif
  atas nama user itu.
- Safety checklist: untuk PTW yang **sudah punya Pengawas aktif**, hanya Pengawas
  aktif yang boleh mengisi. PTW tanpa penugasan tetap memakai perilaku saat ini
  (`ptw.edit_safety_checklist`) agar data berjalan tidak terkunci.
- Penugasan/switch: hanya status `PTW Aktif`; setelah `Expired` / `Dihentikan
  (SWA)` penugasan tidak bisa diubah dan daily check baca-saja.

## Daily check flow

- "Hari ini" = `todayDateString()` (WIB); `hari_ke` dihitung dari `valid_from`;
  hanya hari dalam masa berlaku dan hanya **hari ini** (tanpa isi mundur).
- Pemegang: isi uraian pekerjaan hari ini (wajib) → **Verifikasi**. Inisial dari
  nama user, waktu dari server. Terkunci setelah kirim.
- Pengawas: isi safety checklist hari itu → **Paraf hari ini**; paraf hanya bisa
  dikirim bila semua baris checklist hari itu sudah dijawab (Sudah/Belum).
- Pergantian di tengah hari: bila orang lama sudah check, orang baru tidak
  mengulang; bila belum, orang baru berhak.
- Tidak mengganti QR Check-in (`/checkin/[token]`, tanpa login, toolbox meeting).

## My Task & notifications

- Penjabat aktif (Pemegang/Pengawas) pada PTW Aktif yang belum check hari ini
  mendapat item "Daily check PTW" di My Task (vendor & internal) + hitungan di
  badge sidebar (`sidebar-badges.ts`). Hilang setelah check.
- Hari terlewat ditandai **Terlewat** di riwayat; tidak bisa diisi belakangan.
- Orang yang ditugaskan / digantikan dinotifikasi lewat sistem notifikasi yang ada.
- Di luar cakupan awal: push notification terjadwal (butuh cron).

## UI & PDF

- Tab **Daily Check** per PTW di `AdminProjectClient` dan `VendorProjectClient`:
  tabel per hari (Terisi / Terlewat / Mendatang), uraian, pengisi, waktu.
- Panel penugasan: admin PGN → Pengawas, admin vendor → Pemegang; tugaskan,
  switch (alasan opsional), riwayat penjabat.
- `PtwPDF.tsx` kotak Verifikasi diisi dari `ptw_daily_checks`: Tanggal (DD/MM),
  Waktu (waktu verifikasi Pemegang), Nama Inisial, Paraf (✓) untuk kedua baris;
  hari kosong dibiarkan kosong. Uraian harian tidak masuk PDF (form asli tak
  punya tempatnya); opsional nanti sebagai halaman lampiran.

## Out of scope

- Pemegang tanpa akun login; beberapa penjabat aktif sekaligus per peran.
- Tanda tangan gambar; isi mundur hari terlewat; push terjadwal.
- Menyatukan dua salinan `constants.ts` role.

## Verification

Repo tanpa test framework: `npx tsc --noEmit`, `npm run lint`, `npm run build`,
ditambah query SQL untuk aturan DB (unik aktif per peran, RLS lintas org,
atomisitas RPC switch). Migrasi dijalankan manual **sebelum** deploy kode.

## Known limitations

- Penugasan per PTW menghindari bentrokan `stage_assignments`, tetapi PTW lama
  yang berjalan tidak punya penugasan sampai admin menugaskan.

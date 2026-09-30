# News & Pengumuman (carousel) + kategori Audit/Kunjungan pada Inspeksi Temuan — design

## Origin

Permintaan user, 2026-09-30: dua fitur independen dalam satu request.

1. **News/Pengumuman** — konten pengumuman yang muncul sebagai carousel
   di dashboard, baik sisi internal (PGN/PGSOL, `/dashboard`) maupun
   vendor (`/vendor/dashboard`).
2. **Kategori "Audit / Kunjungan"** pada modul Inspeksi Temuan — dipakai
   untuk menyimpan temuan pasca-audit/kunjungan, berisi foto dan
   penjelasan.

Keputusan eksplisit dari user (brainstorming session ini):

- News/Pengumuman dikelola lewat **permission**, bukan hardcode role
  `admin` — `manage` dibatasi `allowedTypes: ['pgn']`, konsisten dengan
  pola `manage_vendor`/`manage_role`/`manage_account` yang sudah ada.
- Konten satu item pengumuman: **gambar + judul + deskripsi panjang**
  (tidak ada field link tujuan).
- Kategori Audit/Kunjungan **reuse** form & tabel `inspections` yang
  sudah ada (bukan alur/halaman terpisah) — cukup satu opsi baru di
  dropdown "Jenis Temuan".
- Multi-foto berlaku untuk **semua** kategori temuan (bukan cuma Audit/
  Kunjungan) — sisi laporan (`image_url`), bukan sisi bukti perbaikan
  vendor (`vendor_evidence_url`, sengaja dibiarkan 1 foto, lihat
  "Scope yang sengaja dikeluarkan" di bawah).
- Carousel pengumuman hanya muncul di **halaman home** masing-masing
  dashboard (`/dashboard` dan `/vendor/dashboard`), bukan di semua
  halaman.

## Temuan yang mendasari desain ini

Disurvei langsung dari kode sebelum desain ditulis:

- Tidak ada precedent carousel/banner/announcement sama sekali di
  codebase ini — ini genuinely subsystem baru.
- `inspections.finding_type` adalah `TEXT NOT NULL` biasa, **tidak**
  di-constraint oleh enum Postgres (`inspection_priority` dan
  `inspection_status` memang enum, `finding_type` bukan) — menambah
  nilai baru ("Audit / Kunjungan") ke dropdown tidak perlu migrasi
  kolom apa pun.
- `inspections` sudah punya `image_url` (foto laporan, 1 field) dan
  `vendor_evidence_url` (foto bukti perbaikan vendor, 1 field
  terpisah) — dua konsep foto yang berbeda tahap dan berbeda pemilik.
- `createInspection` (`app/dashboard/inspection/actions.ts`) **hanya**
  bisa dipanggil dari sisi internal — RLS `inspections` INSERT
  (`schema_inspections_rls.sql`) dibatasi `public.is_internal_user()`,
  dan halaman vendor (`app/vendor/dashboard/inspection/page.tsx`)
  memang tidak punya tombol buat laporan baru, cuma modal "Tindak
  Lanjuti" yang mengisi `vendor_response`/`vendor_evidence_url` lewat
  `submitVendorResponse`. Jadi perubahan form multi-foto hanya
  menyentuh sisi internal (`app/dashboard/inspection/page.tsx`).
- Pola akses master-data yang sudah mapan (account/role, dari
  `2026-09-29-pgsol-dashboard-merge-design.md`): mutasi lewat
  `createAdminClient()` + gate `hasPermissionForUser` di action, RLS di
  tabel sebagai backstop lewat `public.is_internal_user()` /
  `public.current_vendor_org_id()`. Desain ini mengikuti pola yang
  sama, bukan bikin pola baru.
- `allPermissionModules` (`app/dashboard/master-data/role/constants.ts`)
  adalah satu-satunya sumber kebenaran untuk modul+key permission, dan
  otomatis disintesis jadi `fullAccessPermissions()` untuk role
  `admin` (`utils/permissions.ts`) — modul baru `announcement` otomatis
  ikut ter-cover tanpa perubahan lain di `permissions.ts`.
- Kedua dashboard home (`app/dashboard/page.tsx`,
  `app/vendor/dashboard/page.tsx`) adalah server component yang fetch
  data lalu render; layout masing-masing (`app/dashboard/layout.tsx`,
  `app/vendor/dashboard/layout.tsx`) cuma merender `{children}` apa
  adanya — carousel dipasang di level *page*, bukan *layout*, supaya
  hanya tampil di home sesuai keputusan user.

## Bagian 1 — News & Pengumuman (carousel)

### Data model

Tabel baru `announcements`:

```sql
CREATE TABLE public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0 NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

RLS: semua user authenticated (pgn/pgsol/vendor) boleh `SELECT` baris
`is_active = true` — pengumuman bukan data sensitif, semua tipe org
berhak lihat carousel. `INSERT`/`UPDATE`/`DELETE` dibatasi
`public.is_internal_user()` sebagai backstop; gate sebenarnya (siapa di
antara pgn/pgsol yang boleh) ada di permission layer (lihat di bawah),
persis pola `inspections`/`account`/`role`.

Manajemen (halaman admin) butuh baca baris **non-aktif** juga (supaya
bisa diaktifkan lagi) — `getAnnouncementsForManagement()` di action
pakai `createAdminClient()` (bypass RLS, sama seperti
`account/actions.ts`), bukan client biasa.

### Permission

Modul baru di `allPermissionModules`:

```ts
{
  id: 'announcement',
  title: 'News & Pengumuman',
  description: 'Konten pengumuman yang tampil sebagai carousel di halaman utama dashboard.',
  items: [
    { key: 'view', label: 'Melihat Carousel Pengumuman', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
    { key: 'manage', label: 'Mengelola Pengumuman (tambah/edit/hapus)', allowedTypes: ['pgn'] },
  ]
}
```

`view` sebetulnya tidak pernah dicek eksplisit — carousel di home page
selalu coba fetch dan render kalau ada data aktif (semua tipe org
memang boleh lihat per keputusan user), key ini ada supaya modul
tetap konsisten dengan pola "tiap modul punya `view`" dan supaya kelak
kalau ingin dibatasi, tinggal tambah pengecekan tanpa migrasi ulang
skema permission.

### Server actions

Baru: `app/dashboard/master-data/announcement/actions.ts`

- `getActiveAnnouncements()` — dipanggil dari kedua dashboard home
  (internal & vendor), pakai client biasa (RLS `is_active=true` sudah
  cukup), `.order('display_order', { ascending: true })`.
- `getAnnouncementsForManagement()` — admin client, semua baris
  (termasuk nonaktif), untuk halaman kelola.
- `addAnnouncement(formData)` / `updateAnnouncement(id, formData)` /
  `deleteAnnouncement(id)` / `toggleAnnouncementActive(id, isActive)` —
  tiap mutasi: `hasPermissionForUser(supabase, user.id, 'announcement',
  'manage')` dulu, baru pakai admin client untuk tulis. Pola identik
  `role/actions.ts`.

### Management UI

Halaman baru `app/dashboard/master-data/announcement/`:
`page.tsx` (list card + tombol tambah/edit/hapus/toggle aktif, mirip
struktur `role/page.tsx`), `actions.ts` (di atas). Form: upload gambar
(pakai `uploadImage(file, 'announcements')` ke bucket
`sipermit-images` yang sudah ada — tidak ada bucket baru), judul,
deskripsi (textarea), urutan (number input).

Sidebar (`components/internal/sidebar-nav.tsx`, array `masterData`):

```ts
{ name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
```

Tidak ada entry sidebar di sisi vendor — vendor cuma lihat carousel di
home, tidak ada halaman kelola untuk mereka.

### Carousel component

`components/shared/AnnouncementCarousel.tsx` — client component,
terima prop `announcements: Announcement[]` dari server component
pemanggil (pola sama seperti `VendorDashboardCharts`). Autoplay
(interval ~5 detik) + panah manual prev/next + dot indicator. Kalau
array kosong, component **tidak dipanggil sama sekali** oleh
pemanggil (bukan render null internal) — `app/dashboard/page.tsx` dan
`app/vendor/dashboard/page.tsx` masing-masing:

```tsx
const announcements = await getActiveAnnouncements();
// ...
{announcements.length > 0 && <AnnouncementCarousel announcements={announcements} />}
```

dipasang di paling atas, sebelum hero/stat-tiles yang sudah ada di
kedua halaman itu.

## Bagian 2 — Kategori "Audit / Kunjungan" + multi-foto temuan

### Dropdown baru

Satu `<option>` baru di select `name="finding_type"`
(`app/dashboard/inspection/page.tsx`, modal "Lapor Hasil Inspeksi"):

```html
<option value="Audit / Kunjungan">Audit / Kunjungan (Temuan Pasca-Kunjungan)</option>
```

Tidak ada migrasi untuk kolom ini (lihat "Temuan yang mendasari" di
atas). Badge warna kategori di card grid tidak berubah struktur (masih
text label biasa), cukup pastikan tidak ada mapping warna yang
mengasumsikan hanya 3 nilai — dicek: kode yang ada
(`app/dashboard/inspection/page.tsx` baris ~288) hanya menampilkan
`item.type` sebagai teks polos, tidak ada switch/mapping per nilai, jadi
aman tanpa perubahan tambahan.

### Multi-foto (semua kategori)

Tabel baru `inspection_photos`:

```sql
CREATE TABLE public.inspection_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

RLS (pola sama `schema_inspections_rls.sql`, lewat join ke
`inspections` karena `inspection_photos` sendiri tidak punya
`target_vendor`):

```sql
-- SELECT
CREATE POLICY "Internal users can read all inspection photos"
ON public.inspection_photos FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Vendors can read own inspection photos"
ON public.inspection_photos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inspections i
  WHERE i.id = inspection_photos.inspection_id
  AND i.target_vendor = public.current_vendor_org_id()
));

-- INSERT (hanya internal, sinkron dengan siapa yang boleh createInspection)
CREATE POLICY "Internal users can insert inspection photos"
ON public.inspection_photos FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());
```

Tidak ada `UPDATE`/`DELETE` policy — foto laporan tidak pernah diedit
setelah dibuat (konsisten dengan tidak adanya edit pada `inspections`
sendiri di luar field status/disposisi/validasi).

`inspections.image_url` **dipertahankan** (bukan di-drop) — baris lama
tetap terbaca lewat kolom itu. Baris baru: foto pertama yang di-upload
tetap ditulis ke `inspections.image_url` (supaya kode lama yang masih
baca `item.image_url` sebagai thumbnail tidak perlu diubah), **dan**
seluruh foto (termasuk yang pertama) ditulis ke `inspection_photos`.

### Scope yang sengaja dikeluarkan

`vendor_evidence_url` (foto bukti perbaikan dari vendor, di modal
"Validasi Perbaikan") **tetap 1 foto** — tidak disentuh. Permintaan
user ("temuan pasca-audit, ada foto dan penjelasan") mengarah ke sisi
laporan/pelapor, bukan sisi tindak lanjut vendor, dan user tidak
diminta soal ini secara eksplisit. Kalau nanti dibutuhkan, itu
perubahan terpisah dengan pola yang sama (tabel
`inspection_evidence_photos` atau perluasan `inspection_photos` dengan
kolom `kind`).

### Perubahan kode

- `app/dashboard/inspection/actions.ts`:
  - `createInspection(formData)` — `formData.getAll('image_urls')`
    (bukan `get('image_url')` tunggal) untuk terima banyak URL yang
    sudah di-upload di client. Insert `inspections` tetap set
    `image_url` = URL pertama. Setelah insert sukses, loop insert
    semua URL ke `inspection_photos` (satu query `.insert([...])`
    dengan array of objects, bukan loop per-row).
  - `getInspections()` — tambah `inspection_photos (id, image_url)` ke
    `.select()`.
- `app/dashboard/inspection/page.tsx`:
  - Field upload foto di modal "Lapor Hasil Inspeksi" jadi multi-file
    (`<input type="file" multiple>`), state `imageFiles: File[]`
    (bukan `File | null`), preview grid kecil dengan tombol hapus per
    item sebelum submit.
  - `handleCreate` — loop `uploadImage()` untuk tiap file, kumpulkan
    URL hasil upload, `formData.append('image_urls', url)` per URL
    (bukan `image_url` tunggal).
  - Card grid — foto pertama tetap jadi thumbnail utama; kalau
    `inspection_photos.length > 1`, badge kecil "+N" di pojok gambar
    yang saat diklik membuka lightbox sederhana (state lokal
    `viewingPhotos: string[] | null`, modal baru khusus galeri,
    navigasi prev/next).
- `app/vendor/dashboard/inspection/actions.ts` (`getVendorInspections`)
  — tambah `inspection_photos (id, image_url)` ke `.select()`, supaya
  vendor juga bisa lihat galeri (read-only, tidak ada upload di sisi
  ini).
- `app/vendor/dashboard/inspection/page.tsx` — card grid ikut pakai
  badge "+N" + lightbox yang sama (read-only, tidak ada perubahan
  upload).
- Export CSV (`exportToCSV` di `app/dashboard/inspection/page.tsx`) —
  tidak berubah, tetap text-only.

## Bagian 3 — Cross-cutting

### Schema file

Satu file baru: `supabase/schema_announcements_and_audit_photos.sql`,
berisi (dalam urutan): `CREATE TABLE announcements` + RLS,
`CREATE TABLE inspection_photos` + RLS. Kedua tabel independen dari
migrasi lain (tidak butuh backfill, tidak bergantung urutan Fase
1-3.1) — aman dijalankan kapan saja setelah `schema.sql` dasar dan
`schema_org_*` (karena RLS `inspection_photos` memakai
`public.is_internal_user()`/`public.current_vendor_org_id()` yang
didefinisikan di migrasi org). Tidak perlu entry baru di
`README_org_migration_order.md` / `README_stage_assignment_migration_order.md`
karena tidak menyisipkan diri di urutan Fase manapun — cukup catatan
singkat di komentar header file itu sendiri kalau harus dijalankan
setelah migrasi org.

### AGENTS.md

Tambah satu kalimat di bagian "Two app realms" atau bagian baru kecil
yang menyebut: modul `announcement` (news carousel, PGN-managed) dan
`inspection_photos` (multi-foto temuan) sebagai contoh modul
permission-driven terbaru — supaya AGENTS.md tetap representatif kalau
ada yang baca sebelum menyentuh salah satu modul ini.

### Tidak berubah

- Storage: bucket `sipermit-images` dipakai ulang untuk
  `announcements/` dan `inspections/` (foto laporan) — tidak ada
  bucket baru.
- PDF export — tidak ada modul PDF untuk inspeksi (`@react-pdf/renderer`
  cuma dipakai PTW/Prosedur/JSA/Incident), jadi tidak ada yang perlu
  disentuh di situ.
- `vendor_evidence_url` (lihat "Scope yang sengaja dikeluarkan").
- Tidak ada perubahan pada `middleware.ts` / routing — kedua fitur
  murni penambahan tabel + halaman/komponen baru di realm yang sudah
  ada, tidak menyentuh siapa-boleh-masuk-ke-mana.

# Multi-Tenant Organization Foundation — Design

## Background

Stakeholder revisi: setiap tahap approval Prosedur Kerja → JSA → PTW harus bisa
dikonfigurasi admin (admin memilih siapa yang mereview/approve), berlaku juga
di portal vendor, dan totalnya ada 3 "admin" — vendor, PGSOL, PGN.

Ini dipecah jadi 3 fase (lihat riwayat brainstorming di sesi ini untuk
alasan pemecahan):

1. **Fase 1 (spec ini)** — Fondasi multi-tenant: organisasi, multi-user per
   org, portal PGSOL terpisah, admin ter-scope per org.
2. Fase 2 — Assignment approver per proyek + multi-signature per tahap.
   Menggantikan `PROCEDURE_STAGE_PERMISSION` / `JSA_STAGE_PERMISSION` /
   `PTW_STAGE_PERMISSION` (permission-based) dengan assignment eksplisit
   per proyek, dan semua orang yang di-assign ke satu tahap harus approve.
3. Fase 3 — Tahap "review internal vendor" baru di depan alur tiap dokumen,
   dengan approver dipilih oleh admin vendor.

Fase 2 dan 3 di luar cakupan spec ini — didesain terpisah setelah Fase 1
selesai diimplementasikan, karena keduanya bergantung pada model organisasi
di sini.

## Current State (sebelum Fase 1)

- `profiles.type` adalah ENUM Postgres `user_type ('internal', 'external')`
  (`supabase/schema.sql:26`). Cuma 2 portal: `/dashboard` (internal) dan
  `/vendor/dashboard` (external).
- `profiles.role` adalah TEXT bebas (sudah dilepas dari enum lama, lihat
  `supabase/schema_update_roles.sql`), dicocokkan ke `public.roles.name`.
  `roles.type` adalah TEXT (`'internal'`/`'external'`) dipakai buat filter
  tampilan di halaman Role & Permission.
- `vendor_profiles(id, company_name, ...)` — `id` adalah FK 1:1 ke
  `profiles.id` / `auth.users.id`. Artinya **1 akun login vendor = 1
  company**. Tidak ada konsep banyak staff dalam satu vendor company.
- `projects.vendor_id` → `vendor_profiles(id)`, yaitu akun vendor spesifik
  yang "memiliki" proyek. Semua RLS policy vendor (procedures, jsa, ptw,
  inspections, incidents, vendor_documents, workers, equipment, materials,
  dst.) memverifikasi akses dengan pola:
  ```sql
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = auth.uid())
  ```
- Pembuatan akun (vendor maupun internal) 100% tersentralisasi: cuma
  pemegang permission `masterData.manage_account` (role `admin` di portal
  internal) yang bisa bikin akun apa pun, lewat
  `app/dashboard/master-data/account/actions.ts`. Tidak ada self-service.
- `pgsol_reviewer` dan `pgn_approver` sekarang cuma role TEXT di kolam user
  `internal` yang sama — bukan organisasi terpisah.
- Routing portal ditentukan `utils/supabase/middleware.ts` dari
  `profiles.type` — 2 cabang (`internal` / `external`).

## Goals

- PGN, PGSOL, dan tiap vendor company jadi entitas organisasi yang setara
  dan simetris, masing-masing bisa punya banyak user.
- PGSOL dapat portal sendiri (`/pgsol/dashboard`), terpisah dari `/dashboard`
  (PGN) dan `/vendor/dashboard`.
- Tiap organisasi punya admin yang bisa mengelola staff-nya sendiri
  (tambah/edit/nonaktifkan akun), ter-scope ke organisasinya — vendor admin
  tidak bisa menyentuh staff PGSOL, dst.
- Admin PGN pusat (permission `manage_account` yang sekarang) tetap bisa
  lintas-organisasi: membuat organisasi baru (vendor company baru / bootstrap
  PGSOL) beserta akun admin pertamanya, dan sebagai fallback dukungan teknis.
- Akses proyek vendor berpindah dari "user spesifik" ke "organisasi vendor
  pemilik proyek" — siapa pun staff di company vendor itu bisa mengerjakan
  proyeknya (bukan cuma 1 akun seperti sekarang).

## Non-Goals (ditunda ke Fase 2 / Fase 3)

- Assignment approver per proyek per tahap, dan logic "semua yang di-assign
  harus approve" (multi-signature). Fase 1 **tidak mengubah** cara kerja
  `PROCEDURE_STAGE_PERMISSION` / `JSA_STAGE_PERMISSION` /
  `PTW_STAGE_PERMISSION` — approval PGSOL/PGN tetap jalan seperti sekarang
  (siapa pun di org itu yang punya permission terkait bisa approve),
  cuma sekarang kolam usernya ada di org/portal terpisah.
- Tahap "review internal vendor" baru di alur dokumen.
- Halaman UI untuk admin memilih approver per proyek.
- Portal PGSOL Fase 1 cuma berisi: login, lihat profil sendiri, dan halaman
  kelola staff org (kalau login sebagai admin PGSOL). Belum ada halaman
  approval JSA di portal ini — approver PGSOL di Fase 1 tetap approve lewat
  mekanisme yang sudah ada (mereka masuk portal PGSOL tapi actionnya masih
  memanggil server action approval JSA yang sudah ada, dipindah routingnya
  supaya bisa diakses dari portal baru).

## Data Model

### Tabel baru: `organizations`

```sql
CREATE TYPE org_kind AS ENUM ('pgn', 'pgsol', 'vendor');

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind org_kind NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
```

Cuma ada 1 baris `kind='pgn'` dan 1 baris `kind='pgsol'` (singleton — tidak
ada UI untuk bikin PGN/PGSOL baru). Baris `kind='vendor'` banyak, 1 per
vendor company, dibuat oleh admin PGN lewat alur "tambah vendor baru".

### `profiles.org_id` + rename `user_type`

```sql
ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);

ALTER TYPE user_type RENAME VALUE 'internal' TO 'pgn';
ALTER TYPE user_type RENAME VALUE 'external' TO 'vendor';
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pgsol';
```

Rename enum value (bukan ganti tipe kolom ke TEXT) mengikuti konvensi yang
sudah ada di repo (`ALTER TYPE user_role ADD VALUE ...` di
`schema_update_workflow.sql`) dan meminimalkan perubahan — kolom
`profiles.type` tetap enum, tinggal 3 label bukan 2.

`profiles.org_id` di-set aplikasi setiap kali akun dibuat/diubah (sama
seperti `type` sekarang di-set eksplisit di `addAccount`/`updateAccount`) —
tidak perlu trigger sinkronisasi, karena satu-satunya jalur pembuatan akun
adalah server action yang sudah dikontrol.

### `vendor_profiles` → jadi identitas company, dipakai bareng

`vendor_profiles` **tetap ada** sebagai tabel detail company (logo, alamat,
dst.), tapi `id`-nya berubah makna: sebelumnya `id = auth user id`, sekarang
`id = organizations.id` (baris `kind='vendor'`). Constraint FK-nya diganti:

```sql
ALTER TABLE public.vendor_profiles DROP CONSTRAINT vendor_profiles_id_fkey;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_org_id_fkey FOREIGN KEY (id) REFERENCES public.organizations(id) ON DELETE CASCADE;
```

Beberapa profile vendor (banyak user) bisa berbagi `org_id` yang sama, dan
`org_id` itulah yang dipakai untuk `JOIN vendor_profiles`.

### `vendor_id` di tabel lain: dipakai ulang apa adanya, bukan diganti

Kunci penyederhanaan: `projects.vendor_id`, `vendor_workers.vendor_id`,
`vendor_equipment.vendor_id`, `vendor_materials.vendor_id`, dan
`vendor_documents.vendor_id` **semuanya sudah** `REFERENCES
public.vendor_profiles(id)` (bukan `profiles(id)` langsung). Karena
`vendor_profiles.id` dipakai ulang jadi id organisasi (lihat bagian di
atas) tanpa nilainya berubah, kolom-kolom `vendor_id` ini **otomatis**
berisi id organisasi yang valid begitu migrasi `vendor_profiles` selesai —
tidak perlu kolom baru, tidak perlu backfill, tidak perlu ganti FK sama
sekali di tabel-tabel ini. Yang berubah cuma *makna* nilainya (dulu = id
satu user vendor, sekarang = id company vendor), dan cara RLS
membandingkannya (lihat helper di bawah).

### Helper SQL untuk RLS

```sql
CREATE OR REPLACE FUNCTION public.current_vendor_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Semua policy yang tadinya membandingkan `vendor_id = auth.uid()` —
langsung (`projects`, `vendor_workers`, `vendor_equipment`,
`vendor_materials`, `vendor_documents`) maupun lewat join (`procedures`,
`jsa`, `jsa_steps`, `ptw`, `inspections`, `incidents`, `toolbox_meetings`,
`site_checkins`, `vendor_worker_competencies`, `vendor_equipment_documents`,
`vendor_material_documents`) — diganti **satu-satu kata**:
`auth.uid()` → `public.current_vendor_org_id()`. Contoh langsung:

```sql
-- sebelum
USING (vendor_id = auth.uid())
-- sesudah
USING (vendor_id = public.current_vendor_org_id())
```

Contoh lewat join (pola `EXISTS (... p.vendor_id = auth.uid())`):

```sql
-- sebelum
EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = auth.uid())
-- sesudah
EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
```

Karena `vendor_id` di semua tabel ini sudah = id organisasi (lihat bagian
sebelumnya), tidak ada tabel yang butuh kolom/join tambahan — cuma
pergantian sisi kanan perbandingan. Daftar lengkap policy yang kena
substitusi ini (nama policy + file) didaftar per-task di implementation
plan.

Kode aplikasi (TS) yang melakukan filter setara —
`.eq('vendor_id', user.id)` atau insert `vendor_id: user.id` — di
`app/vendor/dashboard/**/*actions.ts` dan beberapa `page.tsx` (±22 titik di
±10 file, ditemukan lewat `grep -rn ".eq('vendor_id'" app/vendor`) juga
harus diganti dari `user.id` (id user login) menjadi id organisasi vendor
milik user itu (`profiles.org_id`), lewat helper baru
`getCallerVendorOrgId(supabase)` di `utils/supabase/server.ts` atau file
sejenis — didetailkan di implementation plan.

### Migrasi data (urutan wajib)

Urutan di bawah sengaja menjaga agar setiap `WHERE type = '...'` selalu
memakai label enum yang **sudah ada** pada saat statement itu jalan — enum
value baru (`pgsol`) ditambah duluan (aman, additif), sedangkan rename
(`internal`→`pgn`, `external`→`vendor`) dilakukan paling akhir, setelah
semua backfill yang masih bergantung pada label lama selesai.

1. Buat tipe `org_kind`, tabel `organizations`, kolom `profiles.org_id`.
2. `ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pgsol';` — file/statement
   terpisah (lihat catatan runtime di bawah).
3. `INSERT INTO organizations (kind, name) VALUES ('pgn', 'PGN')` — simpan
   id-nya, backfill `UPDATE profiles SET org_id = <id pgn> WHERE type =
   'internal' AND role <> 'pgsol_reviewer'` (label `'internal'` masih valid
   di titik ini, belum di-rename).
4. `INSERT INTO organizations (kind, name) VALUES ('pgsol', 'PGSOL')` —
   backfill `UPDATE profiles SET org_id = <id pgsol>, type = 'pgsol' WHERE
   role = 'pgsol_reviewer'` (label `'pgsol'` sudah ada sejak langkah 2).
5. Untuk tiap baris `vendor_profiles` yang ada, buat baris `organizations`
   dengan **id yang sama** dengan `vendor_profiles.id` yang sudah ada
   (id lama itu tadinya = id user vendor, sekarang dipakai ulang langsung
   sebagai id organisasi — jadi tidak perlu UPDATE id di `vendor_profiles`
   maupun tabel lain yang mereferensikannya):
   ```sql
   INSERT INTO organizations (id, kind, name)
   SELECT id, 'vendor', company_name FROM vendor_profiles;
   ```
6. Ganti FK `vendor_profiles.id`: drop constraint lama yang menunjuk
   `profiles(id)`, tambah constraint baru menunjuk `organizations(id)`
   (lihat DDL di bagian "`vendor_profiles` → jadi identitas company" di
   atas). Karena id tidak berubah nilainya, langkah ini murni ganti target
   FK — `projects.vendor_id` dkk. (FK ke `vendor_profiles(id)`) tidak perlu
   disentuh sama sekali, PK yang mereka rujuk tetap sama persis.
7. `UPDATE profiles p SET org_id = p.id WHERE p.id IN (SELECT id FROM
   vendor_profiles) AND p.type = 'external'` — profile vendor asli
   (satu-satunya user di company itu sejauh ini) diarahkan ke org yang id-nya
   sama dengan id vendor_profiles miliknya. Label `'external'` masih dipakai
   di sini karena rename belum terjadi (lihat langkah 8).
8. `ALTER TYPE user_type RENAME VALUE 'internal' TO 'pgn'; ALTER TYPE
   user_type RENAME VALUE 'external' TO 'vendor';` — file/statement
   terpisah, dijalankan setelah semua `UPDATE ... WHERE type = 'internal'/
   'external'` di atas selesai.
9. Buat fungsi `current_vendor_org_id()` dan terapkan ulang semua RLS
   policy yang membandingkan `vendor_id`/`p.vendor_id = auth.uid()`
   memakainya, sesuai daftar di bagian "Helper SQL untuk RLS" di atas.
10. Perbarui `is_internal_user()` / `is_external_user()` (lihat bagian
    berikut) dan `handle_new_user()` supaya memakai label enum baru.

**Catatan runtime Postgres:** `ALTER TYPE ... RENAME VALUE` dan
`ALTER TYPE ... ADD VALUE` tidak boleh dijalankan di transaksi yang sama
dengan statement yang memakainya (khas batasan enum Postgres) — jadi
langkah 2 dan langkah 8 masing-masing harus jadi file/statement terpisah
dari langkah-langkah di sekitarnya, sesuai konvensi migrasi yang sudah ada
di repo (tiap `schema_*.sql` dijalankan manual satu per satu oleh user di
Supabase SQL editor).

### `is_internal_user()` / `is_external_user()` / `handle_new_user()`

Ketiga fungsi `SECURITY DEFINER` ini dipakai di banyak policy lewat nama
(bukan didefinisikan ulang per tabel), jadi cukup di-`CREATE OR REPLACE`
sekali untuk mengubah perilaku semua policy yang memanggilnya:

```sql
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type IN ('pgn', 'pgsol'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_external_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type = 'vendor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

`is_internal_user()` sengaja mencakup **kedua** `pgn` dan `pgsol` — ini
yang menjaga semua policy "Internal users can view/update all X" (dipakai
di procedures/jsa/ptw/incidents/vendor_documents/toolbox_meetings/dst.)
tetap berlaku persis seperti sekarang untuk staff PGSOL, sesuai Non-Goal
"approval PGSOL/PGN tetap jalan seperti sekarang".

`handle_new_user()` (trigger `on_auth_user_created`, definisi aktif di
`schema_fix_handle_new_user_role.sql`) melakukan
`(new.raw_user_meta_data->>'type')::public.user_type` dengan default
literal `'external'` — literal ini juga harus di-`CREATE OR REPLACE`
memakai `'vendor'` setelah rename, kalau tidak pembuatan akun baru gagal
dengan error enum. Cabang `IF new_type = 'external' THEN ... ELSE ...`
menjadi `IF new_type = 'vendor' THEN ... ELSE ...` — cabang `ELSE` (insert
`internal_profiles`) tetap dipakai bersama oleh `pgn` maupun `pgsol`, tidak
perlu cabang ketiga.

## Portal & Routing

`utils/supabase/middleware.ts` diperluas dari 2 cabang jadi 3, dibaca dari
`profiles.type` (`pgn` / `pgsol` / `vendor`):

| type | home | login | blocked dari |
|------|------|-------|--------------|
| pgn | `/dashboard` | `/auth/login` | `/vendor/*`, `/pgsol/*` |
| pgsol | `/pgsol/dashboard` | `/pgsol/login` | `/dashboard/*`, `/vendor/*` |
| vendor | `/vendor/dashboard` | `/vendor/login` | `/dashboard/*`, `/pgsol/*` |

Struktur route baru `app/pgsol/` mengikuti pola `app/vendor/` yang sudah
ada (layout + login page + dashboard shell), bukan meniru `app/dashboard/`
yang jauh lebih besar — Fase 1 cuma butuh: halaman login, layout dasar
dengan nav, halaman profil, dan halaman kelola staff (kalau admin PGSOL).

Approver PGSOL yang sekarang approve JSA lewat `/dashboard/approval` pindah
login ke `/pgsol/login`, tapi **link approval JSA-nya diarahkan ke rute baru
di bawah `/pgsol/`** yang memanggil server action approval JSA yang sudah
ada (tidak ditulis ulang) — cukup dipindah titik masuknya, bukan logicnya.

## Admin & Permission Model

- Permission `masterData.manage_account` (sudah ada) tetap berarti
  "superadmin lintas organisasi" — cuma dipegang role `admin` PGN. Dipakai
  untuk: membuat organisasi vendor baru + akun admin pertamanya, dan
  sebagai jalur darurat mengelola akun org mana pun.
- Permission baru `masterData.manage_org_staff` — dicek dengan
  `hasPermissionForUser` **ditambah** verifikasi eksplisit di server action:
  target profile yang diubah harus punya `org_id` sama dengan `org_id`
  aktor (kecuali aktor punya `manage_account`, yang bebas lintas org).
  Ditambahkan sebagai item baru ke `allPermissionModules`
  (`app/dashboard/master-data/role/constants.ts`) di bawah modul
  `masterData`.
- Role baru (lewat `public.roles`, bukan hardcode): `vendor_admin` (type
  `vendor`) dan `pgsol_admin` (type `pgsol`), masing-masing dibekali
  `masterData: ["manage_org_staff"]`. `roles.type` sudah TEXT bebas —
  tidak perlu migrasi skema, tapi **data**-nya perlu di-`UPDATE`: baris
  existing `type = 'external'` → `'vendor'`, dan role `pgsol_reviewer`
  → `type = 'pgsol'` (sebelumnya `'internal'`). Sisa baris `'internal'`
  → `'pgn'`.
- Semua perbandingan string literal `=== 'internal'` / `=== 'external'`
  di kode app (baik terhadap `profiles.type` maupun `roles.type` —
  contoh: `app/vendor/dashboard/projects/[id]/actions.ts:15`,
  `app/dashboard/master-data/role/page.tsx:136`) disapu jadi satu task
  tersendiri di implementation plan, diganti ke label baru (`pgn`/`pgsol`/
  `vendor`) sesuai konteksnya (helper `isPgn()`/`isPgsol()`/`isVendor()`
  baru di `lib/roles.ts` dianjurkan untuk menggantikan perbandingan string
  langsung, supaya tidak berulang lagi di migrasi berikutnya).
- Halaman kelola staff org: dipakai ulang `app/dashboard/master-data/account`
  sebagai basis (component & actions sudah ada), tapi query/action-nya
  di-scope: kalau aktor punya `manage_account` → lihat/kelola semua org;
  kalau cuma `manage_org_staff` → query difilter `org_id = aktor.org_id`,
  dan `addAccount` server action otomatis mengisi `org_id` = org aktor
  (tidak bisa pilih org lain).
- Halaman ini diakses dari 2 tempat: `/dashboard/master-data/account`
  (existing, dipakai admin PGN — lintas org) dan halaman baru
  `/vendor/dashboard/staff` + `/pgsol/dashboard/staff` (dipakai admin
  vendor/PGSOL, ter-scope otomatis ke org sendiri).

## Testing

- `npx tsc --noEmit -p .` dan `npm run build` (konvensi repo, lihat
  `[[repo-conventions]]`).
- RLS diverifikasi manual lewat Supabase SQL editor: sebagai user vendor A,
  pastikan tidak bisa `SELECT`/`UPDATE` proyek milik vendor org B walau tahu
  id proyeknya; sebagai staff vendor company yang sama (2 akun berbeda,
  `org_id` sama), pastikan **bisa** mengakses proyek yang sama.
- Uji middleware: akun `type='pgsol'` yang mengakses `/dashboard` atau
  `/vendor/dashboard` harus di-redirect ke `/pgsol/dashboard`.
- Uji `manage_org_staff`: admin vendor A mencoba `updateAccount` pada id
  milik staff vendor B → harus ditolak (bukan cuma disembunyikan di UI).

## Open Decisions (terjawab selama brainstorming sesi ini)

- PGSOL & PGN masing-masing 1 organisasi tunggal (bukan multi-tenant di
  dalam PGSOL/PGN sendiri) — cuma vendor yang punya banyak baris org.
- Assignment approver = "semua yang ditunjuk harus approve" (multi-
  signature) — ditangani di Fase 2, bukan di sini.
- Assignment approver dilakukan per proyek, bukan default global per org —
  juga Fase 2.
- Vendor dapat tahap approval internal sendiri sebelum submit ke
  PGSOL/PGN — Fase 3.

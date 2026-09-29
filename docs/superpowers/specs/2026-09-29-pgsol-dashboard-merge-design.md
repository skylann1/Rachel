# Gabungkan portal PGSOL ke `/dashboard` (PGN) — design

## Origin

Permintaan user, 2026-09-29: "pgsol itu dashboard nya samain aja sama
pgn bro, jadi gabikin page baru atau dashboard baru, yang membedakan
nanti di role permissions nya aja kan." PGSOL berhenti punya realm
sendiri (`/pgsol/dashboard/*`); user PGSOL login dan memakai persis
`/dashboard` yang sama dengan PGN, dibedakan murni oleh
`roles.permissions` — pola yang sebetulnya sudah dipakai sejak awal
oleh `allPermissionModules` (`allowedTypes` per item) dan oleh
`roles.type`, cuma belum ditarik sampai ke routing/layout-nya.

Dua keputusan eksplisit dari user (brainstorming session ini):

1. **Login digabung ke `/auth/login`** (bukan mempertahankan
   `/pgsol/login` sebagai pintu masuk terbrand yang redirect ke
   `/dashboard`).
2. **Halaman Role & Manajemen Akun dibatasi per-tipe pemanggil** —
   sekalian menutup gap keamanan yang ditemukan saat brainstorming
   (lihat "Gap #3" di bawah).

## Temuan yang mendasari desain ini

Disurvei langsung dari kode sebelum desain ditulis:

- `allPermissionModules` (`app/dashboard/master-data/role/constants.ts`)
  sudah punya `allowedTypes: ['pgn','pgsol','vendor']` per item sejak
  awal. `app/pgsol/dashboard/role/constants.ts` adalah **duplikat
  byte-identik** dari file yang sama.
- `roles` sudah punya kolom `type`. `/dashboard/master-data/role`
  (halaman PGN) **sudah menampilkan role PGSOL dan vendor juga**, bukan
  cuma role PGN.
- Middleware (`utils/supabase/middleware.ts`) **sudah** mengizinkan
  user PGSOL masuk ke `/dashboard/approval` dan
  `/dashboard/projects/[id]` sebagai pengecualian — setengah jalan
  menuju penggabungan penuh.
- Query DB langsung (`roles` where `type='pgsol'`) mengonfirmasi
  `pgsol_admin` **tidak** punya `manage_role` — cuma `manage_org_staff`.
  Gate `/pgsol/dashboard/role/layout.tsx` (`hasPermission('masterData',
  'manage_role')`) berarti halaman itu **dead code**, tidak pernah bisa
  diakses user PGSOL manapun hari ini. Aman dihapus tanpa regresi akses.
- `/dashboard/master-data/account/actions.ts` **sudah** punya
  infrastruktur scoping-per-org yang matang: `requireAccountAccess()`
  mengembalikan `AccountActor { crossOrg, orgId, orgKind }`
  (`crossOrg = true` kalau punya `manage_account`, `false` kalau cuma
  `manage_org_staff`), `assertSameOrg()`, dan `assertAssignableRole()`
  (menolak pemberian role `admin` dari jalur org-scoped, dan menolak
  role yang `type`-nya beda dari tipe organisasi aktor). Ini dipakai
  bersama oleh mutasi akun PGSOL (`/pgsol/dashboard/staff` tidak punya
  `actions.ts` sendiri — action-nya dari `master-data/account/actions.ts`)
  maupun vendor. **Hanya `page.tsx`-nya (query listing) yang belum
  di-scope** — masih query semua profil tanpa memandang tipe/org aktor,
  dan gate-nya cuma `view_account` (yang tidak dipegang `pgsol_admin`).
- Role (`app/dashboard/master-data/role/actions.ts` dan
  `app/pgsol/dashboard/role/actions.ts`, isinya identik) **tidak** punya
  scoping serupa sama sekali — `requireManageRole()` cuma mengecek
  permission `manage_role`, tidak pernah mengecek tipe/org aktor
  sendiri. Kalau suatu saat ada role non-PGN yang diberi `manage_role`
  (lewat SQL langsung, bukan lewat UI checkbox yang menyaring
  `allowedTypes`), aktor itu bisa mengedit/menghapus role PGN maupun
  vendor lewat action yang sama persis. Ini **Gap #3** — laten, tidak
  tereksploitasi hari ini (karena tidak ada role non-PGN yang pegang
  `manage_role`), tapi bukan defense-in-depth yang benar.
- Fitur PGSOL yang genuinely unik (bukan duplikat halaman PGN):
  1. **Staff Organisasi** (`/pgsol/dashboard/staff`) — list ter-scope
     `org_id`, pakai action dari `master-data/account/actions.ts`.
  2. **Kelola Reviewer PGSOL** (`/pgsol/dashboard/projects/[id]/assign`)
     — assign reviewer/HSE PGSOL per proyek per doc-type, gated
     `jsa.manage_assignment_pgsol` (`allowedTypes: ['pgsol']` saja).
     Tidak ada padanan di PGN.
  3. Role & Permission versi terbatas (`/pgsol/dashboard/role`) — dead
     code, lihat di atas. Tidak perlu dipindah, cukup dihapus.
- Related work: `2026-09-27-pgsol-hse-gate-parity-design.md` sudah
  mengimplementasi penuh status/stage-key/permission untuk
  `hse_pgsol` (Prosedur/JSA) dan `review_pgsol`+`hse_pgsol` (PTW) di
  seluruh layer kode (`lib/*-status.ts`, `lib/stage-assignments.ts`,
  kedua salinan `constants.ts`). Rollout self-service-nya (PGSOL admin
  mencentang izin baru di suatu role) belum dijalankan siapa pun di DB
  live — di luar cakupan spec ini, disebut di sini supaya implementor
  tidak salah kira ini bagian dari pekerjaan penggabungan.

## Non-goals

- Tidak mengubah realm `/vendor/*` sama sekali — permintaan user cuma
  soal PGSOL.
- Tidak menambah permission baru. Semua gating nav/halaman baru pakai
  permission yang sudah ada (`masterData.manage_org_staff`,
  `jsa.manage_assignment_pgsol`, `masterData.manage_role`,
  `masterData.view_account`).
- Tidak menjalankan rollout self-service dari spec HSE-gate-parity
  (2026-09-27) — itu kerjaan operasional terpisah, bukan bagian dari
  penggabungan routing/dashboard ini.
- Tidak mengubah `stage_assignments`, `roles`, atau tabel lain secara
  skema — murni perubahan kode aplikasi (routing, layout, query
  scoping). Tidak ada file `schema_*.sql` baru.
- Gap #3 ditutup dengan pola yang sama seperti account
  (`crossOrg`/`assertSameOrg`/`assertAssignableRole`), bukan desain
  baru — konsisten dengan kode yang sudah ada, bukan penambahan
  kerumitan baru (YAGNI).

## Arsitektur

### 1. Login

`app/auth/login/actions.ts`: gate `profile?.type !== 'pgn'` diperluas
jadi `profile?.type !== 'pgn' && profile?.type !== 'pgsol'`. Redirect
sukses tetap `/dashboard` untuk keduanya — tidak perlu redirect
bercabang karena `/dashboard` sudah jadi tujuan tunggal.

`app/pgsol/login/page.tsx` dan `actions.ts` **dihapus**. Untuk bookmark
lama, `app/pgsol/login/page.tsx` diganti versi tipis yang langsung
`redirect('/auth/login')` (server component, tanpa form) — supaya URL
lama tidak 404 tapi juga tidak mempertahankan form/actions terpisah.
Salinan copy PGN di `/auth/login/page.tsx` ("Khusus untuk Tim HSE,
Project Manager, dan Pengelola Aset...") tidak diubah — PGSOL secara
istilah tetap masuk kategori "tim internal", tidak perlu penyebutan
eksplisit.

### 2. Middleware

`utils/supabase/middleware.ts`: hapus seluruh percabangan
`isPgsol(type)` yang terpisah (termasuk pengecualian
`isDashboardApprovalPath` yang sekarang jadi tidak perlu — PGSOL dapat
akses penuh `/dashboard/*`, sama seperti cabang `isPgn`). Gabungkan
`isPgn`/`isPgsol` jadi satu pengecekan (`isInternal = isPgn(type) ||
isPgsol(type)`) yang menjalankan logic yang sekarang cuma dipakai
cabang `isPgn`: redirect ke `/dashboard` kalau lagi di `/vendor/*` atau
`/auth/login`.

Path `/pgsol/*` (selain `/pgsol/login`, yang jadi redirect tipis)
**dihapus dari filesystem**, jadi Next.js 404 alami menangani sisanya —
tidak perlu redirect khusus di middleware untuk path itu, kecuali
`isPgsolLogin`/`isPgsolPath` yang harus dihapus dari variabel-variabel
gate supaya middleware tidak mereferensikan path yang sudah tidak ada.

### 3. Hapus `app/pgsol/dashboard/*`

Seluruh isi (`layout.tsx`, `page.tsx`, `profile/`, `role/`, `staff/`,
`projects/page.tsx`, `projects/actions.ts`) dihapus. Yang dipindah,
lihat item 5 & 6.

### 4. Nav

`components/internal/sidebar-nav.tsx` (dan `desktop-sidebar.tsx` /
`InternalMobileSidebar.tsx` kalau mereka menduplikasi daftar menu, cek
saat implementasi) dapat dua entri baru di grup `masterData`:

```ts
{ name: 'Staff Organisasi', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'manage_org_staff' } },
{ name: 'Kelola Reviewer PGSOL', href: '/dashboard/master-data/project-pgsol-assign', icon: Users, permission: { module: 'jsa', action: 'manage_assignment_pgsol' } },
```

Item "Staff Organisasi" memakai `href` yang **sama** dengan "Manajemen
Akun" yang sudah ada — halaman itu sendiri (item 5) yang membedakan
tampilan berdasarkan `crossOrg`. Filter `hasAccess()` yang sudah ada di
`SidebarNav` otomatis membuatnya cuma nongol untuk role yang punya
salah satu dari kedua permission (`view_account` atau
`manage_org_staff`) — kalau user sudah punya `view_account` (admin
PGN), entri "Manajemen Akun" yang lama saja yang tampil, dua entri
tidak dobel (dedupe di render, bukan filter array — detail di
implementasi).

"Kelola Reviewer PGSOL" pakai path baru (lihat item 6), tidak
bentrok dengan apa pun yang sudah ada di PGN.

### 5. `/dashboard/master-data/account` — scoping

`page.tsx`:
- Gate diperluas: `(await hasPermission('masterData', 'view_account'))
  || (await hasPermission('masterData', 'manage_org_staff'))`.
- Kalau aktor **tidak** punya `view_account` (berarti cuma
  `manage_org_staff`, org-scoped): ambil `org_id` dan `type` aktor dari
  `profiles`, filter query `.eq('org_id', orgId)` — persis logic yang
  sekarang di `/pgsol/dashboard/staff/page.tsx` (yang juga dipakai
  vendor lewat pola serupa, cek saat implementasi apakah ada halaman
  vendor yang sama dan bisa disatukan; kalau vendor punya halaman
  terpisah sendiri itu di luar cakupan spec ini).
- Daftar `roles` untuk dropdown filter (`select('name, is_system,
  type')`) juga di-scope `.eq('type', actorType)` untuk aktor
  org-scoped — mencegah dropdown menampilkan role PGN/vendor yang tidak
  relevan buat admin PGSOL.
- `AccountTable`'s `basePath`/`title`/`subtitle`/`lockedType` props
  (yang sekarang dikirim manual oleh `/pgsol/dashboard/staff/page.tsx`)
  disesuaikan kondisional di halaman gabungan ini.

Mutasi (`actions.ts`) **tidak berubah** — sudah scope-aware lewat
`requireAccountAccess`/`assertSameOrg`/`assertAssignableRole`.

### 6. Kelola Reviewer PGSOL — pindah lokasi

Route baru: `app/dashboard/master-data/project-pgsol-assign/[id]/page.tsx`
(nama final dikonfirmasi saat implementasi supaya konsisten dengan
konvensi path `master-data` yang ada — alternatif:
`app/dashboard/master-data/project/[id]/assign-pgsol/page.tsx` supaya
menempel di `project/[id]` yang sudah ada; pilih salah satu saat
menulis plan, bukan brainstorming).

Isi dipindah apa adanya dari
`app/pgsol/dashboard/projects/[id]/assign/page.tsx` +
`AssignPgsolPanel.tsx`: gate `jsa.manage_assignment_pgsol`, ambil
`org_id` aktor, `getEligibleAssignees`/`getStageAssignments` untuk 6
stage (Prosedur/JSA/PTW × Reviewer/HSE). Daftar proyek yang sekarang
di `/pgsol/dashboard/projects/page.tsx` (list proyek yang punya
dokumen diajukan, dengan link "Kelola Reviewer") dipindah ke
`app/dashboard/master-data/project-pgsol-assign/page.tsx`, gate sama.

`app/pgsol/dashboard/projects/actions.ts` (`getPgsolProjects`) pindah
isi ke `actions.ts` di lokasi baru, tidak ada perubahan logic.

### 7. `/dashboard/master-data/role` — tutup Gap #3

`app/dashboard/master-data/role/actions.ts`: tambah
`requireRoleAccess()` menggantikan `requireManageRole()`, pola sama
seperti `requireAccountAccess()`:

```ts
interface RoleActor { userId: string; type: string | null; crossOrg: boolean }
// crossOrg = actor.type === 'pgn' (bukan cuma permission manage_role —
// defense in depth kalau suatu saat role non-PGN diberi manage_role
// lewat SQL langsung, di luar jalur UI yang menyaring allowedTypes)
```

- `addRole`: kalau `!crossOrg`, paksa `type` yang disimpan = tipe
  aktor sendiri (abaikan nilai `type` dari form kalau beda).
- `updateRole`/`updateRolePermissions`: kalau `!crossOrg`, tolak kalau
  role target `type !== actor.type` atau `is_system === true`; tolak
  perubahan field `type` ke nilai lain.
- `deleteRole`: kalau `!crossOrg`, tolak kalau role target
  `type !== actor.type`.

`page.tsx`: kalau `!crossOrg`, query `roles` di-filter
`.eq('type', actor.type)`.

Karena hari ini tidak ada role non-PGN yang punya `manage_role`,
perubahan ini **tidak mengubah perilaku yang terlihat** untuk siapa
pun di database live — murni defense-in-depth, siap pakai kalau nanti
memang ada kebutuhan self-service role management untuk PGSOL/vendor.

`app/pgsol/dashboard/role/*` dihapus seluruhnya (dead code, lihat
temuan di atas) — tidak perlu dipindah kemana pun.

### 8. Dokumentasi

`AGENTS.md`, bagian "Three app realms": baris "`/vendor/*` dan
`/pgsol/*` — vendor dan PGSOL apps" diubah jadi PGSOL disebut sebagai
bagian dari `/dashboard/*` (dibedakan lewat `profiles.type` dan
`roles.permissions`, bukan direktori terpisah). "Each realm has its
own login page, server actions, and layout" diperjelas: berlaku untuk
`/dashboard` (PGN+PGSOL) dan `/vendor`, dua realm — bukan tiga.

## Rollout

Tidak ada migrasi SQL. Urutan aman untuk deploy: kode dulu (semua item
di atas dalam satu deploy, karena saling bergantung — middleware yang
setengah diubah akan merusak salah satu sisi), lalu user PGSOL yang
sudah ada otomatis lanjut jalan begitu login ulang (session existing
tidak perlu direset — gate ada di server per-request, bukan di token).

## Testing

Tidak ada test runner (lihat `AGENTS.md`). Verifikasi:
`npx tsc --noEmit` + `npm run build`, plus manual walkthrough (tidak
bisa dijalankan dari lingkungan ini, dicatat untuk user):

1. Login sebagai `pgsol_admin` (akun apa pun bertipe pgsol dengan role
   itu) lewat `/auth/login` → mendarat di `/dashboard`, nav
   menampilkan "Staff Organisasi" dan "Kelola Reviewer PGSOL" tapi
   **tidak** "Role & Permission" (karena `pgsol_admin` tidak punya
   `manage_role`).
2. Halaman "Staff Organisasi" cuma menampilkan staff dari org PGSOL
   milik aktor, bukan seluruh sistem.
3. Login sebagai `pgsol_reviewer` → nav lebih sedikit lagi (tidak ada
   `manage_org_staff`/`manage_assignment_pgsol`), tapi tetap bisa
   masuk ke `/dashboard/approval` untuk review.
4. Login sebagai admin PGN → tidak ada regresi, semua nav & halaman
   yang sudah ada tetap sama, "Manajemen Akun" tetap menampilkan
   semua org (bukan ke-filter jadi cuma org PGN).
5. `/pgsol/login` (URL lama) → redirect ke `/auth/login`.
6. `/pgsol/dashboard` (URL lama) apa pun → 404 atau redirect (sesuai
   keputusan middleware), tidak error 500.

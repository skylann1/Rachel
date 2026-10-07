# Log Aktivitas & Pengguna Online — design

## Origin

Permintaan user, 2026-10-07: "bisa ga bikin feature log aktivitas dan
juga kita bisa liat pengguna online nya siapa aja" — lalu diperluas
mid-brainstorm: daftar pengguna online juga harus nampilin sedang buka
modul/halaman apa, bukan cuma status online/offline.

Dua subsistem baru sama sekali — tidak ada kode presence atau log
aktivitas sistem-lebar yang sudah ada di repo ini sebelum spec ini.

## Temuan yang mendasari desain ini

- **`document_logs`** (`supabase/schema_document_logs.sql`,
  `lib/document-logs.ts`) sudah ada, tapi khusus audit trail status
  Prosedur/JSA/PTW (submit/review/approve/reject) — ditampilkan di tab
  "Riwayat" `AdminProjectClient.tsx`/`VendorProjectClient.tsx`, scoped
  per **proyek**. Bukan log aktivitas sistem-lebar (tidak mencakup
  login, CRUD Master Data, dll) dan tidak lintas-proyek.
- **RLS `document_logs` sengaja permisif** (`USING (true)` /
  `WITH CHECK (true)`, komentar "simplified for MVP, same as
  inspection_logs") — enforcement akses sesungguhnya dilakukan app-side
  lewat `utils/permissions.ts`, bukan RLS. Konvensi ini diikuti sama
  untuk `activity_logs` dan `user_presence` di bawah, demi konsistensi
  dengan pola yang sudah berjalan di seluruh repo.
- **Login/logout selalu lewat server action**
  (`app/auth/login/actions.ts` fungsi `login`/`logout`,
  `app/vendor/login/actions.ts` sepadan) — titik pemanggilan log yang
  bersih, tidak perlu endpoint baru untuk auth event.
- **6 file server action Master Data** sudah ada:
  `app/dashboard/master-data/{account,announcement,project-pgsol-assign,role,role/[id],vendor}/actions.ts`.
  Log aktivitas CRUD dipasang di sini, satu per fungsi mutasi.
- **Permission module** (`app/dashboard/master-data/role/constants.ts`
  + salinan vendor) adalah satu-satunya tempat gerbang akses
  didefinisikan — modul baru `activityLog` masuk pola yang sama persis
  dengan `approval`/`masterData`.
- **Tidak ada test runner** di repo ini (`AGENTS.md`) — verifikasi
  lewat `tsc --noEmit` + `next build` + uji manual, sama seperti semua
  spec sebelumnya.

## Scope

In scope:
- Tabel baru `activity_logs` — aksi di luar alur approval dokumen K3:
  login, logout, CRUD Master Data (vendor/akun/role/proyek-PGSOL-assign/
  pengumuman).
- Tabel baru `user_presence` — satu baris per user, di-upsert oleh
  heartbeat client tiap 60 detik: `current_path` + `last_seen_at`.
- Permission baru `activityLog.view`, `allowedTypes: ['pgn']`.
- Halaman baru `/dashboard/master-data/activity-log`, 2 tab:
  **Pengguna Online** (dari `user_presence`, join `profiles`) dan
  **Riwayat Aktivitas** (gabungan `activity_logs` UNION `document_logs`,
  read-only, tidak ada penulisan ganda).
- Menu sidebar baru "Log Aktivitas" di Master Data, gated permission
  di atas (pola yang sama dengan fix sidebar PGSOL sebelumnya —
  permission DAN kalau relevan org-type, lihat
  `components/internal/sidebar-nav.tsx`).
- Mapping path → label manusiawi untuk kolom "sedang di" (statis,
  di `lib/presence-labels.ts`, fallback ke label generik dari segmen
  URL terakhir kalau path belum dipetakan).

Out of scope:
- **Bukan real-time per klik.** Heartbeat 60 detik — ini adalah
  keputusan eksplisit user (trade-off akurasi vs. beban server), bukan
  limitasi yang harus "diperbaiki" nanti tanpa diminta.
- **`document_logs` tidak diubah sama sekali** — dibaca apa adanya
  lewat UNION di query Riwayat Aktivitas, logika tulisnya (semua
  caller `logDocumentEvent` yang sudah ada) tidak disentuh.
- **Tidak ada retensi/arsip otomatis** di versi ini — `activity_logs`
  dan `document_logs` tumbuh tanpa batas. Paginasi di UI menutupi ini
  untuk sekarang; pembersihan/arsip adalah pekerjaan terpisah kalau
  volumenya jadi masalah nyata.
- **PGSOL dan vendor tidak melihat halaman ini sama sekali** — bukan
  "lihat scoped ke org sendiri". Keputusan eksplisit user.
- **Tidak melacak PERUBAHAN DATA secara rinci (diff before/after)** —
  `activity_logs.notes` cuma ringkasan teks bebas (mis. "Mengubah role
  'pgsol_admin'"), bukan log tiap field yang berubah. Audit level-field
  adalah pekerjaan terpisah jika dibutuhkan nanti.

## Data model

### `activity_logs` (tabel baru, `supabase/schema_activity_log.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,          -- label manusiawi, mis. "Login", "Membuat akun vendor"
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'auth', 'vendor', 'account', 'role', 'project', 'announcement', 'pgsol_assignment'
  )),
  entity_id UUID,                -- nullable: login/logout tidak punya entity_id
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all activity logs"
ON public.activity_logs FOR SELECT USING (true); -- enforcement app-side, sama pola document_logs

CREATE POLICY "Users can insert activity logs"
ON public.activity_logs FOR INSERT WITH CHECK (true);
```

### `user_presence` (tabel baru, file migration sama)

Dipisah dari `profiles` dengan sengaja: baris ini di-UPSERT oleh
**setiap user aktif tiap 60 detik**, jauh lebih sering daripada
mutasi `profiles` normal. Mencampur data presence yang sangat volatile
ke tabel `profiles` yang dibaca di puluhan tempat (dan kemungkinan di-
cache di beberapa query) akan membuat cache invalidation/mutasi tabel
itu lebih ramai dari yang perlu.

```sql
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_path TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all presence"
ON public.user_presence FOR SELECT USING (true);

CREATE POLICY "Users can upsert own presence"
ON public.user_presence FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
ON public.user_presence FOR UPDATE USING (auth.uid() = user_id);
```

Catatan README migration order: file ini **additive, aman dijalankan
ulang** (`CREATE TABLE IF NOT EXISTS`), tidak butuh urutan khusus
relatif ke migration lain — ditambahkan sebagai item baru di
`supabase/README_org_migration_order.md` saat file dibuat.

## Server-side helpers

### `lib/activity-log.ts` (baru, mirror `lib/document-logs.ts`)

```ts
export type ActivityEntityType =
  | 'auth' | 'vendor' | 'account' | 'role' | 'project' | 'announcement' | 'pgsol_assignment';

export async function logActivity(supabase: any, params: {
  actorId?: string | null;
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  notes?: string | null;
}) {
  await supabase.from('activity_logs').insert({
    actor_id: params.actorId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    notes: params.notes ?? null,
  });
}
```

Dipanggil "fire and forget" tapi tetap `await` (konsisten dengan
`logDocumentEvent` existing) — kegagalan insert log TIDAK boleh
menggagalkan aksi utama (bungkus try/catch yang menelan error di
setiap titik panggil, atau terima best-effort kalau Supabase RLS/network
gagal; tidak melempar ke caller).

### `lib/presence.ts` (baru)

```ts
export async function touchPresence(supabase: any, userId: string, path: string) {
  await supabase.from('user_presence').upsert({
    user_id: userId,
    current_path: path,
    last_seen_at: new Date().toISOString(),
  });
}

export function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000; // 2 menit
}
```

### `lib/presence-labels.ts` (baru)

Mapping statis path (prefix match, dari paling spesifik) → label:

```ts
export const PRESENCE_PATH_LABELS: Array<[string, string]> = [
  ['/dashboard/master-data/activity-log', 'Log Aktivitas'],
  ['/dashboard/master-data/vendor', 'Master Data — Vendor'],
  ['/dashboard/master-data/account', 'Master Data — Akun'],
  ['/dashboard/master-data/role', 'Master Data — Role & Permission'],
  ['/dashboard/master-data/project-pgsol-assign', 'Kelola Reviewer PGSOL'],
  ['/dashboard/master-data/project', 'Master Data — Proyek'],
  ['/dashboard/master-data/announcement', 'Master Data — Pengumuman'],
  ['/dashboard/projects', 'Detail Proyek'],
  ['/dashboard/approval', 'Approval K3'],
  ['/dashboard/my-task', 'My Task'],
  ['/dashboard/inspection', 'Inspeksi & Temuan'],
  ['/dashboard/incident', 'Laporan Insiden'],
  ['/dashboard/vendor-docs', 'Dokumen Vendor'],
  ['/dashboard/site-status', 'Status Lapangan'],
  ['/dashboard', 'Dashboard'],
  ['/vendor/dashboard/projects', 'Vendor — Detail Proyek'],
  ['/vendor/dashboard/ptw/create', 'Vendor — Buat PTW'],
  ['/vendor/dashboard/jsa/create', 'Vendor — Buat JSA'],
  ['/vendor/dashboard', 'Vendor — Dashboard'],
];

export function labelForPath(path: string | null): string {
  if (!path) return 'Tidak diketahui';
  const hit = PRESENCE_PATH_LABELS.find(([prefix]) => path.startsWith(prefix));
  if (hit) return hit[1];
  // Fallback: segmen terakhir URL, dibersihkan — tetap bisa dibaca
  // walau belum dipetakan manual.
  const seg = path.split('/').filter(Boolean).pop() || path;
  return seg.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
```

Array di-urut dari path paling spesifik ke paling umum supaya
`startsWith` yang pertama cocok adalah yang paling tepat (mis.
`/dashboard/master-data/vendor` harus ketemu sebelum fallback umum
`/dashboard`).

## Komponen client — heartbeat

### `components/internal/presence-heartbeat.tsx` (baru)

Client component tanpa UI (render `null`), dipasang sekali di root
tiap realm:

```tsx
'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { touchPresenceAction } from '@/app/actions/presence';

export function PresenceHeartbeat() {
  const pathname = usePathname();
  useEffect(() => {
    const ping = () => { touchPresenceAction(pathname).catch(() => {}); };
    ping(); // sekali saat mount/navigasi
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [pathname]);
  return null;
}
```

Dipasang di `app/dashboard/layout.tsx` dan `app/vendor/dashboard/layout.tsx`
(dua-duanya sudah server component yang render shell + children — tambah
`<PresenceHeartbeat />` sejajar sidebar). **Tidak dipasang** di halaman
login/publik — presence cuma relevan untuk user yang sudah autentikasi.

Ping ulang saat `pathname` berubah (navigasi) supaya "sedang di" akurat
tanpa menunggu interval 60 detik penuh kalau user pindah halaman —
interval tetap jalan untuk kasus user diam di satu halaman lama.

### `app/actions/presence.ts` (baru, server action)

```ts
'use server';
import { createClient } from '@/utils/supabase/server';
import { touchPresence } from '@/lib/presence';

export async function touchPresenceAction(path: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await touchPresence(supabase, user.id, path);
}
```

## Titik pemanggilan `logActivity`

Nama fungsi di bawah dikonfirmasi lewat pembacaan langsung tiap file
(2026-10-07) — bukan tebakan dari nama file:

| File | Fungsi | action | entity_type |
|---|---|---|---|
| `app/auth/login/actions.ts` | `login` (setelah redirect check lolos) | "Login" | auth |
| `app/auth/login/actions.ts` | `logout` | "Logout" | auth |
| `app/vendor/login/actions.ts` | fungsi login/logout sepadan | "Login" / "Logout" | auth |
| `app/dashboard/master-data/vendor/actions.ts` | `addVendor` | "Membuat data vendor" | vendor |
| `app/dashboard/master-data/vendor/actions.ts` | `updateVendor` | "Mengubah data vendor" | vendor |
| `app/dashboard/master-data/account/actions.ts` | `addAccount` | "Membuat akun" | account |
| `app/dashboard/master-data/account/actions.ts` | `updateAccount` | "Mengubah akun" | account |
| `app/dashboard/master-data/account/actions.ts` | `suspendAccount` | "Menangguhkan akun" / "Mengaktifkan kembali akun" (sesuai `isSuspended`) | account |
| `app/dashboard/master-data/account/actions.ts` | `resetAccountPassword` | "Reset password akun" | account |
| `app/dashboard/master-data/account/actions.ts` | `deleteAccount` | "Menghapus akun" | account |
| `app/dashboard/master-data/role/actions.ts` | `addRole` | "Membuat role" | role |
| `app/dashboard/master-data/role/actions.ts` | `updateRole` | "Mengubah role" | role |
| `app/dashboard/master-data/role/actions.ts` | `deleteRole` | "Menghapus role" | role |
| `app/dashboard/master-data/role/[id]/actions.ts` | `updateRolePermissions` | "Mengubah permission role" | role |
| `app/dashboard/master-data/project/actions.ts` | `createProject` | "Membuat proyek" | project |
| `app/dashboard/master-data/project-pgsol-assign/actions.ts` | `savePgsolAssignment` | "Mengubah assignment PGSOL" | pgsol_assignment |
| `app/dashboard/master-data/announcement/actions.ts` | `addAnnouncement` | "Membuat pengumuman" | announcement |
| `app/dashboard/master-data/announcement/actions.ts` | `updateAnnouncement` | "Mengubah pengumuman" | announcement |
| `app/dashboard/master-data/announcement/actions.ts` | `deleteAnnouncement` | "Menghapus pengumuman" | announcement |
| `app/dashboard/master-data/announcement/actions.ts` | `toggleAnnouncementActive` | "Mengaktifkan/Menonaktifkan pengumuman" | announcement |

Catatan: **tidak ada `updateProject`** di
`app/dashboard/master-data/project/actions.ts` saat spec ini ditulis —
halaman edit proyek (`app/dashboard/master-data/project/[id]/page.tsx`)
hanya mengelola `AssignmentPanel` (lewat `saveStageAssignment`, modul
approval yang sudah punya audit trail-nya sendiri via
`stage_assignments`, tidak perlu `activity_logs`), bukan form edit
field proyek. Tabel di atas mencantumkan fungsi yang BENAR-BENAR ada,
bukan yang "seharusnya ada" — kalau `updateProject` ditambahkan nanti,
instrumentasinya ikut ditambahkan saat itu, bukan diantisipasi di sini.

`actorId` selalu `auth.getUser()` di dalam action yang sama (pola yang
sudah konsisten dipakai di seluruh action file ini). `entityId` adalah
id baris yang dimutasi (vendor id, account id, dst); untuk login/logout
`entityId` null.

## UI — `/dashboard/master-data/activity-log`

Server component `page.tsx` + client `ActivityLogClient.tsx`, pola
yang sama dengan halaman Master Data lain (`VendorPageClient.tsx` dkk).
Gate di awal `page.tsx`: `hasPermission('activityLog', 'view')` →
`notFound()`/redirect kalau tidak punya, sama seperti
`project-pgsol-assign/layout.tsx`.

### Tab "Pengguna Online"

Query: `user_presence` join `profiles(full_name, type, jabatan)`,
filter `last_seen_at > now() - interval '2 minutes'` (atau ambil semua
lalu filter `isOnline()` di server component — volumenya kecil, tidak
perlu query time-window kalau jumlah user masih puluhan-ratusan).
Urut `last_seen_at DESC`. Tiap baris: nama, badge tipe org
(PGN/PGSOL/Vendor), `labelForPath(current_path)`, "X menit lalu".

Auto-refresh: client component poll ulang tiap 30 detik lewat
`router.refresh()` atau re-fetch — daftar online berubah dalam skala
menit, bukan detik, jadi polling ringan ini cukup.

### Tab "Riwayat Aktivitas"

Query gabungan dua tabel, dilakukan di server (dua `select` lalu
`[...a, ...b].sort(by created_at desc)` di JS — lebih sederhana dan
portable daripada SQL `UNION` lintas tabel dengan kolom berbeda, dan
volumenya per halaman kecil karena dipaginasi):

```ts
async function getActivityFeed(supabase, { limit = 50, before }: { limit?: number; before?: string }) {
  const [{ data: activity }, { data: docs }] = await Promise.all([
    supabase.from('activity_logs').select('*, profiles(full_name, jabatan, type)')
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('document_logs').select('*, profiles(full_name, jabatan, type)')
      .order('created_at', { ascending: false }).limit(limit),
  ]);
  return [...(activity ?? []), ...(docs ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
```

Paginasi "muat lebih banyak" lewat cursor `created_at` (`before`
param) dioper ke kedua query sebagai `.lt('created_at', before)` —
ditambahkan begitu dibutuhkan; untuk versi pertama cukup tombol "Muat
50 lagi" yang menaikkan `limit`.

Setiap baris tampil: ikon beda per `entity_type`/`doc_type`, label
aksi, nama+jabatan aktor, waktu relatif — visual mengikuti pola kartu
log yang sudah ada di tab "Riwayat" `AdminProjectClient.tsx`
(`docLogTone`/`docLogIcon`), diperluas untuk entity type baru.

## Permission & menu

`app/dashboard/master-data/role/constants.ts` (dan salinan vendor —
walau vendor tidak pernah dapat izin ini, konsistensi struktur modul
dipertahankan sama seperti modul `approval` yang juga ada di kedua
file):

```ts
{
  id: 'activityLog',
  title: 'Log Aktivitas',
  description: 'Riwayat aktivitas sistem dan daftar pengguna yang sedang online.',
  items: [
    { key: 'view', label: 'Melihat Log Aktivitas & Pengguna Online', allowedTypes: ['pgn'] },
  ]
}
```

Menu sidebar baru di `components/internal/sidebar-nav.tsx`, grup
Master Data, filter permission `masterData`-sejenis tapi modul
`activityLog` — **tidak** butuh `requiresOrgType` (permission
`allowedTypes: ['pgn']` sudah cukup membatasi; beda dengan kasus
PGSOL-assign yang permission-nya tidak eksklusif PGN tapi halamannya
eksklusif PGSOL).

## Error handling / edge cases

- **Insert `activity_logs`/`user_presence` gagal** (network, RLS
  salah konfig): dibungkus try/catch di tiap titik panggil, tidak
  pernah melempar ke caller — login/CRUD/logout tetap berhasil walau
  logging gagal. Prioritas: aksi utama tidak boleh gagal karena
  side-effect logging.
- **User belum pernah login setelah fitur ini deploy**: tidak ada
  baris `user_presence` → tidak muncul di tab Online sampai heartbeat
  pertama jalan (login berikutnya). Tidak dianggap bug.
- **`current_path` berisi path yang belum dipetakan**
  `PRESENCE_PATH_LABELS`: fallback ke label dari segmen URL terakhir,
  tidak pernah kosong/crash.
- **Tab browser dibiarkan terbuka semalaman tanpa interaksi**:
  `setInterval` tetap jalan selama tab tidak di-suspend browser (sama
  limitasi semua heartbeat berbasis `setInterval`) — kalau OS
  men-suspend tab background lama, `last_seen_at` akan basi dan user
  otomatis dianggap offline setelah 2 menit, yang sebenarnya benar
  secara perilaku (dia memang tidak aktif).
- **Dua tab terbuka di path berbeda**: baris `user_presence` di-
  upsert (bukan insert per-tab), jadi `current_path` akan mengikuti
  tab mana pun yang terakhir ping — user tetap muncul SATU baris,
  path-nya "goyang" antara dua tab. Diterima sebagai limitasi minor,
  tidak diatasi di versi ini (butuh tracking per-session/tab yang
  menambah kompleksitas tidak proporsional dengan manfaatnya).

## Testing

Tidak ada test runner di repo ini. Verifikasi:
`node node_modules/typescript/bin/tsc --noEmit`,
`node node_modules/next/dist/bin/next build`.

Uji manual:
1. Jalankan `schema_activity_log.sql` di Supabase SQL editor (dan
   catat statusnya di `README_org_migration_order.md`).
2. Login sebagai PGN admin → cek baris baru di `activity_logs`
   (`entity_type = 'auth'`) dan `user_presence` muncul.
3. Buka beberapa halaman Master Data berbeda, tunggu >60 detik di
   satu halaman → tab Pengguna Online (buka di browser/user lain)
   menunjukkan "sedang di: <label halaman>" yang sesuai.
4. Tutup tab, tunggu >2 menit → user tadi hilang dari daftar Online.
5. Create/edit vendor, akun, role, proyek, pengumuman → tiap aksi
   muncul di tab Riwayat Aktivitas dengan label yang sesuai, dan tetap
   terurut kronologis bersama entri `document_logs` yang sudah ada
   (approve/reject Prosedur/JSA/PTW tetap nampil campur, terurut
   benar).
6. Login sebagai PGSOL admin / vendor → menu "Log Aktivitas" tidak
   muncul di sidebar, dan akses langsung ke
   `/dashboard/master-data/activity-log` lewat URL ditolak
   (redirect/404), bukan cuma disembunyikan dari menu.
7. Login sebagai PGN admin dengan role custom yang BELUM dicentang
   `activityLog.view` → sama seperti poin 6 (permission baru tidak
   otomatis dimiliki role selain `admin` bawaan — perlu dicentang
   manual di Role & Permission, dicatat juga di laporan akhir ke
   user sebagai reminder, sama seperti permission `hsse_pgn` yang
   ditambahkan sebelumnya).

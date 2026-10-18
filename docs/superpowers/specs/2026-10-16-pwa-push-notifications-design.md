# 2026-10-16 — Notifikasi Web Push (PWA)

Status: diimplementasikan 2026-10-16.

## Tujuan

Pengguna yang memasang RACHEL K3 sebagai PWA di HP menerima **notifikasi
perangkat** — muncul di notification tray / lock screen **walau aplikasi
ditutup**, dan saat ditap membuka aplikasi pada halaman terkait. Ini
kategori yang sama dengan notifikasi WhatsApp/Instagram, bukan lonceng
in-app yang cuma tampil kalau aplikasi dibuka.

## Keputusan

- **Cakupan**: SEMUA notifikasi in-app ikut dipush (tipe `approval`,
  `action_required`, `warning`, `system`, `info`), menghormati
  `notification_preferences.muted_types` per pengguna. Penerima tidak diubah
  — push mengikuti siapa pun yang sudah menjadi penerima notifikasi in-app.
- **Tidak ada dependensi engine baru**: memakai package `web-push` (VAPID +
  enkripsi payload). Tanpa `web-push`, VAPID/enkripsi harus ditulis manual
  (rawan).
- **Titik sambung tunggal**: semua notifikasi in-app dibuat lewat satu helper
  `insertNotificationsWithPush()` di `lib/push.ts`, yang menyisipkan baris
  `notifications` lalu menjadwalkan push. Jadi tidak ada push yang tertinggal
  di call site mana pun (sekarang maupun nanti).

## Arsitektur

```
Klien (dropdown lonceng)
  components/pwa/push-toggle.tsx
    → Notification.requestPermission()
    → pushManager.subscribe(NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    → savePushSubscription()  [server action]

Server Action
  app/dashboard/inbox/push-actions.ts
    → createClient().auth.getUser()  (verifikasi identitas)
    → createAdminClient().from('push_subscriptions').upsert({...}, onConflict: 'endpoint')

Pembuatan notifikasi (server)
  app/dashboard/inbox/actions.ts      (createNotification, notifyOrgMembers,
                                       notifyUsersByRole, notifyUsersByPermission,
                                       notifyAssignees)
  lib/assignment-notify.ts
  app/checkin/[token]/actions.ts
    → insertNotificationsWithPush()   [lib/push.ts]
        ├─ insert ke tabel `notifications`
        └─ schedulePush(userIds, payload)  → next/server `after()` → sendPush()
              → buang penerima yang mem-mute tipe tsb
              → ambil push_subscriptions penerima (service role)
              → webpush.sendNotification() per langganan
              → hapus langganan yang balas 404/410 (mati)

Service Worker
  public/sw.js
    → event 'push'                : registration.showNotification(title, {...})
    → event 'notificationclick'   : fokus tab yang ada / openWindow(url notifikasi)
```

`after()` (stabil sejak Next 15.1) dipakai supaya pengiriman push **tidak
memperlambat** Server Action; kegagalan push selalu ditelan (best-effort) dan
tidak menggagalkan alur pemanggil.

## Skema

`supabase/schema_push_subscriptions.sql` — satu baris per perangkat/browser:

| kolom | catatan |
| --- | --- |
| `user_id` | FK `profiles(id)` ON DELETE CASCADE |
| `endpoint` | UNIQUE — aktivasi ulang perangkat sama tidak menumpuk |
| `p256dh`, `auth` | kunci langganan |
| `user_agent`, `created_at`, `last_seen_at` | metadata |

RLS: pengguna hanya boleh baca/ubah baris miliknya. Penulisan saat aktivasi &
pembacaan saat kirim lewat **service role** (`createAdminClient`), karena satu
`endpoint` bisa berpindah pemilik saat akun berganti di perangkat yang sama.

## Env

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — dipakai klien saat subscribe (di-inline saat
  build; ubah berarti perlu redeploy).
- `VAPID_PRIVATE_KEY` — server, rahasia.
- `VAPID_SUBJECT` — `mailto:` kontak pengirim.

Generate: `npx web-push generate-vapid-keys`. Set di `.env.local` dan di Vercel
(Production + Preview). Tanpa ketiganya, push nonaktif total dan tombol
aktivasi tidak dirender.

## Batasan yang disadari (bukan bug)

- **HTTPS wajib.** Tidak jalan di `http://` LAN; harus deploy (Vercel) atau
  localhost.
- **iOS**: Web Push hanya dari iOS 16.4+ **dan hanya untuk PWA yang sudah
  ditambahkan ke Layar Utama**. Di Safari biasa, komponen menampilkan petunjuk
  "Tambahkan ke Layar Utama".
- **Izin harus lewat gesture** pengguna — tidak bisa otomatis. Kalau pernah
  diblokir, hanya bisa diaktifkan lagi dari setelan situs di browser.
- **Suara/badge/persistensi** ditentukan OS. Kami set `vibrate`, `icon`,
  `badge`, dan `tag` (agar notifikasi sejenis menggantikan, bukan menumpuk),
  tapi tidak bisa memaksa suara kustom atau perilaku seperti panggilan.
- Service worker hanya didaftarkan di **produksi**; karena itu tombol aktivasi
  disembunyikan saat `next dev`.

## Verifikasi

- `node --check public/sw.js`
- `tsc --noEmit`, ESLint, `npm run build`
- Manual di Vercel: pasang PWA → buka lonceng → "Aktifkan" → izinkan → picu
  notifikasi (mis. tugaskan approver / buat inspeksi) → pastikan muncul di
  tray dan tap membuka halaman `link` yang benar.

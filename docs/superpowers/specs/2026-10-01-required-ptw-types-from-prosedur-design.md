# Jenis PTW yang Dibutuhkan — checklist di Prosedur, auto-highlight di PTW — design

## Origin

Permintaan user, 2026-10-01: vendor saat ini memilih jenis PTW (dari 10
pilihan di `/vendor/dashboard/ptw/create/[projectId]`) secara manual
tanpa panduan — padahal jenis pekerjaan yang butuh PTW apa saja
sebetulnya sudah bisa diketahui sejak Prosedur Kerja disusun. User
minta ini "auto kepilih" dari kebutuhan yang sudah diisi.

Ini salah satu dari 3 fitur PTW yang diminta dalam satu sesi (ditulis
terpisah per-fitur, bukan satu spec besar): checklist jenis PTW ini
(dikerjakan pertama, atas pilihan user), Safety Checklist PTW
diperkaya (foto + paraf + redesign), dan Perpanjangan PTW. Spec
`2026-09-28-prosedur-sumber-bahaya-chain-design.md` (sudah merge,
`9296c71`) eksplisit menyebut Perpanjangan PTW sebagai pekerjaan
terpisah setelahnya — konsisten dengan urutan yang dipilih user.

## Temuan yang mendasari desain ini

- **`procedures` 1 baris per `project_id`** (`saveProsedur` query
  `.eq('project_id', projectId).single()`) — bukan banyak revisi
  sebagai baris terpisah, jadi field baru di `content` otomatis
  "yang terbaru" tanpa perlu join tambahan.
- **Rantai kebutuhan/bahaya per sub-langkah sudah ada dan sudah
  merge** (`lib/procedure-kebutuhan.ts`, `jsa_steps.kebutuhan`,
  prefill PTW) — tapi itu level BUTIR per bullet (pekerja, alat,
  APD, bahaya generik), bukan level DOKUMEN "jenis PTW apa saja yang
  wajib diajukan". Dua konsep berbeda, tidak saling menggantikan.
- **`HAZARD_COLUMNS` (23 item bahaya generik) tidak bisa dipakai
  untuk menurunkan jenis PTW secara otomatis** — dicek satu per satu:
  "Bekerja diketinggian" dan "Ruang Tetutup" punya padanan jelas
  (Ketinggian, Ruang Terbatas), tapi Penggalian, Radiografi, Kamera,
  dan Dingin tidak punya padanan item bahaya sama sekali di daftar
  itu. Checklist eksplisit 1:1 ke `PTW_TYPES` lebih akurat.
- **Halaman PTW list** (`/vendor/dashboard/ptw/create/[id]/page.tsx`)
  sudah render ke-10 `PTW_TYPES` sebagai kartu `<Link>` dengan status
  badge per jenis (`rowFor`/`statusBadge`) — tinggal ditambah
  penanda "wajib" di kartu yang sama, tidak perlu struktur baru.
- **`ProsedurPDF.tsx` sengaja tidak pernah disentuh** oleh fitur
  sejenis sebelumnya (keputusan eksplisit di spec 2026-09-28) —
  field baru ini mengikuti pola yang sama: app-only, tidak dicetak.

## Scope

In scope:
- Field baru level-dokumen (bukan per sub-langkah) di Prosedur:
  `content.requiredPtwTypes: PtwType[]`.
- Checklist pilih jenis PTW di form Prosedur vendor, wajib minimal 1
  sebelum submit.
- Halaman PTW list baca field ini dari Prosedur proyek, kasih badge
  "Wajib" + taruh di atas pada jenis yang kecentang — **tidak**
  menyembunyikan jenis lain (vendor tetap bisa ajukan PTW jenis apa
  pun di luar yang ditandai, sesuai teks halaman yang sudah ada:
  "Satu pekerjaan bisa membutuhkan lebih dari satu jenis izin kerja
  sekaligus").

Out of scope:
- **`ProsedurPDF.tsx` tidak berubah** — field ini tidak dicetak,
  konsisten dengan keputusan 2026-09-28.
- **JSA tidak disentuh** — JSA tidak perlu re-select apa pun, PTW
  baca langsung dari Prosedur (1 baris per proyek, tidak perlu
  perantara JSA).
- **Halaman review internal Prosedur** (`ProsedurDetailClient.tsx`)
  tidak diubah — field ini hanya dipakai di sisi vendor (pilih) dan
  PTW list (konsumsi). Reviewer internal (PM/PGSOL) tetap approve
  Prosedur lewat alur yang sama persis seperti sekarang; menambah
  tampilan field ini ke layar reviewer adalah follow-up terpisah
  kalau dibutuhkan nanti, bukan bagian dari permintaan user kali ini.
- **Tidak ada migration** — `procedures.content` JSONB bebas, sama
  seperti field `hazards` dan `tahapanPekerjaan[].kebutuhan`
  sebelumnya.
- **Tidak ada perubahan permission/RLS** — gerbang akses Prosedur
  (org-scoped + stage-gated `procedure.review_vendor`) dan PTW
  (`APPROVED_JSA` sebelum bisa buat PTW) tetap sama persis.

## Data model

Tidak ada migration. `content.requiredPtwTypes` ditambahkan ke objek
`content` JSONB Prosedur yang sudah ada, bertipe `PtwType[]` (subset
dari 10 `PtwType` yang sudah didefinisikan di `lib/ptw-types.ts`).
Baris lama tanpa field ini terbaca sebagai `[]` lewat default state —
sama pola dengan `content.hazards`/`tahapanPekerjaan` legacy.

## UI — Form Prosedur (`app/vendor/dashboard/projects/[id]/prosedur/page.tsx`)

Blok checklist baru "Jenis PTW yang Dibutuhkan" ditaruh di **Section
A: Administrasi** (dekat info dokumen, sebelum Tahapan Pekerjaan) —
field ini mengklasifikasikan seluruh pekerjaan, bukan satu
sub-langkah, jadi ditaruh di bagian administrasi/ringkasan dokumen,
bukan di panel "Kebutuhan" per bullet yang sudah ada.

Grid kartu checkbox, satu per `PTW_TYPES` entry, memakai `type.color`
untuk aksen warna (konsisten visual dengan kartu di halaman PTW
list) dan `type.title.split('(')[0].trim()` untuk label pendek
(pola yang sama dipakai halaman PTW list).

State: `const [requiredPtwTypes, setRequiredPtwTypes] = useState<PtwType[]>([])`,
dimuat dari `content.requiredPtwTypes` di `useEffect` load yang sudah
ada (sejajar `tahapanPekerjaan`), toggle lewat fungsi
`togglePtwType(type: PtwType)` (tambah/hapus dari array), dan masuk
`payload` di `handleSubmit` sebagai `requiredPtwTypes`.

**Validasi**: minimal 1 jenis wajib dipilih sebelum submit — kalau
kosong, `handleSubmit` berhenti di awal dengan `alert('Pilih minimal
satu jenis PTW yang dibutuhkan untuk pekerjaan ini.')`, pola yang
sama dengan penanganan error submit yang sudah ada di fungsi itu.

## UI — Halaman PTW list (`app/vendor/dashboard/ptw/create/[id]/page.tsx`)

Server action baru di `app/vendor/dashboard/ptw/create/[id]/actions.ts`:

```ts
export async function getRequiredPtwTypes(projectId: string): Promise<PtwType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('procedures')
    .select('content')
    .eq('project_id', projectId)
    .maybeSingle();
  return (data?.content?.requiredPtwTypes as PtwType[]) || [];
}
```

Dipanggil sejajar `getPtwList(projectId)` di `useEffect` halaman.
`PTW_TYPES.map(type => ...)` yang sudah ada diurutkan ulang supaya
jenis yang ada di `requiredPtwTypes` muncul duluan (`.sort()` stabil
berdasarkan keanggotaan di set tersebut, urutan asli `PTW_TYPES`
dipertahankan di dalam masing-masing kelompok wajib/tidak-wajib),
dan kartu yang wajib dapat badge kecil "Wajib" (latar `${type.color}20`,
teks `text-slate-700` tetap — bukan `type.color` sebagai teks, karena
beberapa jenis PTW punya warna terang/pucat yang bikin teks nyaris tak
kebaca di atas tint-nya sendiri; pola ini konsisten dengan badge status
yang sudah ada di kartu yang sama, yang juga pakai teks gelap tetap di
atas tint lembut).
Jenis yang sudah punya baris PTW (`rowFor(type.id)`) tetap tampil
status badge-nya seperti sekarang — badge "Wajib" dan status PTW
baris itu tampil berdampingan, tidak saling menggantikan.

## Error handling / edge cases

- **Prosedur legacy / belum pernah disimpan ulang**: `requiredPtwTypes`
  terbaca `[]` → halaman PTW list tidak menampilkan badge "Wajib"
  sama sekali, seluruh 10 jenis tampil setara seperti perilaku hari
  ini. Tidak ada regresi untuk proyek lama.
- **Proyek belum punya Prosedur sama sekali** (kasus langka, PTW
  mestinya baru bisa dibuat setelah JSA Approved yang mensyaratkan
  Prosedur Approved lebih dulu): `getRequiredPtwTypes` mengembalikan
  `[]` lewat `maybeSingle()` yang `null`, sama seperti kasus legacy
  di atas.
- **Vendor mencentang lalu melepas semua lagi**: validasi submit
  Prosedur mencegah ini tersimpan sebagai array kosong untuk Prosedur
  BARU; Prosedur yang sudah pernah tersimpan dengan field ini terisi
  lalu direvisi vendor jadi kosong juga akan tertahan oleh validasi
  yang sama (validasi jalan di setiap submit, bukan cuma submit
  pertama).

## Testing

Tidak ada test runner di repo ini. Verifikasi: `node
node_modules/typescript/bin/tsc --noEmit`, `node
node_modules/next/dist/bin/next build`.

Uji manual berurutan:
1. Buka Prosedur proyek lama (belum punya `requiredPtwTypes`) →
   checklist baru tampil kosong, bukan error.
2. Centang 2-3 jenis PTW di Prosedur → submit tanpa centang apa pun
   dulu → muncul alert validasi, submit tertahan.
3. Centang minimal 1 → submit berhasil → buka ulang form Prosedur →
   centangan tersimpan persis.
4. Buka halaman PTW list proyek itu → jenis yang dicentang di
   Prosedur muncul duluan dengan badge "Wajib"; jenis lain tetap
   tampil & tetap bisa diklik untuk diajukan.
5. Proyek lain yang Prosedur-nya belum pernah disentuh fitur ini →
   halaman PTW list tampil seperti sebelumnya, tanpa badge "Wajib"
   di mana pun.

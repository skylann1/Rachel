# Sumber bahaya masuk rantai prosedur → JSA → PTW, JSA jadi titik filter — design

Date: 2026-09-28

Lanjutan langsung dari `2026-09-23-prosedur-kebutuhan-ptw-prefill-design.md`. Baca
spec itu dulu — rantai `prosedur → JSA → PTW` beserta `lib/procedure-kebutuhan.ts`
sudah ada dan tidak dirombak di sini, hanya diperluas.

## Problem

Rantai kebutuhan per sub-langkah yang dibangun 2026-09-23 membawa **pekerja,
peralatan, material, dan APD** dari tiap bullet TAHAPAN PEKERJAAN ke langkah JSA
lalu jadi prefill form PTW. Tiga hal masih kurang:

1. **Sumber bahaya belum ikut.** `ptw.hazards` masih dipilih dari nol di form PTW
   dari daftar 40+ butir (`HAZARD_COLUMNS`), padahal bahaya tiap sub-langkah sudah
   diketahui sejak prosedur disusun.
2. **Section 3/4/5 prosedur (`ALAT / TOOLS`, `APD`, `PERLENGKAPAN LAINNYA`) jadi
   input ganda.** Vendor mengetik ulang hal yang sudah dia pilih per sub-langkah di
   section 6, dan dua sumber itu bisa saling bertentangan.
3. **JSA cuma memajang, tidak menyaring.** Kebutuhan tampil sebagai chip mati; tidak
   ada tempat buat bilang "butir ini sebenarnya tidak dipakai di langkah ini", jadi
   PTW selalu menerima union mentah seluruh prosedur.

Efeknya di PTW: vendor menghadapi roster penuh dengan sebagian tercentang, bukan
daftar ringkas yang tinggal dikonfirmasi.

## Scope

In scope:

- `hazards` sebagai field kelima `StepKebutuhan`, dipilih per bullet di prosedur,
  ikut teragregasi ke langkah JSA dan ke prefill PTW.
- Section 3/4/5 prosedur berhenti jadi input manual; nilainya diturunkan otomatis
  dari agregat sub-langkah dan ditulis ke key `content` yang sama seperti sekarang.
- JSA jadi titik filter: kebutuhan tampil sebagai checkbox, hasil centangannya yang
  disimpan dan yang mengalir ke PTW.
- Form PTW default menampilkan **hanya** butir hasil JSA (pekerja, peralatan, APD,
  sumber bahaya) dalam keadaan tercentang, dengan toggle "Tampilkan semua".

Out of scope:

- **Format dan penomoran dokumen tidak berubah.** Prosedur tetap section 1–7
  dengan judul dan urutan yang sama; tidak ada berkas `*PDF.tsx` yang diedit.
  Batasan eksplisit dari user, bukan kelalaian. Satu-satunya perubahan isi yang
  disengaja dan sudah disetujui: baris `Kebutuhan:` yang sudah ada di bawah tiap
  bullet (prosedur) dan tiap langkah (JSA) bertambah segmen `Bahaya: …`. PTW PDF
  benar-benar nol perubahan.
- Material tetap tidak masuk PTW (tidak ada slot-nya) — sama seperti spec 2026-09-23.
- Tidak ada permission key baru, tidak ada perubahan RLS, tidak ada perubahan alur
  approval.
- Perpanjangan / reaktivasi PTW — pekerjaan terpisah, dispek sendiri setelah ini.

## Data model

### `StepKebutuhan` + `hazards` (tanpa migration)

```ts
type StepKebutuhan = {
  workers: KebutuhanResource[];
  equipment: KebutuhanResource[];
  materials: KebutuhanResource[];
  apd: Record<string, string[]>;
  hazards: string[];          // BARU
};
```

`hazards` sengaja `string[]`, bukan `KebutuhanResource[]` seperti pekerja/peralatan:
daftar bahaya adalah konstanta kode (`HAZARD_COLUMNS` di `lib/ptw-types.ts`), bukan
baris master data milik vendor, dan `ptw.hazards` memang sudah disimpan sebagai
array string. Identitas butir = string-nya persis, jadi pencocokan ke form PTW
sepele.

Tidak ada migration. `content.tahapanPekerjaan` adalah JSONB app-defined, dan
`jsa_steps.kebutuhan` sudah JSONB sejak `schema_jsa_step_kebutuhan.sql`. Baris lama
yang belum punya key `hazards` terbaca sebagai `[]` lewat spread `emptyKebutuhan()`
yang sudah dipakai `normalizeTahapanPekerjaan()`.

### Section 3/4/5 prosedur: key sama, sumber beda

`content.tools`, `content.apd`, `content.perlengkapanLainnya` **tetap ada dan tetap
ditulis** oleh `saveProsedur`. Yang berubah cuma asal nilainya — bukan lagi state
input manual, melainkan turunan agregat seluruh sub-langkah:

| Key `content` | Section dokumen | Sumber baru |
|---|---|---|
| `tools` | 3. ALAT / TOOLS | `aggregate.equipment` → `.label` |
| `apd` | 4. ALAT PELINDUNG DIRI | `Object.values(aggregate.apd).flat()` |
| `perlengkapanLainnya` | 5. PERLENGKAPAN LAINNYA | `aggregate.materials` → `.label` |

Konsekuensi yang disengaja: `ProsedurPDF.tsx` **tidak diubah satu baris pun** —
dia terus membaca tiga key yang sama dengan bentuk yang sama (`string[]`).
Dokumen lama yang tidak pernah di-save ulang tetap mencetak nilai ketikan
lamanya. Dokumen lama yang di-save ulang otomatis ikut memakai nilai turunan,
yang memang lebih benar karena mencerminkan sub-langkahnya.

Satu pergeseran kosakata yang perlu diketahui: APD turunan memakai vokabuler
`APD_ITEMS` milik PTW (`Safety Shoes/Boot`, `Cotton Glove`, …), sedangkan input
lama memakai daftar pendek sendiri (`Safety Shoes`, `Safety Gloves`, …). Format
dokumen tidak berubah — hanya istilah butirnya jadi seragam dengan PTW, dan itu
justru yang diinginkan.

## Perubahan `lib/procedure-kebutuhan.ts`

Semua perubahan lib terkurung di satu berkas dan murni pure function:

- `emptyKebutuhan()` → tambah `hazards: []`.
- `aggregateKebutuhan()` → union `hazards`, dedupe by string (urutan kemunculan
  pertama dipertahankan, konsisten dengan `dedupeResources`).
- `isKebutuhanEmpty()` → ikut memeriksa `hazards.length`.
- `kebutuhanSummary()` → tambah segmen `Bahaya: a, b` di akhir baris.
- **Baru** `hasStoredKebutuhan(raw: unknown): boolean` — `true` kalau `raw` objek
  non-null dengan minimal satu own key. Dipakai JSA buat membedakan "belum pernah
  disimpan" dari "disimpan dalam keadaan kosong". Lihat bagian JSA.
- **Baru** `deriveDocumentSections(sections: TahapanSection[])` →
  `{ tools: string[]; apd: string[]; perlengkapanLainnya: string[] }`. Membungkus
  agregasi seluruh sub-langkah jadi tiga array `string[]` siap pakai untuk key
  `content` section 3/4/5 (lihat tabel di bagian Data model). Satu-satunya sumber
  nilai turunan itu — dipakai bersama oleh kotak ringkasan read-only di form,
  `payload` di `handleSubmit`, dan binding preview PDF di halaman, supaya ketiganya
  mustahil berbeda.

`kebutuhanSummary()` adalah satu-satunya perender kebutuhan di **kedua** PDF
(`ProsedurPDF.tsx:356`, `JsaPDF.tsx:584`). Menambah bahaya di situ membuat bahaya
muncul di dokumen prosedur dan JSA tanpa mengubah berkas PDF mana pun — sesuai
keputusan "ikut di baris Kebutuhan yang sudah ada".

## UI

### Prosedur (`app/vendor/dashboard/projects/[id]/prosedur/page.tsx`)

Panel "Kebutuhan" yang sudah ada per bullet (collapsible, `openKebutuhan`) dapat
blok kelima **Sumber Bahaya**: checkbox bergrup 6 kolom memakai `HAZARD_COLUMNS`.
Dipakai daftar dasar, bukan `hazardColumnsFor(type)` — prosedur tidak terikat satu
tipe PTW. Hitungan `kebutuhanCount` ikut menghitung `hazards.length`.

Section 3/4/5 berhenti jadi input. Judul dan urutannya tetap di halaman (biar vendor
mengenali dokumennya), tapi isinya jadi kotak ringkasan read-only berisi hasil
agregat berjalan plus keterangan "Terisi otomatis dari Tahapan Pekerjaan". State
`tools` / `toolInput` / `selectedApd` / `perlengkapanLainnya` / `perlengkapanInput`
beserta `handleAddStringItem` / `removeStringItem` / `toggleApd` lama dihapus; konstanta
`apdList` dan ikon-ikonnya ikut hilang.

`payload` di `handleSubmit` tetap punya ketiga key, diisi dari
`deriveDocumentSections()` — helper yang sama yang mengisi kotak ringkasan read-only
dan binding preview PDF di halaman (baris 332–333), supaya apa yang dilihat vendor
persis yang tersimpan dan persis yang tercetak.

### JSA (`app/vendor/dashboard/jsa/create/[id]/page.tsx`)

Kebutuhan tiap langkah berubah dari chip mati jadi **checkbox** — pekerja,
peralatan, material, APD, dan sumber bahaya. Kandidat yang ditampilkan dibaca
**live** dari prosedur (`aggregatePointNeeds(data.procedureSections[idx].points)`);
keadaan tercentang datang dari `jsa_steps.kebutuhan` yang tersimpan. Hasil centangan
itulah yang di-`saveJsa` (`actions.ts:95` sudah memetakan `kebutuhan: step.kebutuhan ?? {}`,
tidak berubah).

**Perbaikan bug yang wajib ikut.** Kode sekarang (`page.tsx:97`) menyemai ulang dari
prosedur setiap kali `isKebutuhanEmpty(stored)` bernilai true. Begitu vendor boleh
mencentang-lepas, "kosong karena sengaja" tidak bisa dibedakan dari "kosong karena
belum pernah diisi", sehingga centangan yang dilepas akan muncul lagi tiap reload.
Gantinya: semai ulang **hanya kalau `!hasStoredKebutuhan(stored)`** — yaitu objek
tersimpan benar-benar tanpa key (`{}`, nilai default kolom). Objek yang array-nya
kebetulan kosong dihormati apa adanya. Tidak perlu kolom atau migration baru.

Perilaku yang disengaja: kalau prosedur direvisi setelah JSA tersimpan, butir baru
muncul di JSA dalam keadaan **tidak tercentang** dan harus dicentang manual. Ini
benar — revisi prosedur memang mengharuskan JSA ditinjau ulang, dan JSA yang sudah
disetujui tidak boleh diam-diam berubah isinya.

### PTW (`app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx` + `../actions.ts`)

`getJsaPrefillNeeds()` ikut mengembalikan `hazards` (otomatis, karena dia
mengembalikan `aggregateStepNeeds()` utuh).

Tiap blok pilihan — Pekerja, Peralatan, APD, Sumber Bahaya — punya dua mode:

- **Ringkas (default):** hanya butir hasil JSA, semuanya tercentang. Vendor tinggal
  melepas yang tidak dipakai.
- **Lengkap:** roster/daftar penuh seperti sekarang, dibuka lewat toggle
  "Tampilkan semua" di header blok. Murni state UI lokal, tidak disimpan.

Kalau prefill untuk sebuah blok kosong (proyek lama, JSA tanpa kebutuhan), blok itu
langsung jatuh ke mode lengkap — kalau tidak, form-nya kosong dan vendor buntu.
Badge "dari JSA" yang sudah ada (`jsaPrefillIds`) tetap dipakai di mode lengkap
untuk menandai mana yang berasal dari JSA.

Precedence `loadData()` tidak berubah: revisi PTW yang sudah punya baris tetap
menang atas prefill.

`ptwType === 'panas'` memakai `HAZARD_COLUMNS_PANAS`, yang menukar butir kedua
(`Akses Sulit` menggantikan `Api Terbuka / Percikan`). Bahaya dari prosedur yang
tidak ada di daftar tipe tersebut dilewati diam-diam — tidak error, hanya tidak
tercentang, dan tetap bisa dipilih manual di mode lengkap.

## Access control

Tidak ada perubahan. Gerbang yang berlaku tetap sama persis seperti spec
2026-09-23: prosedur org-scoped lewat RLS `procedures` dan stage-gated lewat
`procedure.review_vendor`; picker master data org-scoped lewat
`getCallerVendorOrgId()`; pembuatan PTW tetap menuntut JSA `Approved`
(`APPROVED_JSA`, `lib/project-stage.ts`, dipaksakan di `savePtw`). Tidak ada
permission key baru, tidak ada policy baru.

## Migration

**Tidak ada.** Seluruh perubahan bentuk data terjadi di dalam kolom JSONB yang sudah
ada (`procedures.content`, `jsa_steps.kebutuhan`). Tidak ada berkas
`supabase/schema_*.sql` baru dan tidak ada catatan README urutan migrasi.

## Error handling / edge cases

- **Prosedur legacy** (`points: string[]`, tanpa `kebutuhan`): `normalizeTahapanPekerjaan()`
  menormalkan seperti sekarang; `hazards` terbaca `[]`.
- **Prosedur lama yang tidak pernah di-save ulang:** section 3/4/5 tetap mencetak
  nilai ketikan lamanya karena key `content`-nya tidak tersentuh.
- **Prosedur lama yang di-save ulang tanpa mengisi kebutuhan apa pun:** section 3/4/5
  jadi kosong dan PDF mencetak baris "Tidak ada …" yang memang sudah ada
  penanganannya (`ProsedurPDF.tsx:311/323/336`). Perilaku yang jujur — dokumennya
  memang tidak lagi menyebut alat apa pun.
- **JSA legacy** (`kebutuhan` = `{}`): `hasStoredKebutuhan()` false → disemai dari
  prosedur, seluruhnya tercentang. Sama seperti perilaku hari ini.
- **JSA yang semua butirnya dilepas vendor:** tersimpan sebagai objek berisi array
  kosong → `hasStoredKebutuhan()` true → dihormati, tidak disemai ulang. Ini
  justru bug yang diperbaiki.
- **Bahaya duplikat** lintas bullet atau lintas langkah: di-dedupe by string oleh
  `aggregateKebutuhan()`.
- **Bahaya tidak dikenal tipe PTW** (kasus `panas`): dilewati saat prefill.
- **Baris master dihapus setelah prosedur disimpan:** tidak berubah — snapshot
  `{id,label}` menjaga prosedur tetap kebaca, prefill PTW melewati id yang hilang.
- **PTW revisi:** prefill tetap sengaja dilewati, baris tersimpan yang menang.

## Testing

Repo ini tidak punya test runner. Verifikasi: `npx tsc --noEmit`, `npm run lint`
pada berkas tersentuh, lalu `npm run build`.

Uji manual berurutan:

1. Buka prosedur lama (points masih string) → masih kebaca; section 3/4/5 tampil
   read-only berisi nilai lama; PDF-nya identik dengan sebelum perubahan.
2. Isi kebutuhan + sumber bahaya di beberapa bullet pada dua section → simpan →
   muat ulang → section 3/4/5 ikut terisi turunannya, PDF mencetak
   `Kebutuhan: … ; Bahaya: …` di bawah bullet yang relevan.
3. Buat JSA → tiap langkah menampilkan checkbox kebutuhan dalam keadaan tercentang
   → lepas beberapa, termasuk **melepas semuanya** pada satu langkah → simpan →
   buka ulang → centangan persis seperti yang ditinggalkan (uji regresi bug semai-ulang).
4. Buat PTW pada proyek itu → tiap blok hanya menampilkan butir hasil JSA dalam
   keadaan tercentang → "Tampilkan semua" membuka daftar penuh → ajukan → buka
   ulang sebagai revisi → pilihan tersimpan kembali, tanpa prefill ulang.
5. Buat PTW tipe **panas** pada proyek yang prosedurnya memilih
   `Api Terbuka / Percikan` → tidak error, butir itu sekadar tidak tercentang.
6. Proyek lama tanpa kebutuhan JSA sama sekali → form PTW langsung tampil mode
   lengkap, bukan kosong.
7. Vendor dari org berbeda membuka proyek yang sama → picker master tetap kosong
   (tidak ada kebocoran lintas org).

## Tindak lanjut

Perpanjangan / reaktivasi PTW (`valid_to` diperpanjang pada baris PTW yang sama,
nomor tetap, approval ringkas lewat tahap akhir) dispek terpisah setelah pekerjaan
ini selesai dan ter-merge.

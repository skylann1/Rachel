# Sumber Bahaya Chain (Prosedur → JSA → PTW) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bawa sumber bahaya per sub-langkah dari Prosedur Kerja ke JSA lalu ke PTW, jadikan JSA titik filter, dan ubah section 3/4/5 prosedur jadi nilai turunan — tanpa mengubah format dokumen cetak.

**Architecture:** Seluruh perubahan bentuk data terjadi di dalam kolom JSONB yang sudah ada (`procedures.content`, `jsa_steps.kebutuhan`) — tidak ada migration. `lib/procedure-kebutuhan.ts` tetap satu-satunya sumber kebenaran: menambah `hazards` di situ otomatis mengalir ke agregasi JSA, prefill PTW, dan baris `Kebutuhan:` di kedua PDF tanpa menyentuh berkas PDF mana pun. Section 3/4/5 prosedur berhenti jadi input manual tapi tetap ditulis ke key `content` yang sama, sehingga `ProsedurPDF.tsx` tidak tahu ada yang berubah.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS).

**Spec:** `docs/superpowers/specs/2026-09-28-prosedur-sumber-bahaya-chain-design.md`

## Global Constraints

- **Ini BUKAN Next.js yang kamu hafal.** Versi di repo ini punya breaking changes. Baca panduan terkait di `node_modules/next/dist/docs/` sebelum menulis kode spesifik Next.js.
- **Tidak ada test framework di repo ini.** Tidak ada `npm test`. Jangan membuat berkas test, jangan memasang test runner.
- **`npm` dan `npx` TIDAK terpasang di mesin ini** — hanya `node` (`/c/nvm4w/nodejs/node`). Perintah `npm run ...` akan gagal dengan "command not found". Panggil binary lokal lewat `node`:
  - Typecheck: `node node_modules/typescript/bin/tsc --noEmit` — **harus exit 0**, ini gerbang yang mengikat.
  - Lint berkas tersentuh: `node node_modules/eslint/bin/eslint.js <path>` — harus exit 0 untuk berkas yang kamu ubah.
  - Build: `node node_modules/next/dist/bin/next build`
- **Lint seluruh repo TIDAK bersih dan tidak pernah bersih** (19.466 masalah pre-existing, 1.374 error, termasuk `scratch/` yang untracked). Jangan menjalankan lint repo-wide dan jangan mencoba memperbaiki temuan pre-existing. Standarnya: berkas yang KAMU sentuh harus lint bersih.
- **Jangan mengedit berkas `*PDF.tsx` mana pun.** `ProsedurPDF.tsx`, `JsaPDF.tsx`, `PtwPDF.tsx` harus tetap utuh — kesetiaan dokumen adalah batasan keras dari user. Kalau sebuah task terasa menuntut perubahan PDF, berhenti dan laporkan; jangan diedit.
- **Tidak ada migration.** Jangan membuat berkas `supabase/schema_*.sql` dan jangan menyentuh `supabase/README_*.md`.
- **Tidak ada permission key atau RLS policy baru.** Jangan menyentuh `utils/permissions.ts`, `lib/stage-assignments.ts`, atau alur approval.
- **Teks domain berbahasa Indonesia.** Label UI, komentar, dan pesan tetap Indonesia, mengikuti berkas sekitarnya.
- **Scoping vendor lewat `getCallerVendorOrgId()`** — jangan pernah men-scope data vendor dengan `auth.uid()`.
- Peringatan `LF will be replaced by CRLF` saat `git add` itu wajar di repo ini — abaikan.
- Jangan meng-commit `pnpm-lock.yaml` (untracked, sengaja).

---

### Task 1: `hazards` + helper turunan di lib

Fondasi seluruh rantai. Begitu task ini selesai, bahaya otomatis ikut teragregasi ke JSA dan prefill PTW, dan segmen `Bahaya: …` otomatis muncul di baris `Kebutuhan:` kedua PDF — tanpa menyentuh berkas lain.

**Files:**
- Modify: `lib/procedure-kebutuhan.ts`

**Interfaces:**
- Consumes: tidak ada (task pertama).
- Produces:
  - `StepKebutuhan` bertambah field `hazards: string[]`
  - `hasStoredKebutuhan(raw: unknown): boolean`
  - `deriveDocumentSections(sections: TahapanSection[]): ProsedurDocumentSections`
  - `interface ProsedurDocumentSections { tools: string[]; apd: string[]; perlengkapanLainnya: string[] }`

- [ ] **Step 1: Tambah `hazards` ke interface `StepKebutuhan`**

Di `lib/procedure-kebutuhan.ts`, ubah interface (sekitar baris 29–35) jadi:

```ts
/** Kebutuhan satu titik/sub-langkah — atau hasil agregasi per step/per proyek. */
export interface StepKebutuhan {
  workers: KebutuhanResource[];
  equipment: KebutuhanResource[];
  materials: KebutuhanResource[];
  /** Bentuk persis kolom `ptw.apd`: { kategori: [butir, ...] } dari APD_ITEMS. */
  apd: Record<string, string[]>;
  /** Butir `HAZARD_SOURCES` (lib/ptw-types.ts) — string mentah, bukan
   * KebutuhanResource, karena daftar bahaya adalah konstanta kode dan
   * `ptw.hazards` memang disimpan sebagai array string. */
  hazards: string[];
}
```

- [ ] **Step 2: Tambah `hazards` ke `emptyKebutuhan()`**

```ts
export function emptyKebutuhan(): StepKebutuhan {
  return { workers: [], equipment: [], materials: [], apd: {}, hazards: [] };
}
```

Ini otomatis membuat data lama aman: `normalizeTahapanPekerjaan()` sudah melakukan `{ ...emptyKebutuhan(), ...p.kebutuhan }`, dan `aggregateStepNeeds()` sudah melakukan hal yang sama untuk baris `jsa_steps` lama.

- [ ] **Step 3: Tambah helper dedupe string**

Letakkan tepat di bawah `dedupeResources()`:

```ts
function dedupeStrings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
```

- [ ] **Step 4: Union `hazards` di `aggregateKebutuhan()`**

Ubah fungsi jadi:

```ts
export function aggregateKebutuhan(list: StepKebutuhan[]): StepKebutuhan {
  let workers: KebutuhanResource[] = [];
  let equipment: KebutuhanResource[] = [];
  let materials: KebutuhanResource[] = [];
  let apd: Record<string, string[]> = {};
  let hazards: string[] = [];
  for (const k of list) {
    if (!k) continue;
    workers = [...workers, ...(k.workers || [])];
    equipment = [...equipment, ...(k.equipment || [])];
    materials = [...materials, ...(k.materials || [])];
    apd = mergeApd(apd, k.apd);
    hazards = [...hazards, ...(k.hazards || [])];
  }
  return {
    workers: dedupeResources(workers),
    equipment: dedupeResources(equipment),
    materials: dedupeResources(materials),
    apd,
    hazards: dedupeStrings(hazards),
  };
}
```

- [ ] **Step 5: Ikutkan `hazards` di `kebutuhanSummary()` dan `isKebutuhanEmpty()`**

Di `kebutuhanSummary()`, tambahkan segmen bahaya **setelah** segmen APD (jadi urutannya Pekerja · Peralatan · Material · APD · Bahaya):

```ts
  const apdItems = Object.values(k.apd || {}).flat();
  if (apdItems.length) parts.push(`APD: ${apdItems.join(', ')}`);
  if (k.hazards?.length) parts.push(`Bahaya: ${k.hazards.join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
```

Di `isKebutuhanEmpty()`, tambahkan pemeriksaan bahaya:

```ts
export function isKebutuhanEmpty(k: StepKebutuhan | undefined): boolean {
  if (!k) return true;
  return (
    !k.workers?.length &&
    !k.equipment?.length &&
    !k.materials?.length &&
    !k.hazards?.length &&
    !Object.values(k.apd || {}).some((list) => list.length > 0)
  );
}
```

- [ ] **Step 6: Tambah `hasStoredKebutuhan()`**

Tambahkan di akhir berkas:

```ts
/**
 * Membedakan "belum pernah disimpan" dari "disimpan dalam keadaan kosong".
 * `jsa_steps.kebutuhan` default-nya `{}` (tanpa key), sedangkan hasil simpan
 * vendor yang melepas semua centangan berupa objek dengan key lengkap tapi
 * array kosong. JSA memakai ini supaya centangan yang sengaja dilepas TIDAK
 * disemai ulang dari prosedur tiap kali form dibuka.
 */
export function hasStoredKebutuhan(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return Object.keys(raw as Record<string, unknown>).length > 0;
}
```

- [ ] **Step 7: Tambah `deriveDocumentSections()`**

Tambahkan di akhir berkas:

```ts
/** Isi section 3/4/5 dokumen prosedur, diturunkan dari seluruh sub-langkah. */
export interface ProsedurDocumentSections {
  tools: string[];
  apd: string[];
  perlengkapanLainnya: string[];
}

/**
 * Section 3 (ALAT / TOOLS), 4 (APD), dan 5 (PERLENGKAPAN LAINNYA) tidak lagi
 * diketik manual — nilainya diturunkan dari agregat kebutuhan semua bullet
 * TAHAPAN PEKERJAAN. Satu-satunya sumber nilai turunan itu: dipakai bersama
 * oleh kotak ringkasan di form, payload simpan, dan binding preview PDF,
 * supaya ketiganya mustahil berbeda.
 */
export function deriveDocumentSections(sections: TahapanSection[]): ProsedurDocumentSections {
  const all = aggregateKebutuhan(
    (sections || []).flatMap((s) => (s?.points || []).map((p) => p?.kebutuhan || emptyKebutuhan()))
  );
  return {
    tools: all.equipment.map((e) => e.label),
    apd: dedupeStrings(Object.values(all.apd).flat()),
    perlengkapanLainnya: all.materials.map((m) => m.label),
  };
}
```

- [ ] **Step 8: Verifikasi**

```bash
npx tsc --noEmit
```

Harapan: **lolos tanpa error**. Kalau ada error di berkas lain yang membangun `StepKebutuhan` secara literal (tanpa `hazards`), perbaiki dengan menambahkan `hazards: []` di situ — jangan membuat field-nya opsional.

```bash
npm run lint
```

Harapan: tidak ada error baru pada `lib/procedure-kebutuhan.ts`.

- [ ] **Step 9: Commit**

```bash
git add lib/procedure-kebutuhan.ts
git commit -m "Add hazards to StepKebutuhan plus stored/derived helpers"
```

---

### Task 2: Picker Sumber Bahaya per sub-langkah di form prosedur

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`

**Interfaces:**
- Consumes: `StepKebutuhan.hazards` dan `emptyKebutuhan()` dari Task 1.
- Produces: `toggleKebutuhanHazard(sIdx: number, pIdx: number, hazard: string): void` (lokal di berkas ini).

- [ ] **Step 1: Import daftar bahaya**

Di baris import `@/lib/ptw-types` yang sudah ada (berkas ini sudah mengimpor `APD_ITEMS` dan `APD_CATEGORY_LABELS`), tambahkan `HAZARD_COLUMNS`.

Pakai `HAZARD_COLUMNS` (daftar dasar), **bukan** `hazardColumnsFor(type)` — prosedur tidak terikat satu tipe PTW.

- [ ] **Step 2: Tambah handler toggle**

Letakkan tepat di bawah `toggleKebutuhanApd` (sekitar baris 283–288), mengikuti pola `updatePointKebutuhan` yang sama:

```tsx
  const toggleKebutuhanHazard = (sIdx: number, pIdx: number, hazard: string) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => ({
      ...k,
      hazards: k.hazards.includes(hazard)
        ? k.hazards.filter((h) => h !== hazard)
        : [...k.hazards, hazard],
    }));
```

- [ ] **Step 3: Ikutkan bahaya di badge hitungan**

Di dalam `section.points.map(...)` (sekitar baris 560–564), tambahkan bahaya ke `kebutuhanCount`:

```tsx
                        const kebutuhanCount =
                          (pointKebutuhan?.workers.length || 0) +
                          (pointKebutuhan?.equipment.length || 0) +
                          (pointKebutuhan?.materials.length || 0) +
                          (pointKebutuhan?.hazards.length || 0) +
                          Object.values(pointKebutuhan?.apd || {}).reduce((n, list) => n + list.length, 0);
```

- [ ] **Step 4: Tambah blok Sumber Bahaya di panel kebutuhan**

Di dalam `{kebutuhanOpen && ( ... )}`, tambahkan blok baru **sesudah** blok APD (yang ditutup sekitar baris 678), tepat sebelum `</div>` penutup panel. Ikuti pola chip-button yang sama persis dengan blok lain:

```tsx
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Sumber Bahaya</p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {HAZARD_COLUMNS.map((column, cIdx) => (
                                      <div key={cIdx} className="flex flex-wrap gap-1.5 content-start">
                                        {column.map((hz) => {
                                          const on = pointKebutuhan?.hazards.includes(hz);
                                          return (
                                            <button key={hz} type="button" onClick={() => toggleKebutuhanHazard(sIdx, pIdx, hz)}
                                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'}`}>
                                              {hz}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                </div>
```

Warna rose sengaja dibedakan dari primary supaya bahaya terbaca beda dari sumber daya.

- [ ] **Step 5: Perbarui judul panel**

Ubah teks judul panel (sekitar baris 597–599) supaya menyebut bahaya:

```tsx
                                <p className="text-[11px] font-bold text-slate-700">
                                  Kebutuhan — pekerja, peralatan, material, APD & sumber bahaya (dibawa ke JSA &amp; prefill PTW)
                                </p>
```

- [ ] **Step 6: Verifikasi**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <berkas yang kamu ubah>
node node_modules/next/dist/bin/next build
```

Harapan: ketiganya lolos.

Manual (dijalankan user, bukan agent — `node node_modules/next/dist/bin/next dev`, lalu buka prosedur sebuah proyek sebagai vendor):
- Buka panel Kebutuhan sebuah bullet → blok "Sumber Bahaya" tampil dengan 6 kolom butir.
- Centang 2 bahaya → badge hitungan di tombol naik 2.
- Simpan → muat ulang halaman → kedua bahaya masih tercentang.
- Buka preview PDF di halaman itu → di bawah bullet tersebut baris `Kebutuhan:` berakhir dengan `· Bahaya: <dua butir tadi>`.

- [ ] **Step 7: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/prosedur/page.tsx"
git commit -m "Add per-substep hazard source picker to prosedur form"
```

---

### Task 3: Section 3/4/5 prosedur jadi nilai turunan

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`

**Interfaces:**
- Consumes: `deriveDocumentSections()` dan `ProsedurDocumentSections` dari Task 1.
- Produces: tidak ada ekspor baru. Key `content` yang ditulis tetap `tools`, `selectedApd`, `perlengkapanLainnya` dengan tipe `string[]` — **jangan diubah namanya**, `ProsedurPDF.tsx` membacanya.

- [ ] **Step 1: Hitung nilai turunan**

Import `deriveDocumentSections` dari `@/lib/procedure-kebutuhan`, lalu tepat di atas `handleSubmit` (sekitar baris 290) tambahkan:

```tsx
  // Section 3/4/5 dokumen tidak lagi diketik manual — diturunkan dari agregat
  // kebutuhan seluruh sub-langkah TAHAPAN PEKERJAAN. Satu sumber untuk kotak
  // ringkasan, payload simpan, dan preview PDF.
  const derivedSections = deriveDocumentSections(tahapanPekerjaan);
```

- [ ] **Step 2: Pakai nilai turunan di payload dan preview PDF**

Di `payload` (baris 294–307), ganti tiga baris:

```tsx
      tools: derivedSections.tools,
      selectedApd: derivedSections.apd,
      perlengkapanLainnya: derivedSections.perlengkapanLainnya,
```

Di `pdfData` (baris 324–338), ganti tiga baris:

```tsx
    tools: derivedSections.tools,
    apd: derivedSections.apd,
    perlengkapanLainnya: derivedSections.perlengkapanLainnya,
```

Perhatikan perbedaan nama yang memang sudah ada: payload memakai `selectedApd`, pdfData memakai `apd`. Pertahankan keduanya.

- [ ] **Step 3: Hapus state dan handler input lama**

Hapus dari berkas:
- state `tools`, `toolInput` (dan `setTools`, `setToolInput`)
- state `selectedApd`, `setSelectedApd`
- state `perlengkapanLainnya`, `perlengkapanInput` (dan setter-nya) — termasuk nilai default panjang di baris 105
- konstanta `apdList` di baris 23–32
- handler `handleAddStringItem`, `removeStringItem`, `toggleApd` **jika tidak lagi dipakai siapa pun** (periksa dulu dengan mencari pemakaiannya; section 7 mungkin memakainya — kalau ya, biarkan)
- baris pemuatan `setTools(content.tools || [])` dan `setSelectedApd(content.selectedApd || [])` di `loadData()`, serta `if (content.perlengkapanLainnya) setPerlengkapanLainnya(...)`
- import ikon yang jadi yatim (`HardHat`, `ShieldCheck`, dan `X` **hanya jika** tidak dipakai lagi — `X` kemungkinan besar masih dipakai tombol hapus poin, jadi periksa dulu)

- [ ] **Step 4: Ganti JSX section 3/4/5 dengan ringkasan read-only**

Ganti seluruh blok JSX section 3 (baris ~455–477), 4 (~479–502), dan 5 (~504–526) dengan tiga kotak read-only. Judul dan urutan section **tidak berubah**:

```tsx
            {/* 3. ALAT / TOOLS — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">3. ALAT / TOOLS</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari peralatan yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.tools.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada peralatan dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.tools.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-slate-700 font-bold text-xs rounded-lg border border-slate-200">{item}</span>
                ))}
              </div>
            </div>

            {/* 4. APD — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">4. ALAT PELINDUNG DIRI (APD)</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari APD yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.apd.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada APD dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.apd.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">{item}</span>
                ))}
              </div>
            </div>

            {/* 5. PERLENGKAPAN LAINNYA — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">5. PERLENGKAPAN LAINNYA</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari material yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.perlengkapanLainnya.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada material dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.perlengkapanLainnya.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-amber-700 font-bold text-xs rounded-lg border border-amber-200">{item}</span>
                ))}
              </div>
            </div>
```

- [ ] **Step 5: Verifikasi**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <berkas yang kamu ubah>
node node_modules/next/dist/bin/next build
```

Harapan: ketiganya lolos, tanpa peringatan variabel tak terpakai.

Manual:
- Buka prosedur proyek **lama** yang section 3/4/5-nya berisi ketikan manual dan sub-langkahnya belum punya kebutuhan → ketiga kotak tampil kosong dengan teks italic, **tapi jangan disimpan**; buka preview PDF → section 3/4/5 masih mencetak nilai lama (karena `content` belum ditimpa).
- Pada proyek uji, pilih peralatan + APD + material di beberapa sub-langkah → ketiga kotak langsung terisi tanpa reload → simpan → muat ulang → tetap terisi → preview PDF section 3/4/5 berisi nilai yang sama persis dengan kotak.
- Pastikan tidak ada lagi input teks di section 3 dan 5, dan tidak ada grid ikon APD di section 4.

- [ ] **Step 6: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/prosedur/page.tsx"
git commit -m "Derive prosedur sections 3-5 from sub-step kebutuhan"
```

---

### Task 4: JSA jadi titik filter (checkbox) + perbaikan semai-ulang

**Files:**
- Modify: `app/vendor/dashboard/jsa/create/[id]/page.tsx`

**Interfaces:**
- Consumes: `hasStoredKebutuhan()`, `StepKebutuhan.hazards`, `emptyKebutuhan()` dari Task 1.
- Produces: `toggleStepKebutuhan(stepIdx: number, mutate: (k: StepKebutuhan) => StepKebutuhan): void` (lokal).

- [ ] **Step 1: Perbaiki aturan semai di kedua lokasi**

Ini perbaikan bug yang wajib mendahului UI-nya: tanpa ini, centangan yang dilepas vendor akan muncul lagi tiap reload.

Impor `hasStoredKebutuhan` dan `emptyKebutuhan` dari `@/lib/procedure-kebutuhan`.

Di **baris ~97**, ganti:

```tsx
                kebutuhan: isKebutuhanEmpty(storedKebutuhan ?? undefined)
                  ? aggregatePointNeeds(data.procedureSections?.[idx]?.points || [])
                  : storedKebutuhan,
```

menjadi:

```tsx
                // Semai dari prosedur HANYA kalau belum pernah disimpan sama
                // sekali (kolom masih `{}`). Objek tersimpan yang array-nya
                // kosong berarti vendor sengaja melepas semua centangan.
                kebutuhan: hasStoredKebutuhan(storedKebutuhan)
                  ? { ...emptyKebutuhan(), ...storedKebutuhan }
                  : aggregatePointNeeds(data.procedureSections?.[idx]?.points || []),
```

Di **baris ~153**, ganti:

```tsx
              kebutuhan: isKebutuhanEmpty(storedKebutuhan ?? undefined) ? undefined : storedKebutuhan ?? undefined,
```

menjadi:

```tsx
              kebutuhan: hasStoredKebutuhan(storedKebutuhan)
                ? { ...emptyKebutuhan(), ...storedKebutuhan }
                : undefined,
```

Pertahankan `isKebutuhanEmpty` di daftar import — Step 3 masih memakainya untuk memutuskan apakah blok kandidat perlu dirender.

- [ ] **Step 2: Tambah handler toggle per langkah**

Letakkan bersama handler step lain di komponen:

```tsx
  const toggleStepKebutuhan = (stepIdx: number, mutate: (k: StepKebutuhan) => StepKebutuhan) => {
    setJsaSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, kebutuhan: mutate({ ...emptyKebutuhan(), ...s.kebutuhan }) } : s
    ));
  };
```

- [ ] **Step 3: Simpan `procedureSections` ke state**

Kandidat chip dibaca live dari prosedur, jadi bentuk section-nya harus tersedia saat render. Berkas ini sudah menyimpan `procSteps` (baris ~50); tambahkan pendampingnya:

```tsx
  const [procSections, setProcSections] = useState<TahapanSection[]>([]);
```

Impor tipenya: `import { ..., TahapanSection } from '@/lib/procedure-kebutuhan';`

Di dalam `loadData()`, tepat di sebelah pemanggilan `setProcSteps(...)` yang sudah ada, tambahkan:

```tsx
        setProcSections(data?.procedureSections || []);
```

`getJsa` sudah mengembalikan `procedureSections` (dipakai di baris ~98 dan ~113), jadi tidak ada perubahan di `actions.ts`.

- [ ] **Step 4: Ganti tampilan read-only dengan checkbox**

Di baris ~344–347, ganti blok ringkasan teks:

```tsx
                      {step.kebutuhan && !isKebutuhanEmpty(step.kebutuhan) && (
                        ...
                          <p className="...">{kebutuhanSummary(step.kebutuhan)?.split(' · ')...}</p>
                        ...
                      )}
```

dengan daftar checkbox yang **kandidatnya dibaca live dari prosedur** dan **keadaan centangnya dari `step.kebutuhan`**. Kandidat langkah ke-`idx` adalah `aggregatePointNeeds(procedureSections?.[idx]?.points || [])` — simpan `procedureSections` hasil `getJsa` ke state (mis. `procSections`) di `loadData()` agar tersedia saat render.

```tsx
                      {(() => {
                        const cand = aggregatePointNeeds(procSections?.[idx]?.points || []);
                        const cur = { ...emptyKebutuhan(), ...step.kebutuhan };
                        if (isKebutuhanEmpty(cand)) return null;
                        const chip = (on: boolean, key: string, label: string, onClick: () => void) => (
                          <button key={key} type="button" onClick={onClick}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 line-through hover:border-primary'}`}>
                            {label}
                          </button>
                        );
                        return (
                          <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-2">
                            <p className="text-[10px] font-bold text-slate-600">
                              Kebutuhan dari Prosedur — lepas centang yang tidak dipakai di langkah ini
                            </p>
                            {cand.workers.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.workers.map(w => chip(
                                  cur.workers.some(x => x.id === w.id), `w-${w.id}`, w.label,
                                  () => toggleStepKebutuhan(idx, k => ({ ...k, workers: k.workers.some(x => x.id === w.id) ? k.workers.filter(x => x.id !== w.id) : [...k.workers, w] }))
                                ))}
                              </div>
                            )}
                            {cand.equipment.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.equipment.map(e => chip(
                                  cur.equipment.some(x => x.id === e.id), `e-${e.id}`, e.label,
                                  () => toggleStepKebutuhan(idx, k => ({ ...k, equipment: k.equipment.some(x => x.id === e.id) ? k.equipment.filter(x => x.id !== e.id) : [...k.equipment, e] }))
                                ))}
                              </div>
                            )}
                            {cand.materials.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.materials.map(m => chip(
                                  cur.materials.some(x => x.id === m.id), `m-${m.id}`, m.label,
                                  () => toggleStepKebutuhan(idx, k => ({ ...k, materials: k.materials.some(x => x.id === m.id) ? k.materials.filter(x => x.id !== m.id) : [...k.materials, m] }))
                                ))}
                              </div>
                            )}
                            {Object.entries(cand.apd).map(([cat, items]) => items.length > 0 && (
                              <div key={cat} className="flex flex-wrap gap-1.5">
                                {items.map(item => chip(
                                  (cur.apd[cat] || []).includes(item), `a-${cat}-${item}`, item,
                                  () => toggleStepKebutuhan(idx, k => {
                                    const list = k.apd[cat] || [];
                                    return { ...k, apd: { ...k.apd, [cat]: list.includes(item) ? list.filter(x => x !== item) : [...list, item] } };
                                  })
                                ))}
                              </div>
                            ))}
                            {cand.hazards.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.hazards.map(hz => chip(
                                  cur.hazards.includes(hz), `h-${hz}`, hz,
                                  () => toggleStepKebutuhan(idx, k => ({ ...k, hazards: k.hazards.includes(hz) ? k.hazards.filter(x => x !== hz) : [...k.hazards, hz] }))
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
```

Pastikan variabel indeks langkah pada `map` di sekitar baris 344 memang bernama `idx`; kalau bukan, sesuaikan.

- [ ] **Step 5: Verifikasi**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <berkas yang kamu ubah>
node node_modules/next/dist/bin/next build
```

Manual:
- Buat JSA pada proyek yang prosedurnya sudah punya kebutuhan + bahaya → tiap langkah menampilkan chip dalam keadaan **tercentang semua**.
- Lepas beberapa chip (termasuk **melepas semuanya** pada satu langkah) → simpan → buka ulang JSA → centangan persis seperti yang ditinggalkan, termasuk langkah yang dikosongkan (ini regresi bug yang diuji).
- Preview PDF JSA → baris `Kebutuhan:` tiap langkah hanya memuat butir yang tercentang.
- Buka JSA lama yang `kebutuhan`-nya `{}` → tersemai penuh dari prosedur (perilaku lama tetap).

- [ ] **Step 6: Commit**

```bash
git add "app/vendor/dashboard/jsa/create/[id]/page.tsx"
git commit -m "Make JSA the kebutuhan filter point and fix re-seed on empty save"
```

---

### Task 5: Form PTW mode ringkas + toggle "Tampilkan semua"

**Files:**
- Modify: `app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`

**Interfaces:**
- Consumes: `getJsaPrefillNeeds()` (sudah ada, kini ikut mengembalikan `hazards` berkat Task 1), `StepKebutuhan.hazards`.
- Produces: tidak ada ekspor baru.

- [ ] **Step 1: Perluas state prefill**

`jsaPrefillIds` (baris ~79) sekarang hanya menyimpan `workers` dan `equipment`. Perluas supaya blok APD dan bahaya juga bisa disaring:

```tsx
  const [jsaPrefillIds, setJsaPrefillIds] = useState<{
    workers: string[];
    equipment: string[];
    apd: Record<string, string[]>;
    hazards: string[];
  }>({ workers: [], equipment: [], apd: {}, hazards: [] });
```

- [ ] **Step 2: Tambah state toggle per blok**

```tsx
  // Mode tampilan tiap blok: ringkas (hanya hasil JSA) vs lengkap (daftar penuh).
  const [showAllPekerja, setShowAllPekerja] = useState(false);
  const [showAllPeralatan, setShowAllPeralatan] = useState(false);
  const [showAllApd, setShowAllApd] = useState(false);
  const [showAllHazards, setShowAllHazards] = useState(false);
```

- [ ] **Step 3: Isi prefill bahaya + jatuhkan blok kosong ke mode lengkap**

Di dalam `if (hasJsaPrefill) { ... }` (baris ~123–135), tambahkan bahaya dan simpan keempat kelompok id:

```tsx
          setSelectedHazards(jsaPrefill.hazards.filter(h => hazardSources.includes(h)));
          setJsaPrefillIds({
            workers: jsaPrefill.workers.map(w => w.id),
            equipment: jsaPrefill.equipment.map(e => e.id),
            apd: jsaPrefill.apd,
            hazards: jsaPrefill.hazards,
          });
```

`hazardSources` sudah dihitung di baris ~58 (`hazardSourcesFor(ptwType)`). Penyaringan itu yang menangani kasus tipe `panas`, di mana `Akses Sulit` menggantikan `Api Terbuka / Percikan` — butir yang tidak ada di daftar tipe tersebut dilewati diam-diam.

Tepat **setelah** blok `if (hasJsaPrefill)` (termasuk cabang `else`-nya), tambahkan penentuan mode awal — blok yang tidak punya prefill harus langsung tampil lengkap, kalau tidak form-nya kosong dan vendor buntu:

```tsx
        // Blok tanpa prefill langsung tampil lengkap; kalau tidak, vendor
        // menghadapi daftar kosong. Termasuk kasus revisi PTW (prefill dilewati).
        setShowAllPekerja(jsaPrefill.workers.length === 0);
        setShowAllPeralatan(jsaPrefill.equipment.length === 0);
        setShowAllApd(!Object.values(jsaPrefill.apd).some(list => list.length > 0));
        setShowAllHazards(jsaPrefill.hazards.length === 0);
```

Letakkan baris ini di jalur yang selalu dieksekusi di akhir `loadData()`, bukan di dalam cabang `hasJsaPrefill`.

- [ ] **Step 4: Saring daftar yang dirender**

Hitung daftar tampil tepat sebelum `return` komponen:

```tsx
  const visiblePekerja = showAllPekerja
    ? rosterPekerja
    : rosterPekerja.filter(p => jsaPrefillIds.workers.includes(p.id));
  const visiblePeralatan = showAllPeralatan
    ? rosterPeralatan
    : rosterPeralatan.filter(p => jsaPrefillIds.equipment.includes(p.id));
  const visibleHazards = showAllHazards
    ? hazardSources
    : hazardSources.filter(h => jsaPrefillIds.hazards.includes(h));
  const visibleApdEntries = (Object.entries(APD_ITEMS) as [string, string[]][])
    .map(([cat, items]) => [cat, showAllApd ? items : items.filter(i => (jsaPrefillIds.apd[cat] || []).includes(i))] as [string, string[]])
    .filter(([, items]) => items.length > 0);
```

Ganti sumber iterasi di JSX: daftar pekerja (baris ~505) pakai `visiblePekerja`, peralatan (~550) pakai `visiblePeralatan`, sumber bahaya (~387) pakai `visibleHazards`, dan grid APD (~400–410) pakai `visibleApdEntries`.

- [ ] **Step 5: Tambah tombol toggle di header tiap blok**

Tambahkan tombol kecil di header keempat blok. Contoh untuk Sumber Bahaya (baris ~384), terapkan pola yang sama untuk APD, Pekerja, dan Peralatan dengan state masing-masing:

```tsx
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Sumber Bahaya (Pilih yang relevan)</span>
                <button type="button" onClick={() => setShowAllHazards(v => !v)}
                  className="text-[11px] font-bold text-primary hover:text-primary/80">
                  {showAllHazards ? 'Tampilkan dari JSA saja' : 'Tampilkan semua'}
                </button>
              </div>
```

- [ ] **Step 6: Verifikasi**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <berkas yang kamu ubah>
node node_modules/next/dist/bin/next build
```

Manual:
- Proyek dengan JSA yang punya kebutuhan → buka PTW baru → keempat blok hanya menampilkan butir hasil JSA, semuanya tercentang.
- Klik "Tampilkan semua" di tiap blok → daftar penuh muncul, centangan tidak berubah, badge "dari JSA" tetap menandai asal butir.
- Lepas satu pekerja dan satu bahaya → ajukan → buka ulang PTW sebagai revisi → pilihan tersimpan kembali dan blok tampil lengkap (prefill sengaja dilewati untuk revisi).
- PTW tipe **panas** pada prosedur yang memilih `Api Terbuka / Percikan` → tidak error; butir itu sekadar tidak tercentang dan bisa dipilih manual di mode lengkap.
- Proyek lama tanpa kebutuhan JSA sama sekali → keempat blok langsung tampil lengkap, bukan kosong.

- [ ] **Step 7: Commit**

```bash
git add "app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx"
git commit -m "Show JSA-derived items first on PTW form with show-all toggles"
```

---

## Catatan penutup

Setelah kelima task lolos, jalankan sekali lagi dari repo bersih:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <berkas yang kamu ubah>
node node_modules/next/dist/bin/next build
```

Pastikan `git status` tidak memuat berkas `supabase/schema_*.sql` baru dan tidak ada berkas `*PDF.tsx` yang termodifikasi — keduanya menandakan penyimpangan dari spec.

Perpanjangan / reaktivasi PTW dispek dan direncanakan terpisah setelah pekerjaan ini ter-merge.

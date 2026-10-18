import React from 'react';
import Link from 'next/link';
import {
  BookOpen, FileSignature, ShieldAlert, Stamp, HardHat, Send, Search, CheckCircle2,
  AlertTriangle, QrCode, ClipboardList, Siren, Clock, Info, ArrowRight, Users,
  CalendarClock, Flag, UserCheck, Gauge, Camera,
} from 'lucide-react';
import { PROCEDURE_STATUS, PROCEDURE_STAGE_SEQUENCE } from '@/lib/procedure-status';
import { JSA_STATUS, JSA_STAGE_SEQUENCE } from '@/lib/jsa-status';
import { PTW_STATUS, PTW_STAGE_SEQUENCE } from '@/lib/ptw-status';
import {
  PanduanHero, PhaseStrip, PhaseCard, Lane, StatusFlow, NoteBox, FeatureCard, SectionTitle,
} from '@/components/panduan/alur-ui';

const procedureFlow = [
  { name: PROCEDURE_STATUS.draft, tone: 'slate' as const },
  ...PROCEDURE_STAGE_SEQUENCE.map(s => ({ name: s.status, tone: 'amber' as const })),
  { name: PROCEDURE_STATUS.approved, tone: 'emerald' as const },
];
const jsaFlow = [
  { name: JSA_STATUS.draft, tone: 'slate' as const },
  ...JSA_STAGE_SEQUENCE.map(s => ({ name: s.status, tone: 'amber' as const })),
  { name: JSA_STATUS.approved, tone: 'emerald' as const },
];
const ptwFlow = [
  { name: PTW_STATUS.draft, tone: 'slate' as const },
  ...PTW_STAGE_SEQUENCE.map(s => ({ name: s.status, tone: 'amber' as const })),
  { name: PTW_STATUS.aktif, tone: 'emerald' as const },
];

export default function VendorPanduanPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <PanduanHero
        badge="Panduan Mitra Kerja"
        title="Cara Kerja Perizinan K3"
        subtitle="Setiap pekerjaan melewati tiga dokumen berurutan sebelum boleh dimulai di lapangan, lalu ditutup dengan penutupan PTW dan penyelesaian proyek. Halaman ini menjelaskan apa yang Anda kerjakan di tiap tahap."
        icon={BookOpen}
      />

      <PhaseStrip
        phases={[
          { label: 'Prosedur Kerja', icon: FileSignature, tone: 'blue' },
          { label: 'JSA', icon: ShieldAlert, tone: 'amber' },
          { label: 'PTW', icon: Stamp, tone: 'emerald' },
          { label: 'Kerja di Lapangan', icon: HardHat, tone: 'indigo' },
          { label: 'Penutupan & Selesai', icon: Flag, tone: 'slate' },
        ]}
      />

      <NoteBox tone="slate" icon={Info} title="Urutannya tidak bisa dilompati">
        JSA baru bisa diajukan setelah Prosedur Kerja disetujui, dan PTW baru bisa diajukan setelah JSA
        disetujui. Kalau tombol pengajuan belum muncul, artinya dokumen sebelumnya masih dalam proses.
      </NoteBox>

      <NoteBox tone="indigo" icon={UserCheck} title="Setiap dokumen direview internal perusahaan Anda dulu">
        Sebelum sampai ke PGSOL dan PGN, dokumen melewati <strong>Review HSE Vendor</strong> lalu{' '}
        <strong>Review PM Vendor</strong> — dua staf perusahaan Anda sendiri. Admin vendor menunjuk keduanya per
        proyek di tab <strong>Assignment Reviewer</strong> pada detail proyek. Kalau tahap itu belum ditugaskan,
        dokumen akan berhenti di sana.
      </NoteBox>

      <NoteBox tone="slate" icon={Gauge} title="Warna kartu proyek = kategori risiko">
        Di halaman <strong>Proyek Saya</strong>, kartu proyek diberi warna sesuai kategori risiko yang ditetapkan
        admin PGN: hijau (Low), kuning (Moderate), merah (High). Semakin tinggi risikonya, semakin ketat
        pengawasan K3-nya.
      </NoteBox>

      {/* ---------------------------------------------------------------- */}
      <div>
        <PhaseCard
          step={1} totalSteps={3} eyebrow="Dokumen Pertama"
          title="Prosedur Kerja"
          subtitle="Penjelasan langkah kerja yang akan Anda lakukan. Menjadi dasar penilaian bahaya di tahap berikutnya."
          icon={FileSignature} tone="blue"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Anda Lakukan" icon={Send} tone="blue"
              items={[
                <>Buka proyek Anda, lalu susun <strong>Prosedur Kerja</strong> berisi tahapan pekerjaan.</>,
                <>Per langkah, pilih kebutuhan: <strong>pekerja, peralatan, material, APD, dan sumber bahaya</strong>. Isian ini otomatis terbawa ke JSA dan PTW.</>,
                <>Pilih <strong>jenis PTW</strong> yang dibutuhkan pekerjaan ini.</>,
                <>Ajukan kalau sudah lengkap. Nama proyek terisi otomatis dari data proyek.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
              items={[
                <>Direview HSE dan PM perusahaan Anda, lalu HSE dan PM PGSOL, lalu HSSE PGN, dan terakhir PM Zona PGN.</>,
                <>Kalau disetujui semua, tahap JSA otomatis terbuka.</>,
                <>Kalau ditolak di tahap mana pun, Anda menerima <strong>catatan revisi</strong> di notifikasi.</>,
              ]}
            />
          </div>

          <StatusFlow label="Status yang akan Anda lihat" statuses={procedureFlow} />

          <NoteBox tone="amber" icon={AlertTriangle} title="Kalau ditolak">
            Dokumen kembali ke <strong>Draft</strong> dan catatan revisinya tersimpan sebagai riwayat.
            Perbaiki sesuai catatan, lalu ajukan ulang — tidak perlu membuat dokumen baru dari nol. Review
            dimulai lagi dari tahap pertama.
          </NoteBox>
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={2} totalSteps={3} eyebrow="Dokumen Kedua"
          title="JSA — Job Safety Analysis"
          subtitle="Uraian bahaya tiap langkah kerja beserta tindakan pengendaliannya."
          icon={ShieldAlert} tone="amber"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Anda Lakukan" icon={Send} tone="amber"
              items={[
                <>Rinci tiap langkah: <strong>bahaya</strong>, <strong>risiko</strong>, dan <strong>tindakan pengendalian</strong>.</>,
                <>Pastikan sejalan dengan Prosedur Kerja yang sudah disetujui.</>,
                <>Ajukan untuk ditinjau.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
              items={[
                <>Rantai review sama dengan Prosedur: vendor, PGSOL, HSSE PGN, lalu persetujuan PM Zona PGN.</>,
                <>Tiap tahap dipegang <strong>orang berbeda</strong>.</>,
              ]}
            />
          </div>

          <StatusFlow label="Status yang akan Anda lihat" statuses={jsaFlow} />
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={3} totalSteps={3} eyebrow="Dokumen Ketiga" isLast
          title="PTW — Permit to Work"
          subtitle="Izin kerja aman (SIKA) yang harus terbit sebelum pekerjaan boleh dimulai di lokasi."
          icon={Stamp} tone="emerald"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Anda Lakukan" icon={Send} tone="emerald"
              items={[
                <>Pilih <strong>tipe izin</strong> sesuai pekerjaan (Kerja Dingin, Kerja Panas, Ketinggian, dll). Tipe yang diwajibkan mengikuti pilihan di Prosedur Kerja.</>,
                <>Daftarkan <strong>pekerja</strong> dan <strong>peralatan</strong> yang akan masuk lokasi.</>,
                <>Isi sumber bahaya, APD, <strong>masa berlaku (maksimal 7 hari)</strong>, dan jam kerja.</>,
                <>Satu pekerjaan bisa butuh <strong>lebih dari satu tipe izin</strong> — ajukan masing-masing.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
              items={[
                <>Review HSE dan PM Vendor, HSE dan PM PGSOL, lalu persetujuan PM, review PTW Issuer, dan penomoran HSSE.</>,
                <>Sertifikat pekerja dan dokumen alat dicek masa berlakunya.</>,
                <>Di tahap akhir, <strong>HSSE memberi nomor PTW</strong> secara manual, lalu izin menjadi aktif.</>,
              ]}
            />
          </div>

          <StatusFlow label="Status yang akan Anda lihat" statuses={ptwFlow} />

          <NoteBox tone="red" icon={AlertTriangle} title="Sertifikat kedaluwarsa bisa menghambat">
            Pekerja dengan sertifikat kompetensi kedaluwarsa atau alat dengan dokumen yang sudah lewat masa
            berlaku akan terlihat jelas oleh peninjau. Perbarui <strong>Data Pekerja</strong> dan{' '}
            <strong>Data Peralatan</strong> sebelum mengajukan.
          </NoteBox>
        </PhaseCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={HardHat}
          title="Setelah PTW Aktif"
          subtitle="Izin terbit bukan akhir prosesnya — ada kewajiban harian selama pekerjaan berjalan."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard icon={QrCode} tone="indigo" title="QR Check-in Lapangan">
            Tiap PTW aktif punya QR unik. Cetak dan tempel di lokasi kerja — bisa dibuka siapa pun lewat HP,
            tanpa login.
          </FeatureCard>
          <FeatureCard icon={ClipboardList} tone="blue" title="Toolbox Meeting Harian">
            Catat briefing keselamatan tiap hari sebelum kerja. Selama belum dicatat, pekerja belum bisa check-in.
          </FeatureCard>
          <FeatureCard icon={Users} tone="emerald" title="Check-in & Check-out">
            Pekerja lapor hadir saat datang dan lapor keluar saat pulang, sehingga terlihat siapa yang sedang di lokasi.
          </FeatureCard>
        </div>

        <NoteBox tone="indigo" icon={UserCheck} title="Pemegang PTW dan daily check">
          Admin vendor menugaskan satu <strong>Pemegang PTW</strong> untuk tiap izin lewat tab{' '}
          <strong>Penugasan</strong> pada detail proyek (akun ber-role <strong>vendor_pemegang_ptw</strong> atau yang
          punya izin pemegang). Pemegang mengisi <strong>uraian pekerjaan</strong> di tab <strong>Daily Check</strong>{' '}
          setiap hari berlaku PTW. Pengawas dari PGN mengisi sisi pengawasan dan Safety Checklist.
        </NoteBox>

        <NoteBox tone="red" icon={Siren} title="Stop Work Authority — hak semua orang">
          Siapa pun yang melihat kondisi berbahaya berhak menghentikan pekerjaan lewat tombol
          <strong> STOP WORK</strong> di halaman QR, tanpa akun. Untuk mengaktifkan kembali, hubungi PM/HSSE —
          hanya mereka yang berwenang mencabutnya setelah kondisi dinyatakan aman.
        </NoteBox>

        <NoteBox tone="slate" icon={Clock} title="Masa berlaku PTW">
          PTW punya tanggal berakhir. Setelah lewat, statusnya otomatis menjadi <strong>{PTW_STATUS.expired}</strong>{' '}
          dan pekerjaan tidak boleh dilanjutkan. Kalau pekerjaan belum selesai, ajukan <strong>perpanjangan
          sebelum</strong> tanggal berakhir (lihat di bawah).
        </NoteBox>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={CalendarClock}
          title="Perpanjangan PTW"
          subtitle="Pekerjaan butuh waktu lebih? Ajukan sebelum PTW berakhir."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Cara Mengajukan" icon={Send} tone="blue"
            items={[
              <>Buka proyek, tab <strong>Dokumen K3</strong>, lalu pada kartu PTW yang aktif tekan <strong>Ajukan Perpanjangan PTW</strong>.</>,
              <>Pilih tanggal berlaku baru dan tulis alasannya.</>,
              <>Satu perpanjangan menambah <strong>maksimal 7 hari</strong>. Kalau masih kurang, ajukan perpanjangan lagi (boleh berulang selama PTW masih Aktif).</>,
              <>Hari ke-8 dst dicatat di <strong>lembar lanjutan</strong> (Safety Check dan Daily Check) dan ikut tercetak menyatu di dokumen PTW yang sama.</>,
              <>Tombol hanya muncul untuk akun yang punya izin <strong>Mengajukan Perpanjangan PTW</strong>.</>,
            ]}
          />
          <Lane
            title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
            items={[
              <>PTW <strong>tetap aktif</strong> selama menunggu — pekerjaan tidak berhenti.</>,
              <>HSSE yang ditugaskan di proyek Anda memverifikasi.</>,
              <>Disetujui → tanggal berlaku PTW langsung diperbarui. Ditolak → Anda melihat alasannya di kartu PTW.</>,
            ]}
          />
        </div>

        <NoteBox tone="amber" icon={AlertTriangle} title="Sudah terlanjur Expired?">
          PTW yang sudah kedaluwarsa tidak bisa diperpanjang. Tutup PTW tersebut dengan prosedur penutupan di
          bawah, lalu hubungi PM/HSSE kalau pekerjaan masih perlu dilanjutkan.
        </NoteBox>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={CheckCircle2}
          title="Penutupan PTW"
          subtitle="Pekerjaan sudah selesai? Tutup PTW-nya supaya izin tidak menggantung."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Cara Menutup" icon={Send} tone="emerald"
            items={[
              <>Pada kartu PTW, tekan <strong>Pekerjaan Selesai — Ajukan Penutupan PTW</strong>.</>,
              <>Centang seluruh checklist: pekerjaan selesai, area bersih, peralatan keluar, tidak ada bahaya tersisa, semua pekerja keluar.</>,
              <>Isi waktu pekerjaan selesai dan catatan penutupan.</>,
              <>Pastikan <strong>semua pekerja sudah check-out</strong> — kalau belum, pengajuan diblokir.</>,
            ]}
          />
          <Lane
            title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
            items={[
              <>Status menjadi <strong>{PTW_STATUS.penutupanDiajukan}</strong>, menunggu verifikasi HSSE.</>,
              <>Disetujui → status <strong>{PTW_STATUS.selesai}</strong>. QR check-in dan daily check untuk PTW itu ditutup.</>,
              <>Ditolak → PTW kembali Aktif dan alasan penolakan muncul di kartu.</>,
            ]}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={Flag}
          title="Penyelesaian Proyek"
          subtitle="Langkah terakhir: proyek dinyatakan selesai dan masuk arsip."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Syarat & Cara Mengajukan" icon={Send} tone="indigo"
            items={[
              <><strong>Semua PTW</strong> proyek sudah berstatus {PTW_STATUS.selesai}.</>,
              <>Tidak ada <strong>temuan inspeksi</strong> (Inbox Temuan K3) yang belum ditutup.</>,
              <>Buka tab <strong>Ringkasan Proyek</strong>, isi catatan penyelesaian, lalu tekan <strong>Ajukan Penyelesaian Proyek</strong>.</>,
              <>Tombol hanya muncul untuk akun yang punya izin <strong>Mengajukan Penyelesaian Proyek</strong> (umumnya admin vendor).</>,
            ]}
          />
          <Lane
            title="Yang Terjadi Setelahnya" icon={Search} tone="slate"
            items={[
              <>PM yang ditugaskan di proyek Anda memverifikasi dan memeriksa ulang syaratnya.</>,
              <>Disetujui → status proyek <strong>Selesai</strong> dan tampil di filter &ldquo;Selesai&rdquo; pada Proyek Saya.</>,
              <>Ditolak → alasannya tampil di tab Ringkasan Proyek; perbaiki lalu ajukan ulang.</>,
            ]}
          />
        </div>

        <FeatureCard icon={Camera} tone="blue" title="Inbox Temuan K3">
          Temuan inspeksi dari tim internal masuk ke menu <strong>Inbox Temuan K3</strong>. Unggah foto bukti
          perbaikan agar temuan bisa ditutup — temuan yang masih terbuka akan menghalangi penyelesaian proyek.
        </FeatureCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <SectionTitle
          icon={CheckCircle2}
          title="Siap Memulai?"
          subtitle="Buka proyek Anda dan mulai dari dokumen yang statusnya masih tertunda."
        />
        <div className="flex flex-wrap gap-3 mt-5">
          <Link
            href="/vendor/dashboard/projects"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-primary/30"
          >
            Lihat Proyek Saya <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/vendor/dashboard/my-task"
            className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Cek Tugas Saya
          </Link>
        </div>
      </div>
    </div>
  );
}

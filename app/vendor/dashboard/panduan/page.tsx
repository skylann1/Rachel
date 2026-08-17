import React from 'react';
import Link from 'next/link';
import {
  BookOpen, FileSignature, ShieldAlert, Stamp, HardHat, Send, Search, CheckCircle2,
  AlertTriangle, QrCode, ClipboardList, Siren, Clock, Info, ArrowRight, Users,
} from 'lucide-react';
import { PROCEDURE_STATUS } from '@/lib/procedure-status';
import { JSA_STATUS } from '@/lib/jsa-status';
import { PTW_STATUS } from '@/lib/ptw-status';
import {
  PanduanHero, PhaseStrip, PhaseCard, Lane, StatusFlow, NoteBox, FeatureCard, SectionTitle,
} from '@/components/panduan/alur-ui';

export default function VendorPanduanPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <PanduanHero
        badge="Panduan Mitra Kerja"
        title="Cara Kerja Perizinan K3"
        subtitle="Setiap pekerjaan harus melewati tiga dokumen berurutan sebelum boleh dimulai di lapangan. Halaman ini menjelaskan apa yang perlu Anda kerjakan di tiap tahap dan apa yang sedang terjadi saat dokumen Anda ditinjau."
        icon={BookOpen}
      />

      <PhaseStrip
        phases={[
          { label: 'Prosedur Kerja', icon: FileSignature, tone: 'blue' },
          { label: 'JSA', icon: ShieldAlert, tone: 'amber' },
          { label: 'PTW', icon: Stamp, tone: 'emerald' },
          { label: 'Kerja di Lapangan', icon: HardHat, tone: 'indigo' },
        ]}
      />

      <NoteBox tone="slate" icon={Info} title="Urutannya tidak bisa dilompati">
        JSA baru bisa diajukan setelah Prosedur Kerja disetujui, dan PTW baru bisa diajukan setelah
        JSA disetujui. Kalau tombol pengajuan belum muncul, artinya dokumen sebelumnya masih dalam
        proses.
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
                <>Simpan sebagai <strong>Draft</strong> dulu kalau belum selesai — belum terkirim ke internal.</>,
                <>Ajukan kalau sudah lengkap. Status berubah jadi menunggu review.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi di Internal" icon={Search} tone="slate"
              items={[
                <>Tim internal berwenang meninjau isi prosedur Anda.</>,
                <>Kalau disetujui, tahap JSA otomatis terbuka.</>,
                <>Kalau ditolak, Anda menerima <strong>catatan revisi</strong> di notifikasi.</>,
              ]}
            />
          </div>

          <StatusFlow
            label="Status yang akan Anda lihat"
            statuses={[
              { name: PROCEDURE_STATUS.draft, tone: 'slate' },
              { name: PROCEDURE_STATUS.menungguReviewPM, tone: 'amber' },
              { name: PROCEDURE_STATUS.approved, tone: 'emerald' },
            ]}
          />

          <NoteBox tone="amber" icon={AlertTriangle} title="Kalau ditolak">
            Dokumen kembali ke <strong>Draft</strong> dan catatan revisinya tersimpan sebagai riwayat.
            Perbaiki sesuai catatan, lalu ajukan ulang — tidak perlu membuat dokumen baru dari nol.
          </NoteBox>
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={2} totalSteps={3} eyebrow="Dokumen Kedua"
          title="JSA — Job Safety Analysis"
          subtitle="Uraian bahaya tiap langkah kerja beserta tindakan pengendaliannya. Ditinjau dua pihak berbeda."
          icon={ShieldAlert} tone="amber"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Anda Lakukan" icon={Send} tone="amber"
              items={[
                <>Rinci tiap langkah pekerjaan: <strong>bahaya</strong>, <strong>risiko</strong>, dan <strong>tindakan pengendalian</strong>.</>,
                <>Pastikan sejalan dengan Prosedur Kerja yang sudah disetujui.</>,
                <>Ajukan untuk ditinjau.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi di Internal" icon={Search} tone="slate"
              items={[
                <><strong>Review PGSOL</strong> — verifikasi teknis: bahaya sudah lengkap, mitigasi memadai.</>,
                <><strong>Persetujuan PGN</strong> — otorisasi formal, menerima risiko sisa.</>,
                <>Dua tahap ini <strong>wajib dilakukan dua orang berbeda</strong>.</>,
              ]}
            />
          </div>

          <StatusFlow
            label="Status yang akan Anda lihat"
            statuses={[
              { name: JSA_STATUS.draft, tone: 'slate' },
              { name: JSA_STATUS.reviewPgsol, tone: 'amber' },
              { name: JSA_STATUS.approvalPgn, tone: 'amber' },
              { name: JSA_STATUS.approved, tone: 'emerald' },
            ]}
          />

          <NoteBox tone="amber" icon={AlertTriangle} title="Kalau ditolak">
            JSA kembali ke tahap <strong>{JSA_STATUS.reviewPgsol}</strong> — bukan ke Draft. Artinya
            setelah Anda perbaiki, dokumen ditinjau ulang dari awal rantai persetujuan.
          </NoteBox>
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
                <>Pilih <strong>tipe izin</strong> sesuai pekerjaan (Kerja Dingin, Kerja Panas, Ketinggian, dll).</>,
                <>Daftarkan <strong>pekerja</strong> dan <strong>peralatan</strong> yang akan masuk lokasi.</>,
                <>Isi sumber bahaya, APD, masa berlaku, dan jam kerja.</>,
                <>Satu pekerjaan bisa butuh <strong>lebih dari satu tipe izin</strong> sekaligus — ajukan masing-masing.</>,
              ]}
            />
            <Lane
              title="Yang Terjadi di Internal" icon={Search} tone="slate"
              items={[
                <>Melewati <strong>tiga tahap berurutan</strong>: persetujuan PM, review PTW Issuer, lalu penomoran HSSE.</>,
                <>Sertifikat pekerja & dokumen alat dicek masa berlakunya.</>,
                <>Setelah lolos semua, PTW mendapat <strong>nomor resmi</strong> dan menjadi aktif.</>,
              ]}
            />
          </div>

          <StatusFlow
            label="Status yang akan Anda lihat"
            statuses={[
              { name: PTW_STATUS.draft, tone: 'slate' },
              { name: PTW_STATUS.menungguApprovalPM, tone: 'amber' },
              { name: PTW_STATUS.reviewPtwIssuer, tone: 'amber' },
              { name: PTW_STATUS.menungguPenomoranHSSE, tone: 'amber' },
              { name: PTW_STATUS.aktif, tone: 'emerald' },
            ]}
          />

          <NoteBox tone="red" icon={AlertTriangle} title="Sertifikat kedaluwarsa bisa menghambat">
            Kalau ada pekerja dengan sertifikat kompetensi kedaluwarsa atau alat dengan dokumen yang
            sudah lewat masa berlaku, hal itu akan terlihat jelas oleh peninjau saat menyetujui.
            Perbarui data di <strong>Data Pekerja</strong> dan <strong>Data Peralatan</strong> sebelum mengajukan.
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
            Tiap PTW aktif punya QR unik. Cetak dan tempel di lokasi kerja — bisa dibuka siapa pun
            di lapangan lewat HP, tanpa perlu login.
          </FeatureCard>
          <FeatureCard icon={ClipboardList} tone="blue" title="Toolbox Meeting Harian">
            Catat briefing keselamatan tiap hari sebelum kerja: topik yang dibahas dan siapa yang
            hadir. Selama belum dicatat, pekerja belum bisa check-in.
          </FeatureCard>
          <FeatureCard icon={Users} tone="emerald" title="Check-in & Check-out Pekerja">
            Pekerja lapor hadir saat datang dan lapor keluar saat pulang, sehingga terlihat siapa
            saja yang sedang berada di lokasi.
          </FeatureCard>
        </div>

        <NoteBox tone="red" icon={Siren} title="Stop Work Authority — hak semua orang">
          Siapa pun yang melihat kondisi berbahaya berhak menghentikan pekerjaan lewat tombol
          <strong> STOP WORK</strong> di halaman QR, tanpa perlu akun. Pekerjaan langsung dihentikan dan
          semua pihak diberi tahu. Untuk mengaktifkan kembali, hubungi PM/HSSE — hanya mereka yang
          berwenang mencabutnya setelah kondisi dinyatakan aman.
        </NoteBox>

        <NoteBox tone="slate" icon={Clock} title="Masa berlaku PTW">
          PTW punya tanggal berakhir. Setelah lewat, statusnya otomatis menjadi
          <strong> {PTW_STATUS.expired}</strong> dan pekerjaan tidak boleh dilanjutkan sampai izin baru
          diajukan dan disetujui ulang.
        </NoteBox>
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
            Lihat Proyek Aktif <ArrowRight className="w-4 h-4" />
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

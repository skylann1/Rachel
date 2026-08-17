import React from 'react';
import Link from 'next/link';
import {
  BookOpen, FileSignature, ShieldAlert, Stamp, HardHat, Gavel, Inbox, ShieldCheck,
  AlertTriangle, QrCode, ClipboardList, Siren, ArrowRight, Users, KeyRound, Bell, History,
} from 'lucide-react';
import { PROCEDURE_STATUS } from '@/lib/procedure-status';
import { JSA_STATUS } from '@/lib/jsa-status';
import { PTW_STATUS } from '@/lib/ptw-status';
import {
  PanduanHero, PhaseStrip, PhaseCard, Lane, StatusFlow, NoteBox, FeatureCard, SectionTitle,
} from '@/components/panduan/alur-ui';

/** Label izin ditulis apa adanya seperti di halaman Role & Permission. */
function Perm({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">
      {children}
    </code>
  );
}

export default function InternalPanduanPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <PanduanHero
        badge="Panduan Tim Internal"
        title="Cara Kerja Verifikasi K3"
        subtitle="Setiap pengajuan mitra kerja melewati tiga dokumen berurutan dengan gerbang persetujuan di tiap tahap. Halaman ini menjelaskan siapa bertindak di tahap mana, apa yang perlu diperiksa, dan bagaimana wewenangnya diatur."
        icon={BookOpen}
      />

      <PhaseStrip
        phases={[
          { label: 'Prosedur Kerja', icon: FileSignature, tone: 'blue' },
          { label: 'JSA', icon: ShieldAlert, tone: 'amber' },
          { label: 'PTW', icon: Stamp, tone: 'emerald' },
          { label: 'Pengawasan Lapangan', icon: HardHat, tone: 'indigo' },
        ]}
      />

      <NoteBox tone="indigo" icon={KeyRound} title="Wewenang ditentukan izin, bukan nama jabatan">
        Sistem tidak mengunci tahap ke role tertentu. Yang menentukan siapa boleh bertindak adalah
        <strong> izin (permission)</strong> yang dilekatkan ke role lewat halaman{' '}
        <Link href="/dashboard/master-data/role" className="text-primary font-bold hover:underline">
          Role &amp; Permission
        </Link>
        . Artinya susunan persetujuan bisa diubah tanpa mengubah kode — cukup pindahkan izinnya.
      </NoteBox>

      {/* ---------------------------------------------------------------- */}
      <div>
        <PhaseCard
          step={1} totalSteps={3} eyebrow="Verifikasi Pertama"
          title="Prosedur Kerja"
          subtitle="Tahap tunggal. Memastikan urutan kerja yang diajukan mitra masuk akal sebelum bahayanya dianalisis."
          icon={FileSignature} tone="blue"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Perlu Diperiksa" icon={Inbox} tone="blue"
              items={[
                <>Tahapan kerja tertulis runtut dan menggambarkan pekerjaan sebenarnya.</>,
                <>Lingkup pekerjaan sesuai dengan proyek yang terdaftar.</>,
                <>Cukup detail untuk menjadi dasar penyusunan JSA.</>,
              ]}
            />
            <Lane
              title="Wewenang & Akibatnya" icon={Gavel} tone="slate"
              items={[
                <>Butuh izin <Perm>procedure.review</Perm>.</>,
                <>Disetujui → tahap JSA terbuka untuk mitra.</>,
                <>Ditolak → kembali ke <strong>Draft</strong>, catatan revisi Anda tersimpan sebagai riwayat dan dikirim sebagai notifikasi.</>,
              ]}
            />
          </div>

          <StatusFlow
            label="Rantai status"
            statuses={[
              { name: PROCEDURE_STATUS.draft, tone: 'slate' },
              { name: PROCEDURE_STATUS.menungguReviewPM, tone: 'amber' },
              { name: PROCEDURE_STATUS.approved, tone: 'emerald' },
            ]}
          />
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={2} totalSteps={3} eyebrow="Verifikasi Kedua"
          title="JSA — Job Safety Analysis"
          subtitle="Dua tahap berurutan: verifikasi teknis, lalu otorisasi formal. Sengaja dipisah ke dua orang."
          icon={ShieldAlert} tone="amber"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Tahap A — Review PGSOL" icon={Inbox} tone="amber"
              items={[
                <>Butuh izin <Perm>jsa.review_pgsol</Perm>.</>,
                <>Verifikasi teknis: bahaya tiap langkah sudah teridentifikasi lengkap.</>,
                <>Mitigasi memadai dan nilai risikonya wajar.</>,
                <>Tercatat pada blok <strong>&ldquo;Direview Oleh&rdquo;</strong> di formulir.</>,
              ]}
            />
            <Lane
              title="Tahap B — Persetujuan PGN" icon={Gavel} tone="amber"
              items={[
                <>Butuh izin <Perm>jsa.approve_pgn</Perm>.</>,
                <>Otorisasi formal: menerima risiko sisa dan mengizinkan pekerjaan berjalan.</>,
                <>Tercatat pada blok <strong>&ldquo;Disetujui Oleh&rdquo;</strong> di formulir.</>,
              ]}
            />
          </div>

          <NoteBox tone="indigo" icon={ShieldCheck} title="Pemisahan wewenang dijaga sistem">
            Orang yang melakukan Review PGSOL <strong>tidak bisa</strong> sekaligus menyetujui di tahap PGN,
            meskipun ia punya kedua izin tersebut. Sistem akan menolaknya dan meminta approver lain.
          </NoteBox>

          <StatusFlow
            label="Rantai status"
            statuses={[
              { name: JSA_STATUS.draft, tone: 'slate' },
              { name: JSA_STATUS.reviewPgsol, tone: 'amber' },
              { name: JSA_STATUS.approvalPgn, tone: 'amber' },
              { name: JSA_STATUS.approved, tone: 'emerald' },
            ]}
          />

          <NoteBox tone="amber" icon={AlertTriangle} title="Penolakan mengulang dari awal rantai">
            Ditolak di tahap mana pun akan mengembalikan JSA ke <strong>{JSA_STATUS.reviewPgsol}</strong>
            {' '}dan menghapus jejak reviewer sebelumnya — bukan kembali ke Draft. Setelah mitra
            memperbaiki, dokumen ditinjau ulang dari tahap pertama.
          </NoteBox>
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={3} totalSteps={3} eyebrow="Verifikasi Ketiga" isLast
          title="PTW — Permit to Work"
          subtitle="Tiga tahap berurutan sebelum izin kerja aman (SIKA) resmi diterbitkan dan diberi nomor."
          icon={Stamp} tone="emerald"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Lane
              title="1. Approval PM" icon={Inbox} tone="emerald"
              items={[
                <>Izin <Perm>ptw.approve_pm</Perm>.</>,
                <>Memastikan pekerjaan layak dijalankan sesuai JSA yang disetujui.</>,
              ]}
            />
            <Lane
              title="2. Review PTW Issuer" icon={ShieldCheck} tone="emerald"
              items={[
                <>Izin <Perm>ptw.review_issuer</Perm>.</>,
                <>Memeriksa kelengkapan teknis izin: tipe, bahaya, APD, gas test.</>,
              ]}
            />
            <Lane
              title="3. Penomoran HSSE" icon={Gavel} tone="emerald"
              items={[
                <>Izin <Perm>ptw.numbering_hsse</Perm>.</>,
                <>Menerbitkan nomor resmi <strong>PTW-TAHUN-NNN</strong> dan mengaktifkan izin.</>,
              ]}
            />
          </div>

          <StatusFlow
            label="Rantai status"
            statuses={[
              { name: PTW_STATUS.draft, tone: 'slate' },
              { name: PTW_STATUS.menungguApprovalPM, tone: 'amber' },
              { name: PTW_STATUS.reviewPtwIssuer, tone: 'amber' },
              { name: PTW_STATUS.menungguPenomoranHSSE, tone: 'amber' },
              { name: PTW_STATUS.aktif, tone: 'emerald' },
            ]}
          />

          <NoteBox tone="red" icon={AlertTriangle} title="Gerbang keselamatan sebelum menyetujui">
            Saat Anda hendak menyetujui, sistem memeriksa silang pekerja dan peralatan yang didaftarkan
            terhadap <strong>masa berlaku terkini</strong> di data master. Jika ada sertifikat kompetensi
            atau dokumen alat yang kedaluwarsa, peringatan ditampilkan sebelum Anda melanjutkan —
            karena data yang menempel di PTW hanya berisi nama dan peran, tanpa tanggal berlaku.
          </NoteBox>

          <NoteBox tone="slate" icon={Bell} title="Yang otomatis terjadi saat PTW aktif">
            Nomor PTW terbit, reviewer JSA otomatis ditetapkan sebagai pengawas proyek, QR check-in
            lapangan aktif, dan pemberitahuan dikirim ke mitra serta tim internal terkait.
          </NoteBox>
        </PhaseCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={HardHat}
          title="Pengawasan Setelah PTW Aktif"
          subtitle="Pekerjaan berjalan di lapangan — berikut alat pantau yang tersedia untuk Anda."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard icon={QrCode} tone="indigo" title="QR Check-in per Izin">
            Tiap PTW aktif punya QR unik yang bisa dibuka siapa pun di lapangan tanpa login. Tersedia
            di tab <strong>Status Lapangan</strong> pada detail proyek.
          </FeatureCard>
          <FeatureCard icon={ClipboardList} tone="blue" title="Kepatuhan Toolbox Meeting">
            Pantau proyek mana yang sudah dan belum mencatat briefing keselamatan hari ini. Pekerja
            tidak bisa check-in sebelum meeting hari itu tercatat.
          </FeatureCard>
          <FeatureCard icon={Users} tone="emerald" title="Kehadiran Real-time">
            Lihat siapa saja yang sedang berada di lokasi beserta jam masuknya, lintas proyek, di
            halaman <strong>Status Lapangan</strong>.
          </FeatureCard>
        </div>

        <NoteBox tone="red" icon={Siren} title="Stop Work Authority & pengaktifan kembali">
          Siapa pun di lapangan berhak menghentikan pekerjaan lewat halaman QR tanpa perlu akun —
          sesuai prinsip Stop Work Authority. Namun <strong>mengaktifkan kembali</strong> PTW yang
          dihentikan hanya bisa dilakukan dari dashboard internal oleh pemegang izin{' '}
          <Perm>ptw.resume_work</Perm>, setelah kondisi dinyatakan aman.
        </NoteBox>

        <NoteBox tone="slate" icon={History} title="Semua tindakan terekam">
          Setiap persetujuan, penolakan, toolbox meeting, dan pemicuan Stop Work tercatat di
          <strong> Riwayat Dokumen</strong> pada detail proyek — lengkap dengan pelaku, waktu, dan catatannya.
        </NoteBox>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <SectionTitle
          icon={Inbox}
          title="Mulai Meninjau"
          subtitle="Dokumen yang menunggu tindakan Anda dikumpulkan di halaman berikut."
        />
        <div className="flex flex-wrap gap-3 mt-5">
          <Link
            href="/dashboard/approval"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-primary/30"
          >
            Kelola Proyek <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard/my-task"
            className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Tugas Saya
          </Link>
          <Link
            href="/dashboard/site-status"
            className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Status Lapangan
          </Link>
        </div>
      </div>
    </div>
  );
}

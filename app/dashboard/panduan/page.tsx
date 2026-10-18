import React from 'react';
import Link from 'next/link';
import {
  BookOpen, FileSignature, ShieldAlert, Stamp, HardHat, Gavel, Inbox, ShieldCheck,
  AlertTriangle, QrCode, ClipboardList, Siren, ArrowRight, Users, KeyRound, Bell, History,
  CalendarClock, CheckCircle2, Flag, Camera, Gauge,
} from 'lucide-react';
import { PROCEDURE_STATUS, PROCEDURE_STAGE_SEQUENCE } from '@/lib/procedure-status';
import { JSA_STATUS, JSA_STAGE_SEQUENCE } from '@/lib/jsa-status';
import { PTW_STATUS, PTW_STAGE_SEQUENCE } from '@/lib/ptw-status';
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

export default function InternalPanduanPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <PanduanHero
        badge="Panduan Tim Internal"
        title="Cara Kerja Verifikasi K3"
        subtitle="Setiap pekerjaan mitra melewati tiga dokumen berurutan, lalu pengawasan lapangan, dan ditutup dengan penutupan PTW serta penyelesaian proyek. Halaman ini menjelaskan siapa bertindak di tahap mana, apa yang diperiksa, dan bagaimana wewenangnya diatur."
        icon={BookOpen}
      />

      <PhaseStrip
        phases={[
          { label: 'Prosedur Kerja', icon: FileSignature, tone: 'blue' },
          { label: 'JSA', icon: ShieldAlert, tone: 'amber' },
          { label: 'PTW', icon: Stamp, tone: 'emerald' },
          { label: 'Pengawasan Lapangan', icon: HardHat, tone: 'indigo' },
          { label: 'Penutupan & Selesai', icon: Flag, tone: 'slate' },
        ]}
      />

      <NoteBox tone="indigo" icon={KeyRound} title="Izin menentukan boleh atau tidak, penugasan menentukan siapa">
        Wewenang diatur lewat <strong>izin (permission)</strong> yang dilekatkan ke role di halaman{' '}
        <Link href="/dashboard/master-data/role" className="text-primary font-bold hover:underline">
          Role &amp; Permission
        </Link>
        . Tapi izin saja belum cukup untuk menyetujui: Anda juga harus <strong>ditugaskan</strong> pada tahap tersebut
        di proyek yang bersangkutan (admin menugaskan lewat Data Proyek). Tanpa penugasan, tombol Setujui/Tolak
        tidak aktif dan sistem menolak aksinya.
      </NoteBox>

      <NoteBox tone="slate" icon={Gauge} title="Kategori risiko proyek">
        Saat membuat proyek, admin PGN memilih <strong>Low / Moderate / High Risk</strong>. Level ini ditampilkan
        sebagai warna dan lencana pada kartu proyek (hijau, kuning, merah), di halaman Data Proyek maupun halaman
        Proyek Saya milik vendor. Proyek lama bisa diatur levelnya dari halaman Detail Proyek.
      </NoteBox>

      {/* ---------------------------------------------------------------- */}
      <div>
        <PhaseCard
          step={1} totalSteps={3} eyebrow="Verifikasi Pertama"
          title="Prosedur Kerja"
          subtitle="Dimulai dari review internal vendor, lalu PGSOL, lalu PGN. Memastikan urutan kerja masuk akal sebelum bahayanya dianalisis."
          icon={FileSignature} tone="blue"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Perlu Diperiksa" icon={Inbox} tone="blue"
              items={[
                <>Tahapan kerja tertulis runtut dan menggambarkan pekerjaan sebenarnya.</>,
                <>Lingkup pekerjaan sesuai proyek yang terdaftar.</>,
                <>Sumber bahaya dan kebutuhan (pekerja, alat, material, APD) per langkah terisi wajar.</>,
              ]}
            />
            <Lane
              title="Tahap Internal & Izinnya" icon={Gavel} tone="slate"
              items={[
                <>Review HSE PGSOL — <Perm>procedure.hse_pgsol</Perm>.</>,
                <>Review PM PGSOL — <Perm>procedure.review_pgsol</Perm>.</>,
                <>Review HSSE PGN — <Perm>procedure.hsse_pgn</Perm>.</>,
                <>Review PM Zona PGN (akhir) — <Perm>procedure.review</Perm>.</>,
              ]}
            />
          </div>

          <StatusFlow label="Rantai status" statuses={procedureFlow} />

          <NoteBox tone="amber" icon={AlertTriangle} title="Penolakan">
            Ditolak di tahap mana pun mengembalikan dokumen ke <strong>Draft</strong>. Catatan revisi tersimpan
            sebagai riwayat dan dikirim sebagai notifikasi. Setelah vendor memperbaiki dan mengajukan ulang,
            rantai review dimulai lagi dari awal.
          </NoteBox>
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={2} totalSteps={3} eyebrow="Verifikasi Kedua"
          title="JSA — Job Safety Analysis"
          subtitle="Rantai yang sama dengan Prosedur. Tahap-tahapnya sengaja dipegang orang berbeda."
          icon={ShieldAlert} tone="amber"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Lane
              title="Yang Perlu Diperiksa" icon={Inbox} tone="amber"
              items={[
                <>Bahaya tiap langkah teridentifikasi lengkap.</>,
                <>Mitigasi memadai dan nilai risiko (sebelum dan sesudah pengendalian) wajar.</>,
                <>Sejalan dengan Prosedur Kerja yang sudah disetujui.</>,
              ]}
            />
            <Lane
              title="Tahap Internal & Izinnya" icon={Gavel} tone="amber"
              items={[
                <>Review HSE PGSOL — <Perm>jsa.hse_pgsol</Perm>.</>,
                <>Review PM PGSOL — <Perm>jsa.review_pgsol</Perm>.</>,
                <>Review HSSE PGN — <Perm>jsa.hsse_pgn</Perm>.</>,
                <>Persetujuan PM Zona PGN (akhir) — <Perm>jsa.approve_pgn</Perm>.</>,
              ]}
            />
          </div>

          <NoteBox tone="indigo" icon={ShieldCheck} title="Pemisahan wewenang dijaga sistem">
            Satu orang tidak bisa memegang dua tahap berurutan pada dokumen yang sama, walau ia punya izin
            keduanya. Sistem menolaknya dan meminta petugas lain melanjutkan.
          </NoteBox>

          <StatusFlow label="Rantai status" statuses={jsaFlow} />
        </PhaseCard>

        {/* -------------------------------------------------------------- */}
        <PhaseCard
          step={3} totalSteps={3} eyebrow="Verifikasi Ketiga" isLast
          title="PTW — Permit to Work"
          subtitle="Review vendor dan PGSOL, lalu tiga tahap PGN sebelum izin kerja aman (SIKA) terbit dan bernomor."
          icon={Stamp} tone="emerald"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Lane
              title="PGSOL" icon={Inbox} tone="emerald"
              items={[
                <>HSE PGSOL — <Perm>ptw.hse_pgsol</Perm>.</>,
                <>PM PGSOL — <Perm>ptw.review_pgsol</Perm>.</>,
              ]}
            />
            <Lane
              title="PGN: PM & Issuer" icon={ShieldCheck} tone="emerald"
              items={[
                <>Approval PM — <Perm>ptw.approve_pm</Perm>.</>,
                <>Review PTW Issuer — <Perm>ptw.review_issuer</Perm>: tipe, bahaya, APD, gas test.</>,
              ]}
            />
            <Lane
              title="PGN: Penomoran HSSE" icon={Gavel} tone="emerald"
              items={[
                <>Izin <Perm>ptw.numbering_hsse</Perm>.</>,
                <>HSSE <strong>mengetik sendiri nomor PTW</strong> saat menyetujui (wajib, unik, maksimal 60 karakter), lalu izin aktif.</>,
              ]}
            />
          </div>

          <StatusFlow label="Rantai status" statuses={ptwFlow} />

          <NoteBox tone="red" icon={AlertTriangle} title="Gerbang keselamatan sebelum menyetujui">
            Saat hendak menyetujui, sistem memeriksa silang pekerja dan peralatan terhadap <strong>masa berlaku
            terkini</strong> di data master. Jika ada sertifikat atau dokumen alat yang kedaluwarsa, peringatan
            ditampilkan sebelum Anda melanjutkan.
          </NoteBox>

          <NoteBox tone="slate" icon={Bell} title="Yang otomatis terjadi saat PTW aktif">
            QR check-in lapangan aktif, daily check mulai berlaku, dan pemberitahuan dikirim ke vendor serta
            tim internal terkait.
          </NoteBox>
        </PhaseCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={HardHat}
          title="Pengawasan Setelah PTW Aktif"
          subtitle="Pekerjaan berjalan di lapangan — berikut alat pantau dan peran yang terlibat."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard icon={QrCode} tone="indigo" title="QR Check-in per Izin">
            Tiap PTW aktif punya QR unik yang bisa dibuka siapa pun di lapangan tanpa login. Tersedia di tab
            <strong> Status Lapangan</strong> pada detail proyek.
          </FeatureCard>
          <FeatureCard icon={ClipboardList} tone="blue" title="Toolbox Meeting">
            Pantau proyek yang sudah dan belum mencatat briefing keselamatan hari ini. Pekerja tidak bisa
            check-in sebelum meeting hari itu tercatat.
          </FeatureCard>
          <FeatureCard icon={Users} tone="emerald" title="Kehadiran Real-time">
            Lihat siapa saja yang sedang berada di lokasi beserta jam masuknya, lintas proyek, di halaman
            <strong> Status Lapangan</strong>.
          </FeatureCard>
        </div>

        <NoteBox tone="indigo" icon={Users} title="Pemegang PTW & Pengawas PTW">
          Tiap PTW punya dua penjabat lapangan. <strong>Pemegang</strong> (staf vendor, ditugaskan admin vendor)
          mengisi uraian pekerjaan harian. <strong>Pengawas</strong> (staf PGN) mengisi Safety Checklist dan daily
          check pengawas. Pengawas ditugaskan oleh pemegang izin <Perm>ptw.assign_pengawas</Perm> dari tab
          <strong> Penugasan</strong>; kandidatnya adalah akun ber-izin <Perm>ptw.field_pengawas</Perm>. Role siap
          pakai: <strong>pgn_pengawas_ptw</strong> (PGN) dan <strong>vendor_pemegang_ptw</strong> (vendor). Daily check
          hanya bisa diisi pada hari berlaku PTW (maksimal 7 hari).
        </NoteBox>

        <NoteBox tone="red" icon={Siren} title="Stop Work Authority & pengaktifan kembali">
          Siapa pun di lapangan berhak menghentikan pekerjaan lewat halaman QR tanpa akun. Namun
          <strong> mengaktifkan kembali</strong> PTW yang dihentikan hanya bisa dilakukan dari dashboard internal
          oleh pemegang izin <Perm>ptw.resume_work</Perm>, setelah kondisi dinyatakan aman.
        </NoteBox>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={CalendarClock}
          title="Perpanjangan PTW"
          subtitle="Menambah masa berlaku PTW yang masih aktif, tanpa menerbitkan izin baru."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Aturan Pengajuan (oleh vendor)" icon={Inbox} tone="blue"
            items={[
              <>Hanya untuk PTW berstatus <strong>{PTW_STATUS.aktif}</strong> dan <strong>belum lewat</strong> tanggal berakhir.</>,
              <>Vendor mengisi tanggal berlaku baru dan alasan. PTW tetap Aktif selama menunggu.</>,
              <>Satu pengajuan menambah <strong>maksimal 7 hari</strong> dari tanggal berakhir saat ini, dan boleh <strong>diajukan berulang</strong> kalau masih kurang.</>,
              <>Satu lembar formulir memuat 7 hari. Hari ke-8 dst masuk <strong>lembar lanjutan</strong> (Safety Checklist dan Verifikasi) pada dokumen PTW yang sama, bertanda &ldquo;Lembar Lanjutan&rdquo;.</>,
            ]}
          />
          <Lane
            title="Verifikasi (HSSE)" icon={Gavel} tone="slate"
            items={[
              <>Izin <Perm>ptw.verify_extension</Perm> dan ditugaskan di tahap Penomoran HSSE proyek itu.</>,
              <>Disetujui → tanggal berlaku PTW diperbarui langsung.</>,
              <>Ditolak (alasan wajib) → vendor melihat catatannya; PTW tetap berlaku sampai tanggal semula.</>,
            ]}
          />
        </div>

        <NoteBox tone="amber" icon={AlertTriangle} title="PTW yang sudah Expired">
          PTW yang sudah lewat masa berlakunya tidak bisa diperpanjang. Vendor harus menutupnya (lihat bagian
          berikut). Pengajuan perpanjangan dan keputusannya tercatat di Riwayat Dokumen.
        </NoteBox>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={CheckCircle2}
          title="Penutupan PTW"
          subtitle="Pekerjaan selesai? PTW ditutup lewat pengajuan vendor dan verifikasi HSSE."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Pengajuan (oleh vendor)" icon={Inbox} tone="emerald"
            items={[
              <>Untuk PTW Aktif atau Expired. Vendor mengisi <strong>checklist penutupan</strong> (pekerjaan selesai, area bersih, peralatan keluar, tidak ada bahaya tersisa, pekerja keluar), waktu selesai, dan catatan.</>,
              <>Diblokir otomatis selama masih ada pekerja yang <strong>belum check-out</strong>.</>,
              <>Status menjadi <strong>{PTW_STATUS.penutupanDiajukan}</strong>.</>,
            ]}
          />
          <Lane
            title="Verifikasi (HSSE)" icon={Gavel} tone="slate"
            items={[
              <>Izin <Perm>ptw.verify_closure</Perm> dan ditugaskan di tahap Penomoran HSSE proyek itu.</>,
              <>Disetujui → status <strong>{PTW_STATUS.selesai}</strong>; QR check-in dan daily check ditutup, PTW tidak bisa di-rollback.</>,
              <>Ditolak (alasan wajib) → PTW kembali Aktif dengan catatan untuk vendor.</>,
            ]}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <SectionTitle
          icon={Flag}
          title="Penyelesaian Proyek"
          subtitle="Penutup siklus: proyek dinyatakan selesai dan masuk Arsip."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Lane
            title="Syarat Pengajuan (oleh vendor)" icon={Inbox} tone="indigo"
            items={[
              <><strong>Semua PTW</strong> proyek berstatus {PTW_STATUS.selesai}.</>,
              <>Tidak ada <strong>Inspeksi</strong> yang belum ditutup pada proyek itu.</>,
              <>Vendor mengisi catatan penyelesaian lalu mengajukan.</>,
            ]}
          />
          <Lane
            title="Verifikasi (PM)" icon={Gavel} tone="slate"
            items={[
              <>Izin <Perm>ptw.verify_project_completion</Perm> dan ditugaskan di tahap Approval PM proyek itu.</>,
              <>Syarat dicek ulang saat disetujui (bisa saja ada temuan baru sejak diajukan).</>,
              <>Disetujui → status proyek <strong>Selesai</strong> dan masuk <strong>Arsip Proyek</strong>. Ditolak → catatan dikirim ke vendor.</>,
            ]}
          />
        </div>

        <NoteBox tone="slate" icon={ShieldCheck} title="Tidak lagi bisa diubah manual">
          Status &ldquo;Selesai&rdquo; tidak bisa diatur dari halaman edit proyek. Satu-satunya jalan adalah alur
          pengajuan dan verifikasi di atas, supaya proyek tidak ditutup sebelum izin dan temuannya beres.
        </NoteBox>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard icon={Camera} tone="blue" title="Inspeksi: tipe kegiatan">
            Setiap laporan di menu <strong>Inspeksi</strong> punya <strong>Tipe Kegiatan</strong>: Kegiatan Keproyekan,
            Non-Proyek (kantor/mess, tanpa vendor), atau Audit / Kunjungan. Jenis temuannya tetap Unsafe Condition,
            Unsafe Act, atau Near Miss. Daftar bisa difilter menurut tipe kegiatan.
          </FeatureCard>
          <FeatureCard icon={History} tone="slate" title="Semua tindakan terekam">
            Setiap persetujuan, penolakan, penutupan, perpanjangan, toolbox meeting, dan Stop Work tercatat di
            <strong> Riwayat Dokumen</strong> pada detail proyek, lengkap dengan pelaku, waktu, dan catatannya.
          </FeatureCard>
        </div>
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

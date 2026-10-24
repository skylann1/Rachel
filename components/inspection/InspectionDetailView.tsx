'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, CalendarClock, Building2, FolderKanban, User, UserCheck, BookOpen, Wrench, Lightbulb, ShieldAlert, Tag, History } from 'lucide-react';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
import { resolveInspectionGallery } from '@/lib/inspection-photos';
import { ACTIVITY_TYPE_META, normalizeActivityType } from '@/lib/inspection-activity';
import { dueState } from '@/lib/inspection-fields';

const PRIORITY_STYLE: Record<string, string> = {
  Critical: 'bg-rose-600 text-white',
  High: 'bg-amber-500 text-white',
  Medium: 'bg-blue-500 text-white',
  Low: 'bg-slate-500 text-white',
};
const STATUS_STYLE: Record<string, string> = {
  Open: 'bg-rose-100 text-rose-700 border-rose-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const DUE_STYLE = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  late: 'bg-rose-50 text-rose-700 border-rose-200',
  none: 'bg-slate-50 text-slate-500 border-slate-200',
};

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('id-ID') : '—');
const fmtDate = (v?: string | null) => (v ? new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <h2 className="px-6 py-4 border-b border-slate-100 text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">{icon}{title}</h2>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-slate-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-sm font-medium text-slate-800 break-words">{value || '—'}</div>
      </div>
    </div>
  );
}

function TextBlock({ title, icon, text }: { title: string; icon: React.ReactNode; text?: string | null }) {
  if (!text) return null;
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{icon}{title}</div>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/** Tampilan detail satu inspeksi — dipakai halaman internal dan vendor. `children` = panel aksi (sidebar kanan). */
export function InspectionDetailView({ inspection: i, backHref, children }: { inspection: any; backHref: string; children?: React.ReactNode }) {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const { photos } = resolveInspectionGallery(i);
  const activity = normalizeActivityType(i.activity_type);
  const due = dueState(i.due_date, i.status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Kembali ke daftar inspeksi
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg ${PRIORITY_STYLE[i.priority] ?? PRIORITY_STYLE.Low}`}>{i.priority}</span>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${STATUS_STYLE[i.status] ?? ''}`}>{i.status}</span>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${DUE_STYLE[due.tone]}`}>
            <CalendarClock className="w-3 h-3 inline -mt-0.5 mr-1" />{due.label}
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${ACTIVITY_TYPE_META[activity].badge}`}>{ACTIVITY_TYPE_META[activity].label}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mt-3">{i.title}</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">{i.id}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {photos.length > 0 && (
            <Card title={`Foto Temuan (${photos.length})`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((url, idx) => (
                  <button key={idx} type="button" onClick={() => setGalleryIndex(idx)} className="aspect-video rounded-xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-primary/40 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card title="Uraian Temuan" icon={<ShieldAlert className="w-4 h-4 text-primary" />}>
            <div className="space-y-5">
              <TextBlock title="Uraian Detail" icon={<BookOpen className="w-3.5 h-3.5" />} text={i.description || (i.title)} />
              <TextBlock title="Tindakan Segera yang Dilakukan" icon={<Wrench className="w-3.5 h-3.5" />} text={i.immediate_action} />
              <TextBlock title="Rekomendasi / Instruksi Perbaikan" icon={<Lightbulb className="w-3.5 h-3.5" />} text={i.recommendation} />
            </div>
          </Card>

          {(i.vendor_response || i.vendor_evidence_url) && (
            <Card title="Tindak Lanjut Vendor" icon={<Wrench className="w-4 h-4 text-emerald-600" />}>
              <div className="space-y-4">
                <TextBlock title="Tindakan Perbaikan" icon={<Wrench className="w-3.5 h-3.5" />} text={i.vendor_response} />
                {i.vendor_evidence_url && (
                  <button type="button" onClick={() => window.open(i.vendor_evidence_url, '_blank')} className="block w-full max-w-sm aspect-video rounded-xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-emerald-400/50 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.vendor_evidence_url} alt="Bukti perbaikan" className="w-full h-full object-cover" />
                  </button>
                )}
              </div>
            </Card>
          )}

          <Card title="Riwayat" icon={<History className="w-4 h-4 text-slate-500" />}>
            {i.logs.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada riwayat.</p>
            ) : (
              <ol className="relative border-l-2 border-slate-100 ml-2 space-y-5">
                {i.logs.map((log: any) => (
                  <li key={log.id} className="pl-5 relative">
                    <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white" />
                    <div className="text-sm font-bold text-slate-800">{log.action}</div>
                    {log.notes && <div className="text-sm text-slate-600 mt-0.5">{log.notes}</div>}
                    <div className="text-xs text-slate-400 mt-1">{log.profiles?.full_name ?? 'Sistem'} · {fmt(log.created_at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {children}
          <Card title="Informasi">
            <div className="space-y-4">
              <Field icon={<MapPin className="w-4 h-4" />} label="Lokasi" value={i.location} />
              <Field icon={<Clock className="w-4 h-4" />} label="Waktu Temuan" value={fmt(i.found_at ?? i.created_at)} />
              <Field icon={<CalendarClock className="w-4 h-4" />} label="Batas Perbaikan" value={fmtDate(i.due_date)} />
              <Field icon={<Tag className="w-4 h-4" />} label="Jenis / Kategori" value={[i.finding_type, i.category].filter(Boolean).join(' · ')} />
              <Field icon={<Building2 className="w-4 h-4" />} label="Vendor" value={i.vendor_name ?? 'Non-Vendor / Internal'} />
              <Field icon={<FolderKanban className="w-4 h-4" />} label="Proyek" value={i.project_name} />
              <Field icon={<User className="w-4 h-4" />} label="Pelapor" value={i.reporter_name} />
              <Field icon={<UserCheck className="w-4 h-4" />} label="Penanggung Jawab" value={i.assignee_name} />
              <Field icon={<ShieldAlert className="w-4 h-4" />} label="Dugaan Akar Penyebab" value={i.root_cause} />
              <Field icon={<BookOpen className="w-4 h-4" />} label="Referensi Regulasi / SOP" value={i.reference_std} />
              <Field icon={<Clock className="w-4 h-4" />} label="Dibuat" value={fmt(i.created_at)} />
            </div>
          </Card>
        </aside>
      </div>

      {galleryIndex !== null && <PhotoGalleryLightbox photos={photos} initialIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />}
    </div>
  );
}

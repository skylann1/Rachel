'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, UploadCloud, X, Loader2, Send } from 'lucide-react';
import { getVendorsAndProjects, createInspection } from '../actions';
import { uploadImage } from '@/utils/supabase/storage';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_META, type ActivityType } from '@/lib/inspection-activity';
import { FINDING_TYPES, PRIORITIES, HAZARD_CATEGORIES, ROOT_CAUSES, defaultDueDate } from '@/lib/inspection-fields';

const input = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm';
const label = 'text-sm font-semibold text-slate-700 block mb-2';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewInspectionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [activityType, setActivityType] = useState<ActivityType>('Proyek');
  const [vendorId, setVendorId] = useState('');
  const [priority, setPriority] = useState('Low');
  const [dueDate, setDueDate] = useState(defaultDueDate('Low'));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProjectActivity = activityType !== 'Non-Proyek';
  const vendorProjects = projects.filter((p) => p.vendor_id === vendorId);

  useEffect(() => {
    getVendorsAndProjects().then((vp) => {
      setVendors(vp.vendors);
      setProjects(vp.projects);
      setInternalUsers(vp.internalUsers);
    });
  }, []);

  const handlePriority = (value: string) => {
    setPriority(value);
    setDueDate(defaultDueDate(value)); // batas waktu ikut SLA prioritas; masih bisa diubah manual
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (imageFiles.length === 0) {
      setError('Unggah minimal satu foto temuan.');
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append('activity_type', activityType);
    try {
      const urls = await Promise.all(imageFiles.map((f) => uploadImage(f, 'inspections')));
      if (urls.some((u) => !u)) throw new Error('Sebagian foto gagal diunggah. Coba lagi.');
      urls.forEach((u) => formData.append('image_urls', u as string));
      const res = await createInspection(formData);
      router.push(res?.id ? `/dashboard/inspection/${res.id}` : '/dashboard/inspection');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Gagal membuat laporan temuan K3.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <Link href="/dashboard/inspection" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Kembali ke daftar inspeksi
        </Link>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-3 flex items-center gap-3">
          <Camera className="w-7 h-7 text-primary" /> Lapor Hasil Inspeksi
        </h1>
        <p className="text-sm text-slate-500 mt-1">Isi selengkap mungkin agar vendor dan tim HSE tahu persis apa yang harus ditindaklanjuti.</p>
      </div>

      <Section title="1. Jenis Kegiatan">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipe Kegiatan">
          {ACTIVITY_TYPES.map((t) => {
            const meta = ACTIVITY_TYPE_META[t];
            const selected = activityType === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => { setActivityType(t); if (t === 'Non-Proyek') setVendorId(''); }}
                className={`text-left rounded-xl border p-3 transition-all ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <span className={`block text-sm font-bold ${selected ? 'text-primary' : 'text-slate-700'}`}>{meta.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5 leading-snug">{meta.desc}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="2. Lokasi & Pihak Terkait">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Lokasi Temuan <span className="text-rose-500">*</span></label>
            <input name="location" required type="text" className={input} placeholder="Contoh: Area Boiler 1 / Pantri Kantor" />
          </div>
          <div>
            <label className={label}>Waktu Temuan</label>
            <input name="found_at" type="datetime-local" defaultValue={nowLocalInput()} className={input} />
          </div>
          {isProjectActivity ? (
            <>
              <div>
                <label className={label}>Vendor Terkait (Opsional)</label>
                <select name="target_vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={input}>
                  <option value="">Tidak ada / Pilih Vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Proyek (Opsional)</label>
                <select name="project_id" disabled={!vendorId} className={`${input} disabled:opacity-60`}>
                  <option value="">{vendorId ? 'Pilih proyek vendor' : 'Pilih vendor dulu'}</option>
                  {vendorProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className={label}>Catatan Keterlibatan</label>
              <input type="text" readOnly value="Tanggung Jawab Internal" className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500" />
            </div>
          )}
        </div>
      </Section>

      <Section title="3. Klasifikasi Temuan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Jenis Temuan <span className="text-rose-500">*</span></label>
            <select name="finding_type" required className={input}>
              {FINDING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Kategori Bahaya</label>
            <select name="category" className={input} defaultValue="">
              <option value="">Pilih kategori</option>
              {HAZARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Prioritas (Keparahan) <span className="text-rose-500">*</span></label>
            <select name="priority" required value={priority} onChange={(e) => handlePriority(e.target.value)} className={input}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Batas Waktu Perbaikan</label>
            <input name="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={input} />
            <p className="text-[11px] text-slate-500 mt-1">Otomatis mengikuti prioritas; bisa diubah.</p>
          </div>
        </div>
        {priority === 'Critical' && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl p-3">
            Prioritas Critical = pekerjaan di area ini harus dihentikan (Stop Work Authority) sampai bahaya dikendalikan.
          </div>
        )}
      </Section>

      <Section title="4. Uraian Temuan">
        <div>
          <label className={label}>Ringkasan Temuan <span className="text-rose-500">*</span></label>
          <input name="title" required type="text" className={input} placeholder="Satu kalimat, contoh: Pekerja tidak memakai full body harness di scaffolding" />
        </div>
        <div>
          <label className={label}>Uraian Detail</label>
          <textarea name="description" rows={4} className={`${input} resize-none`} placeholder="Kronologi, kondisi yang ditemukan, jumlah pekerja/peralatan yang terlibat, dll." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Dugaan Akar Penyebab</label>
            <select name="root_cause" className={input} defaultValue="">
              <option value="">Pilih penyebab</option>
              {ROOT_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Referensi Regulasi / SOP</label>
            <input name="reference_std" type="text" className={input} placeholder="Contoh: Permenaker 9/2016 Pasal 5" />
          </div>
        </div>
        <div>
          <label className={label}>Tindakan Segera yang Sudah Dilakukan</label>
          <textarea name="immediate_action" rows={2} className={`${input} resize-none`} placeholder="Contoh: Pekerjaan dihentikan, area diberi barikade." />
        </div>
        <div>
          <label className={label}>Rekomendasi / Instruksi Perbaikan</label>
          <textarea name="recommendation" rows={3} className={`${input} resize-none`} placeholder="Apa yang harus dilakukan vendor/pemilik area untuk menutup temuan ini." />
        </div>
      </Section>

      <Section title="5. Foto Temuan" hint="Minimal satu foto. Bisa lebih dari satu.">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => { setImageFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
        {imageFiles.length === 0 ? (
          <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer">
            <UploadCloud className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium">Klik untuk upload foto temuan</span>
            <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB per foto</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {imageFiles.map((file, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-slate-900/70 text-white rounded-full">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-primary/50 hover:text-primary transition-colors">
              <UploadCloud className="w-5 h-5" />
            </button>
          </div>
        )}
      </Section>

      <Section title="6. Penugasan">
        <div>
          <label className={label}>Petugas Penanggung Jawab (Opsional)</label>
          <select name="assigned_to" className={input} defaultValue="">
            <option value="">Tugaskan ke diri sendiri (default)</option>
            {internalUsers.map((u) => <option key={u.id} value={u.id}>{u.profiles.full_name}</option>)}
          </select>
        </div>
      </Section>

      {error && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">{error}</div>}

      <div className="flex justify-end gap-3">
        <Link href="/dashboard/inspection" className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</Link>
        <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl shadow-sm shadow-primary/30 flex items-center gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}
        </button>
      </div>
    </form>
  );
}

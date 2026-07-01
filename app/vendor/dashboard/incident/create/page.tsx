'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Calendar, Clock, Upload, Send, FileText, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitIncident, getVendorProjects } from './actions';

export default function VendorIncidentReportPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const projs = await getVendorProjects();
      setProjects(projs);
    }
    load();
  }, []);

  const handleKirim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      await submitIncident(formData);
      alert("Laporan Awal Insiden berhasil dikirim ke tim HSE PGN untuk diinvestigasi!");
      router.push('/vendor/dashboard/incident');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim laporan insiden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            Lapor Insiden K3
          </h1>
          <p className="text-sm text-slate-500 mt-1">Laporan awal jika terjadi kecelakaan kerja, near miss, atau tumpahan lingkungan di area proyek Anda.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Link 
             href="/vendor/dashboard/incident"
             className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
           >
             Batal
           </Link>
           <button 
             type="submit" 
             form="incident-form"
             disabled={isSubmitting}
             className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-rose-600/30"
           >
             <Send className="w-4 h-4" />
             {isSubmitting ? 'Mengirim...' : 'Kirim Laporan Awal'}
           </button>
        </div>
      </div>

      <form id="incident-form" onSubmit={handleKirim} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Section 1: Info Dasar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Informasi Kejadian (Laporan Awal)
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Jenis Insiden <span className="text-rose-500">*</span></label>
            <select name="type" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm">
              <option value="">-- Pilih Jenis --</option>
              <option value="near_miss">Near Miss (Hampir Celaka)</option>
              <option value="first_aid">First Aid (Cedera Ringan/P3K)</option>
              <option value="medical_treatment">Medical Treatment Case (Perawatan Medis)</option>
              <option value="lti">Lost Time Injury (Cedera Kehilangan Waktu Kerja)</option>
              <option value="fatality">Fatality (Kematian)</option>
              <option value="environmental">Environmental Spill (Tumpahan Lingkungan)</option>
              <option value="property_damage">Kerusakan Properti/Aset</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Proyek Terkait</label>
            <select name="project_id" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm">
              <option value="">-- Pilih Proyek Anda --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Tanggal Kejadian <span className="text-rose-500">*</span></label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Calendar className="w-4 h-4 text-slate-400" />
               </div>
               <input name="incident_date" required type="date" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Waktu Kejadian <span className="text-rose-500">*</span></label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Clock className="w-4 h-4 text-slate-400" />
               </div>
               <input name="incident_time" required type="time" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Lokasi Detail <span className="text-rose-500">*</span></label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <MapPin className="w-4 h-4 text-slate-400" />
               </div>
               <input name="location" required type="text" placeholder="Misal: Tangki T-04, Sisi Utara" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Section 2: Kronologi */}
        <div className="p-6 border-y border-slate-100 bg-slate-50/50 pt-8">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Kronologi & Deskripsi
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Deskripsikan Apa yang Terjadi <span className="text-rose-500">*</span></label>
            <textarea 
               name="chronology"
               required
               rows={4} 
               placeholder="Jelaskan secara singkat dan jelas runtutan kejadian..."
               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
            ></textarea>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Tindakan Langsung yang Diambil (Immediate Action)</label>
            <textarea 
               name="immediate_action"
               rows={3} 
               placeholder="Contoh: Menghentikan pekerjaan, membawa korban ke klinik..."
               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
            ></textarea>
          </div>
        </div>

        {/* Section 3: Dokumentasi */}
        <div className="p-6 border-y border-slate-100 bg-slate-50/50 pt-8">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Dokumentasi Kejadian
          </h2>
        </div>
        <div className="p-6">
           <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-rose-50 transition-colors">
                 <Upload className="w-8 h-8 text-slate-400 group-hover:text-rose-500 transition-colors" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1">Unggah Foto Insiden</h3>
              <p className="text-xs text-slate-500 mb-4">Format JPG, PNG, atau PDF (Maks. 5MB per file)</p>
               <input type="file" className="hidden" id="incident-photo" name="image" accept="image/*,.pdf" />
               <label htmlFor="incident-photo" className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-2 rounded-lg cursor-pointer">Pilih File</label>
            </div>
         </div>

      </form>
    </div>
  );
}

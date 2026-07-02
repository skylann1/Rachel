"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, MapPin, Calendar, Clock, Edit2, Trash2, Building2, Briefcase, Activity, X } from 'lucide-react';
import { createProject } from './actions';

interface ProjectClientProps {
  initialProjects: any[];
  vendors: any[];
}

export default function ProjectClient({ initialProjects, vendors }: ProjectClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Simple search filter
  const filteredProjects = initialProjects.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.vendor?.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    await createProject(formData);
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Data Proyek</h1>
          <p className="text-sm text-slate-500 mt-1">Daftar proyek pekerjaan yang sedang berjalan beserta status pengawasannya.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Registrasi Proyek Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama proyek atau vendor..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="block w-full sm:w-40 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50">
            <option>Semua Status</option>
            <option>On Progress</option>
            <option>Preparation</option>
            <option>Completed</option>
            <option>On Hold</option>
          </select>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {filteredProjects.map((project) => (
          <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col lg:flex-row gap-6">
            
            {/* Left Col: Main Info */}
            <div className="flex-1 flex gap-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <Briefcase className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">{project.id.substring(0,8)}</span>
                  {project.status === 'On Progress' && <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Activity className="w-3 h-3" /> Berjalan</span>}
                  {project.status === 'Completed' && <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Selesai</span>}
                  {project.status === 'Preparation' && <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Persiapan</span>}
                  {project.status === 'On Hold' && <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Ditunda</span>}
                </div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight">
                  {project.name}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-primary font-semibold">
                  <Building2 className="w-4 h-4" />
                  {project.vendor?.company_name || 'Tanpa Vendor'}
                </div>
              </div>
            </div>

            {/* Middle Col: Details */}
            <div className="flex-1 grid grid-cols-2 gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Lokasi Kerja</p>
                  <p className="text-sm font-semibold text-slate-700">{project.location}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Tanggal Mulai</p>
                  <p className="text-sm font-semibold text-slate-700">{project.start_date || '-'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Target Selesai</p>
                  <p className="text-sm font-semibold text-slate-700">{project.end_date || '-'}</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                     <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">Progress</p>
                     <span className="text-xs font-bold text-slate-700">{project.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${(project.progress || 0) === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${project.progress || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end lg:border-l lg:border-slate-100 lg:pl-6 gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
              <Link href={`/dashboard/master-data/project/${encodeURIComponent(project.id)}`} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors bg-slate-50 border border-slate-200 hover:border-primary/30" title="Edit Data Proyek">
                <Edit2 className="w-4 h-4" />
              </Link>
              <button className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors bg-slate-50 border border-slate-200 hover:border-rose-200" title="Hapus Proyek">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredProjects.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Briefcase className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Data Proyek Kosong</h3>
            <p className="text-slate-500 text-sm max-w-md text-center mb-6">
              Belum ada proyek yang terdaftar atau cocok dengan pencarian Anda. Silakan mulai inisiasi proyek baru dengan menekan tombol di bawah.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/30"
            >
              <Plus className="w-4 h-4" />
              Inisiasi Proyek Baru
            </button>
          </div>
        )}
      </div>

      {/* Modal Inisiasi Proyek Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Inisiasi Proyek Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Buat data proyek yang akan ditugaskan ke vendor.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                <div className="space-y-4">
                
                {/* Nama Pekerjaan / Proyek */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Pekerjaan / Proyek <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    placeholder="Contoh: Pekerjaan Perbaikan Pos Security Stasiun Muara Bekasi"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>

                {/* Deskripsi Proyek */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Deskripsi Proyek <span className="text-rose-500">*</span></label>
                  <textarea 
                    name="description"
                    required
                    placeholder="Jelaskan secara ringkas scope pekerjaan proyek ini agar vendor lebih paham saat menyusun prosedur..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm resize-none"
                  ></textarea>
                </div>

                {/* Nomor Kontrak */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nomor Kontrak <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    name="contract_number"
                    placeholder="Contoh: 006600.PMB-BP/LG.01/OP-CKR/PGAS/V/2026"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>

                {/* Lokasi Pekerjaan */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Lokasi Pekerjaan <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    name="location"
                    required
                    placeholder="Contoh: Stasiun Muara Bekasi"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>

                {/* Tanggal Mulai & Selesai */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Tanggal Mulai <span className="text-rose-500">*</span></label>
                    <input 
                      type="date" 
                      name="start_date"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Tanggal Selesai <span className="text-rose-500">*</span></label>
                    <input 
                      type="date" 
                      name="end_date"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Vendor Pelaksana */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Pilih Vendor Pelaksana <span className="text-rose-500">*</span></label>
                  <select name="vendor_id" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm">
                    <option value="">Pilih Mitra Vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Kategori Risiko Proyek */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-3">Kategori Risiko Proyek</label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="cursor-pointer">
                      <input type="radio" name="risk" className="peer sr-only" value="low" />
                      <div className="text-center px-4 py-3 border border-slate-200 rounded-xl peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-700 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">
                        Low Risk
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="risk" className="peer sr-only" value="moderate" />
                      <div className="text-center px-4 py-3 border border-slate-200 rounded-xl peer-checked:bg-amber-50 peer-checked:border-amber-500 peer-checked:text-amber-700 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">
                        Moderate Risk
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="risk" className="peer sr-only" value="high" />
                      <div className="text-center px-4 py-3 border border-slate-200 rounded-xl peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:text-rose-700 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">
                        High Risk
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Menentukan level pengawasan K3 dan detail JSA yang diwajibkan bagi vendor terkait.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm shadow-primary/30 disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Proyek'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Camera, AlertTriangle, CheckCircle, Clock, MapPin, Building2, UploadCloud, X, Loader2, Download, History, UserPlus } from 'lucide-react';
import { getInspections, getVendorsAndProjects, createInspection, delegateInspection, getInspectionLogs, validateInspection } from './actions';
import { uploadImage } from '@/utils/supabase/storage';

export default function InspectionPage() {
  const [filter, setFilter] = useState('All');
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisposisiModalOpen, setIsDisposisiModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isValidasiModalOpen, setIsValidasiModalOpen] = useState(false);
  
  // Data
  const [inspections, setInspections] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [validasiNotes, setValidasiNotes] = useState('');
  
  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  
  // Form toggles
  const [isProjectActivity, setIsProjectActivity] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await getInspections();
    const vp = await getVendorsAndProjects();
    setVendors(vp.vendors);
    setProjects(vp.projects);
    setInternalUsers(vp.internalUsers);
    
    const formatted = data.map((d: any) => ({
      id: d.id,
      type: d.finding_type,
      description: d.title,
      location: d.location,
      vendor: d.vendor_profiles?.company_name || 'Non-Vendor / Internal',
      date: new Date(d.created_at).toLocaleString('id-ID'),
      status: d.status,
      priority: d.priority,
      image: d.image_url || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
      assigned_to: d.internal_profiles?.profiles?.full_name || 'Belum di-assign',
      is_project_activity: d.is_project_activity,
      vendor_response: d.vendor_response,
      vendor_evidence_url: d.vendor_evidence_url
    }));
    setInspections(formatted);
  }

  // Combine filters
  const filteredInspections = inspections.filter(item => {
    const matchesStatus = filter === 'All' || item.status === filter;
    const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === '' || item.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesVendor = vendorFilter === '' || item.vendor === vendorFilter;
    
    return matchesStatus && matchesSearch && matchesLocation && matchesVendor;
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append('is_project_activity', isProjectActivity.toString());
    
    try {
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, 'inspections');
        if (imageUrl) formData.append('image_url', imageUrl);
      }

      await createInspection(formData);
      alert("Laporan hasil inspeksi berhasil dikirim!");
      setIsModalOpen(false);
      setImageFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal membuat laporan temuan K3.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisposisi = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const assigneeId = formData.get('assignee') as string;
    const notes = formData.get('notes') as string;

    try {
      await delegateInspection(selectedInspection.id, assigneeId, notes);
      alert('Berhasil mendisposisikan inspeksi!');
      setIsDisposisiModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal mendisposisikan tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidasi = async (approved: boolean, notes: string) => {
    if (!selectedInspection) return;
    setIsSubmitting(true);
    try {
      await validateInspection(selectedInspection.id, approved, notes);
      alert(approved ? 'Temuan berhasil divalidasi dan ditutup!' : 'Perbaikan dikembalikan ke vendor.');
      setIsValidasiModalOpen(false);
      setValidasiNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal memproses validasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openHistory = async (inspection: any) => {
    setSelectedInspection(inspection);
    setIsHistoryModalOpen(true);
    setIsLoadingLogs(true);
    try {
      const logs = await getInspectionLogs(inspection.id);
      setHistoryLogs(logs);
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Type', 'Description', 'Location', 'Vendor', 'Date', 'Status', 'Priority', 'Assigned To'];
    const csvContent = [
      headers.join(','),
      ...filteredInspections.map(item => 
        `"${item.id}","${item.type}","${item.description.replace(/"/g, '""')}","${item.location}","${item.vendor}","${item.date}","${item.status}","${item.priority}","${item.assigned_to}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Inspeksi_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Inspeksi Proyek</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola hasil inspeksi proyek & area non-proyek.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export PDF/Excel
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <Plus className="w-5 h-5" />
            Lapor Hasil Inspeksi
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
              placeholder="Cari deskripsi, lokasi..."
            />
          </div>
          
          {/* Advanced Filters */}
          <div className="flex flex-1 items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             <input 
               type="text" 
               placeholder="Filter Lokasi"
               value={locationFilter}
               onChange={(e) => setLocationFilter(e.target.value)}
               className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 w-32 md:w-40" 
             />
             <select 
               value={vendorFilter} 
               onChange={(e) => setVendorFilter(e.target.value)}
               className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 min-w-[150px]"
             >
               <option value="">Semua Vendor</option>
               <option value="Non-Vendor / Internal">Non-Vendor / Internal</option>
               {vendors.map(v => (
                 <option key={v.id} value={v.company_name}>{v.company_name}</option>
               ))}
             </select>
          </div>

          <div className="flex gap-2 w-full md:w-auto bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0">
             <button onClick={() => setFilter('All')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
             <button onClick={() => setFilter('Open')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Open' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Open</button>
             <button onClick={() => setFilter('In Progress')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'In Progress' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>In Progress</button>
             <button onClick={() => setFilter('Closed')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Closed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Closed</button>
          </div>
        </div>
      </div>

      {/* Grid of Finding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInspections.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            {/* Image Placeholder */}
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg shadow-sm ${
                     item.priority === 'Critical' ? 'bg-rose-600 text-white' : 
                     item.priority === 'High' ? 'bg-amber-500 text-white' : 
                     'bg-blue-500 text-white'
                  }`}>
                     {item.priority}
                  </span>
               </div>
               
               <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm backdrop-blur-md ${
                     item.status === 'Open' ? 'bg-rose-100/90 text-rose-700 border border-rose-200' :
                     item.status === 'In Progress' ? 'bg-amber-100/90 text-amber-700 border border-amber-200' :
                     'bg-emerald-100/90 text-emerald-700 border border-emerald-200'
                  }`}>
                     {item.status}
                  </span>
               </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
               <div className="flex items-center gap-2 mb-3">
                 <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase">
                   {item.is_project_activity ? 'Proyek' : 'Non-Proyek'}
                 </span>
                 <span className="text-xs font-bold text-slate-500">{item.type}</span>
               </div>
               
               <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-4 line-clamp-3">
                 "{item.description}"
               </p>

               <div className="mt-auto space-y-2 text-xs font-medium text-slate-600">
                 <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}</div>
                 <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {item.vendor}</div>
                 <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400" /> {item.date}</div>
                 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-slate-500 font-bold">
                   <UserPlus className="w-3.5 h-3.5 text-primary" /> Disposisi: <span className="text-primary">{item.assigned_to}</span>
                 </div>
               </div>
            </div>
            
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-2">
               <button onClick={() => openHistory(item)} className="px-3 py-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" title="Log History">
                  <History className="w-4 h-4" />
               </button>
               
               {item.status === 'Open' ? (
                  <button onClick={() => { setSelectedInspection(item); setIsDisposisiModalOpen(true); }} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-colors">
                     <UserPlus className="w-4 h-4" /> Disposisi Tugas
                  </button>
               ) : item.status === 'In Progress' ? (
                  <button onClick={() => { setSelectedInspection(item); setIsValidasiModalOpen(true); }} className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">
                     <CheckCircle className="w-4 h-4" /> Validasi Perbaikan
                  </button>
               ) : (
                  <button disabled className="w-full text-center py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg cursor-not-allowed">
                     Temuan Selesai Ditutup
                  </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Lapor Temuan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl h-[90vh] md:h-auto md:max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Lapor Hasil Inspeksi Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Catat temuan inspeksi untuk kegiatan proyek atau non-proyek.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
               {/* Tipe Kegiatan Toggle */}
               <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-sm font-bold text-slate-700">Tipe Kegiatan:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={isProjectActivity} onChange={() => setIsProjectActivity(true)} className="accent-primary" />
                    <span className="text-sm font-medium">Kegiatan Keproyekan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!isProjectActivity} onChange={() => setIsProjectActivity(false)} className="accent-primary" />
                    <span className="text-sm font-medium">Non-Proyek (Kantor/Mess)</span>
                  </label>
               </div>

               {/* Upload Foto */}
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Foto Temuan <span className="text-rose-500">*</span></label>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                     {imageFile ? (
                       <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <>
                         <UploadCloud className="w-6 h-6 mb-2" />
                         <span className="text-sm font-medium">Klik untuk upload foto temuan</span>
                         <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</span>
                       </>
                     )}
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jenis Temuan <span className="text-rose-500">*</span></label>
                    <select name="finding_type" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Unsafe Condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                      <option value="Unsafe Act">Unsafe Act (Tindakan Tidak Aman)</option>
                      <option value="Near Miss">Near Miss (Hampir Celaka)</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Priority (Keparahan) <span className="text-rose-500">*</span></label>
                    <select name="priority" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Low">Low (Bisa ditoleransi sementara)</option>
                      <option value="Medium">Medium (Perlu segera diperbaiki)</option>
                      <option value="High">High (Berpotensi cedera)</option>
                      <option value="Critical">Critical (Stop Work Authority!)</option>
                    </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Lokasi Temuan <span className="text-rose-500">*</span></label>
                    <input name="location" required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Area Boiler 1 / Pantri Kantor" />
                 </div>
                 
                 {isProjectActivity ? (
                   <div>
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Vendor Terkait (Opsional)</label>
                      <select name="target_vendor" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                        <option value="">Tidak ada / Pilih Vendor</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.company_name}</option>
                        ))}
                      </select>
                   </div>
                 ) : (
                   <div>
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Catatan Keterlibatan</label>
                      <input type="text" readOnly value="Tanggung Jawab Internal" className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500" />
                   </div>
                 )}
               </div>

               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Tugaskan Kepada (Opsional)</label>
                  <select name="assigned_to" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                    <option value="">Tugaskan ke Diri Sendiri (Default)</option>
                    {internalUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.profiles.full_name}</option>
                    ))}
                  </select>
               </div>

               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Deskripsi Temuan <span className="text-rose-500">*</span></label>
                  <textarea 
                     name="title"
                     required
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none" 
                     rows={4} 
                     placeholder="Deskripsikan dengan detail apa yang terjadi dan mengapa hal tersebut tidak aman..."
                  ></textarea>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-colors shadow-sm shadow-primary/30 flex items-center gap-2"
              >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 
                 {isSubmitting ? 'Submitting...' : 'Lapor Hasil'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Disposisi */}
      {isDisposisiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleDisposisi} className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Disposisi Inspeksi</h2>
              <button type="button" onClick={() => setIsDisposisiModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <span className="text-xs font-bold text-primary block mb-1">ID: {selectedInspection?.id}</span>
                <p className="text-sm font-medium text-slate-700 line-clamp-2">"{selectedInspection?.description}"</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Tugaskan Kepada (Inspektur) <span className="text-rose-500">*</span></label>
                <select name="assignee" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                  <option value="">Pilih Petugas Internal</option>
                  {internalUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.profiles.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Catatan Disposisi</label>
                <textarea 
                   name="notes"
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none" 
                   rows={3} 
                   placeholder="Misal: Tolong lanjutkan pengecekan di area belakang karena shift saya sudah habis."
                ></textarea>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setIsDisposisiModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2"
              >
                 {isSubmitting ? 'Memproses...' : 'Simpan Disposisi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Validasi Perbaikan */}
      {isValidasiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-primary" /> Validasi Perbaikan</h2>
              <button type="button" onClick={() => { setIsValidasiModalOpen(false); setValidasiNotes(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <span className="text-xs font-bold text-primary block mb-1">ID: {selectedInspection?.id}</span>
                <p className="text-sm font-medium text-slate-700 line-clamp-2">"{selectedInspection?.description}"</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Bukti Perbaikan dari Vendor</label>
                {selectedInspection?.vendor_evidence_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={selectedInspection.vendor_evidence_url} alt="Bukti Perbaikan" className="w-full h-48 object-cover rounded-xl border border-slate-200" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                    Vendor belum melampirkan foto bukti.
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Keterangan Perbaikan dari Vendor</label>
                <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  {selectedInspection?.vendor_response || 'Vendor belum memberikan keterangan.'}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Catatan Validasi (Opsional)</label>
                <textarea
                  value={validasiNotes}
                  onChange={(e) => setValidasiNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="Misal: Perbaikan sudah sesuai standar / masih perlu dilengkapi APD tambahan."
                ></textarea>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleValidasi(false, validasiNotes)}
                className="px-4 py-2 text-sm font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 disabled:opacity-50 rounded-xl transition-colors"
              >
                Tolak, Belum Sesuai
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleValidasi(true, validasiNotes)}
                className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Setujui & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Log History */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Log History Inspeksi</h2>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6">
              {isLoadingLogs ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">Belum ada riwayat aktivitas.</div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
                  {historyLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm"></div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short'})}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {log.profiles?.role}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">{log.action}</h4>
                      <p className="text-sm text-slate-600 mt-1">{log.notes}</p>
                      <p className="text-xs font-medium text-slate-400 mt-2">Oleh: {log.profiles?.full_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

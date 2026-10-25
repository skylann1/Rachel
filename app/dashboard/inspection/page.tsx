'use client';

import Link from 'next/link';
import { ModalPortal } from '@/components/ui/modal-portal';
import React, { useState, useEffect } from 'react';
import { Search, Plus, Camera, AlertTriangle, CheckCircle, Clock, MapPin, Building2, UploadCloud, X, Loader2, Download, History, UserPlus } from 'lucide-react';
import { getInspections, getVendorsAndProjects, delegateInspection, getInspectionLogs, validateInspection, closeInspectionDirectly } from './actions';
import { dueState } from '@/lib/inspection-fields';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
import { resolveInspectionGallery } from '@/lib/inspection-photos';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_META, normalizeActivityType, type ActivityType } from '@/lib/inspection-activity';

const SLA_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  late: 'bg-rose-50 text-rose-700 border-rose-200',
  none: 'hidden',
};

const STATUS_TABS = ['All', 'Open', 'In Progress', 'Closed'] as const;
const SELECT_CLS = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all';

export default function InspectionPage() {
  const [filter, setFilter] = useState('All');
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals
  const [isDisposisiModalOpen, setIsDisposisiModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isValidasiModalOpen, setIsValidasiModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  
  // Data
  const [inspections, setInspections] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [validasiNotes, setValidasiNotes] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  
  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  
  const [activityFilter, setActivityFilter] = useState<'All' | ActivityType>('All');
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data, error: loadError } = await getInspections();
    setLoadError(loadError);
    const vp = await getVendorsAndProjects();
    setVendors(vp.vendors);
    setProjects(vp.projects);
    setInternalUsers(vp.internalUsers);
    
    const formatted = data.map((d: any) => {
      const { image, photos } = resolveInspectionGallery(d);
      return {
        id: d.id,
        type: d.finding_type,
        description: d.title,
        location: d.location,
        vendor: d.vendor_profiles?.company_name || 'Non-Vendor / Internal',
        hasVendor: !!d.target_vendor,
        date: new Date(d.created_at).toLocaleString('id-ID'),
        status: d.status,
        due_date: d.due_date,
        priority: d.priority,
        image,
        photos,
        assigned_to: d.internal_profiles?.profiles?.full_name || 'Belum di-assign',
        is_project_activity: d.is_project_activity,
        activity_type: normalizeActivityType(d.activity_type),
        vendor_response: d.vendor_response,
        vendor_evidence_url: d.vendor_evidence_url
      };
    });
    setInspections(formatted);
  }

  // Combine filters
  const filteredInspections = inspections.filter(item => {
    const matchesStatus = filter === 'All' || item.status === filter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || item.description.toLowerCase().includes(q) || item.location.toLowerCase().includes(q) || item.vendor.toLowerCase().includes(q);
    const matchesLocation = locationFilter === '' || item.location === locationFilter;
    const matchesPriority = priorityFilter === '' || item.priority === priorityFilter;
    const matchesVendor = vendorFilter === '' || item.vendor === vendorFilter;
    const matchesActivity = activityFilter === 'All' || item.activity_type === activityFilter;
    
    return matchesStatus && matchesSearch && matchesLocation && matchesVendor && matchesActivity && matchesPriority;
  });

  const locationOptions = Array.from(new Set(inspections.map((i) => i.location).filter(Boolean))).sort() as string[];
  const statusCounts: Record<string, number> = { All: inspections.length };
  inspections.forEach((i) => { statusCounts[i.status] = (statusCounts[i.status] ?? 0) + 1; });
  const hasActiveFilter = !!(searchQuery || locationFilter || vendorFilter || priorityFilter || activityFilter !== 'All' || filter !== 'All');
  const resetFilters = () => {
    setSearchQuery(''); setLocationFilter(''); setVendorFilter(''); setPriorityFilter(''); setActivityFilter('All'); setFilter('All');
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

  const handleCloseDirectly = async () => {
    if (!selectedInspection) return;
    setIsSubmitting(true);
    try {
      await closeInspectionDirectly(selectedInspection.id, closeNotes);
      alert('Temuan berhasil ditutup!');
      setIsCloseModalOpen(false);
      setCloseNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Gagal menutup temuan.');
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
    const esc = (val: unknown) => String(val ?? '').replace(/"/g, '""');
    const headers = ['ID', 'Tipe Kegiatan', 'Type', 'Description', 'Location', 'Vendor', 'Date', 'Status', 'Priority', 'Assigned To'];
    const csvContent = [
      headers.join(','),
      ...filteredInspections.map(item =>
        `"${esc(item.id)}","${esc(item.activity_type)}","${esc(item.type)}","${esc(item.description)}","${esc(item.location)}","${esc(item.vendor)}","${esc(item.date)}","${esc(item.status)}","${esc(item.priority)}","${esc(item.assigned_to)}"`
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
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Inspeksi</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola hasil inspeksi proyek, area non-proyek, serta audit & kunjungan.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export PDF/Excel
          </button>
          <Link
            href="/dashboard/inspection/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <Plus className="w-5 h-5" />
            Lapor Hasil Inspeksi
          </Link>
        </div>
      </div>

      {/* Filter & pencarian */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm transition-all"
              placeholder="Cari deskripsi, lokasi, vendor..."
            />
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0 self-start lg:self-auto">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3.5 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${filter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s === 'All' ? 'Semua' : s}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filter === s ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/70 text-slate-500'}`}>{statusCounts[s] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={SELECT_CLS}>
            <option value="">Semua Lokasi</option>
            {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className={SELECT_CLS}>
            <option value="">Semua Vendor</option>
            <option value="Non-Vendor / Internal">Non-Vendor / Internal</option>
            {vendors.map((v) => <option key={v.id} value={v.company_name}>{v.company_name}</option>)}
          </select>
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as 'All' | ActivityType)} className={SELECT_CLS}>
            <option value="All">Semua Tipe Kegiatan</option>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_META[t].label}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={SELECT_CLS}>
            <option value="">Semua Prioritas</option>
            {['Critical', 'High', 'Medium', 'Low'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan <b className="text-slate-700">{filteredInspections.length}</b> dari {inspections.length} temuan</span>
          {hasActiveFilter && (
            <button onClick={resetFilters} className="font-bold text-primary hover:underline">Reset filter</button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          <p className="font-bold">Gagal memuat data inspeksi.</p>
          <p className="font-mono text-xs mt-1 break-all">{loadError}</p>
        </div>
      )}

      {/* Daftar temuan */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 w-16">Foto</th>
                <th className="px-4 py-3">Temuan</th>
                <th className="px-4 py-3">Lokasi / Vendor</th>
                <th className="px-4 py-3 whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-3">Prioritas</th>
                <th className="px-4 py-3">Status / SLA</th>
                <th className="px-4 py-3">Disposisi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInspections.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Tidak ada temuan yang cocok dengan filter.</td></tr>
              )}
              {filteredInspections.map((item) => {
                const sla = dueState(item.due_date, item.status);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors align-top">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={item.photos.length === 0}
                        onClick={() => { setGalleryPhotos(item.photos); setGalleryIndex(0); }}
                        className="relative block w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 disabled:cursor-default"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt={item.type} className="w-full h-full object-cover" />
                        {item.photos.length > 1 && (
                          <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-slate-900/70 text-white rounded-tl">+{item.photos.length - 1}</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${ACTIVITY_TYPE_META[item.activity_type as ActivityType].badge}`}>{item.activity_type}</span>
                        <span className="text-xs font-bold text-slate-500">{item.type}</span>
                      </div>
                      <p className="font-semibold text-slate-800 line-clamp-2">{item.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {item.location}</div>
                      <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {item.vendor}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-md ${
                        item.priority === 'Critical' ? 'bg-rose-600 text-white' :
                        item.priority === 'High' ? 'bg-amber-500 text-white' :
                        item.priority === 'Medium' ? 'bg-sky-100 text-sky-700' : 'bg-blue-500 text-white'
                      }`}>{item.priority}</span>
                    </td>
                    <td className="px-4 py-3 space-y-1.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md border ${
                        item.status === 'Open' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        item.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>{item.status}</span>
                      {sla.tone !== 'none' && (
                        <div><span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${SLA_TONE[sla.tone]}`}>SLA: {sla.label}</span></div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-primary">{item.assigned_to}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dashboard/inspection/${item.id}`} className="px-2.5 py-1.5 text-xs font-bold text-primary bg-white border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Detail</Link>
                        <button onClick={() => openHistory(item)} className="p-1.5 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" title="Log History">
                          <History className="w-4 h-4" />
                        </button>
                        {item.status === 'Open' ? (
                          item.hasVendor ? (
                            <button onClick={() => { setSelectedInspection(item); setIsDisposisiModalOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg whitespace-nowrap transition-colors">
                              <UserPlus className="w-3.5 h-3.5" /> Disposisi
                            </button>
                          ) : (
                            <button onClick={() => { setSelectedInspection(item); setIsCloseModalOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" /> Tutup
                            </button>
                          )
                        ) : item.status === 'In Progress' ? (
                          <button onClick={() => { setSelectedInspection(item); setIsValidasiModalOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg whitespace-nowrap transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Validasi
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Disposisi */}
      {isDisposisiModalOpen && (
        <ModalPortal zIndex={100}>
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
        </ModalPortal>
      )}

      {/* Modal Tutup Langsung (temuan tanpa vendor) */}
      {isCloseModalOpen && (
        <ModalPortal zIndex={100}>
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-600" /> Tutup Langsung</h2>
              <button type="button" onClick={() => { setIsCloseModalOpen(false); setCloseNotes(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <span className="text-xs font-bold text-primary block mb-1">ID: {selectedInspection?.id}</span>
                <p className="text-sm font-medium text-slate-700 line-clamp-2">"{selectedInspection?.description}"</p>
              </div>
              <p className="text-xs text-slate-500">
                Temuan non-proyek/internal ini tidak ditujukan ke vendor — tutup langsung dengan catatan perbaikan yang sudah dilakukan.
              </p>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Catatan Penutupan</label>
                <textarea
                   value={closeNotes}
                   onChange={(e) => setCloseNotes(e.target.value)}
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                   rows={3}
                   placeholder="Misal: Area sudah dirapikan dan APD tambahan sudah disediakan."
                ></textarea>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button type="button" onClick={() => { setIsCloseModalOpen(false); setCloseNotes(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCloseDirectly}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2"
              >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                 {isSubmitting ? 'Menutup...' : 'Tutup Temuan'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Validasi Perbaikan */}
      {isValidasiModalOpen && (
        <ModalPortal zIndex={100}>
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
        </ModalPortal>
      )}

      {/* Modal Log History */}
      {isHistoryModalOpen && (
        <ModalPortal zIndex={100}>
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
        </ModalPortal>
      )}

      {/* Lightbox Galeri Foto */}
      {galleryPhotos && (
        <PhotoGalleryLightbox
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryPhotos(null)}
        />
      )}

    </div>
  );
}

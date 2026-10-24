'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { getLocationsForManagement, addLocation, updateLocation, deleteLocation, toggleLocationActive, type Location } from './actions';

const input = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm';

export default function LocationPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const res = await getLocationsForManagement();
    setLocations(res.data);
    setLoadError(res.error);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openForm = (loc: Location | null) => { setEditing(loc); setFormError(null); setFormOpen(true); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    const res = editing ? await updateLocation(editing.id, formData) : await addLocation(formData);
    setSaving(false);
    if (res.error) { setFormError(res.error); return; }
    setFormOpen(false);
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (loc: Location) => {
    if (!confirm(`Hapus lokasi "${loc.name}"? Aksi ini tidak dapat dibatalkan.`)) return;
    const res = await deleteLocation(loc.id);
    if (res.error) alert(res.error); else fetchData();
  };

  const handleToggle = async (loc: Location) => {
    const res = await toggleLocationActive(loc.id, !loc.is_active);
    if (res.error) alert(res.error); else fetchData();
  };

  const q = search.trim().toLowerCase();
  const shown = locations.filter((l) => !q || [l.name, l.code, l.region, l.address].some((v) => v?.toLowerCase().includes(q)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" /> Master Lokasi
          </h1>
          <p className="text-sm text-slate-500 mt-1">Daftar stasiun / area kerja yang dipilih saat membuat proyek baru.</p>
        </div>
        <button onClick={() => openForm(null)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30">
          <Plus className="w-4 h-4" /> Tambah Lokasi
        </button>
      </div>

      {loadError && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700"><p className="font-bold">Gagal memuat lokasi.</p><p className="font-mono text-xs mt-1 break-all">{loadError}</p></div>}

      {formOpen && (
        <form onSubmit={handleSubmit} key={editing?.id ?? 'new'} className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">{editing ? 'Ubah Lokasi' : 'Tambah Lokasi Baru'}</h2>
            <button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Lokasi <span className="text-rose-500">*</span></label>
              <input name="name" required defaultValue={editing?.name ?? ''} className={input} placeholder="Contoh: Stasiun Muara Bekasi" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Kode</label>
              <input name="code" defaultValue={editing?.code ?? ''} className={input} placeholder="Contoh: MBK" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Wilayah / Zona</label>
              <input name="region" defaultValue={editing?.region ?? ''} className={input} placeholder="Contoh: Jawa Barat" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Alamat</label>
              <textarea name="address" rows={2} defaultValue={editing?.address ?? ''} className={`${input} resize-none`} placeholder="Alamat lengkap (opsional)" />
            </div>
            {formError && <p className="sm:col-span-2 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{formError}</p>}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
            <button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl">Batal</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, wilayah..." className={`${input} sm:max-w-sm`} />
        </div>
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <MapPin className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">{locations.length === 0 ? 'Belum ada lokasi.' : 'Tidak ada lokasi yang cocok.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  {['Lokasi', 'Kode', 'Wilayah', 'Proyek', 'Status', 'Aksi'].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800">{loc.name}</div>
                      {loc.address && <div className="text-xs text-slate-500 line-clamp-1">{loc.address}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loc.code || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loc.region || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loc.project_count ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${loc.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{loc.is_active ? 'Aktif' : 'Nonaktif'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleToggle(loc)} title={loc.is_active ? 'Nonaktifkan' : 'Aktifkan'} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg">{loc.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                        <button onClick={() => openForm(loc)} title="Edit" className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(loc)} title="Hapus" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

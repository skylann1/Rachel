'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Clock, Edit2, Trash2, Truck, Loader2 } from 'lucide-react';
import { getEquipment, saveEquipment, deleteEquipment, EquipmentItem } from './actions';

const CATEGORIES = ['Alat Berat', 'Lifting Gear', 'Mesin Las', 'Power Supply', 'Lainnya'];

const emptyForm = {
  id: undefined as string | undefined,
  name: '',
  category: '',
  brand: '',
  certificate_number: '',
  certificate_expiry: '',
};

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function PeralatanMasterPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');

  const fetchEquipment = async () => {
    setIsLoading(true);
    try {
      setEquipment(await getEquipment());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchEquipment(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return equipment.filter(e => {
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      const expired = isExpired(e.certificate_expiry);
      const matchesStatus = statusFilter === 'Semua Status' || (statusFilter === 'Active' && !expired) || (statusFilter === 'Expired' && expired);
      return matchesQuery && matchesStatus;
    });
  }, [equipment, query, statusFilter]);

  const openAdd = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (e: EquipmentItem) => {
    setForm({
      id: e.id,
      name: e.name,
      category: e.category,
      brand: e.brand || '',
      certificate_number: e.certificate_number || '',
      certificate_expiry: e.certificate_expiry || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) {
      alert('Nama dan jenis peralatan wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      await saveEquipment(form);
      setIsModalOpen(false);
      await fetchEquipment();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data peralatan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data peralatan ini?')) return;
    try {
      await deleteEquipment(id);
      await fetchEquipment();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data peralatan.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Data Peralatan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola master data peralatan dan mesin untuk digunakan di proyek-proyek Anda.
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <Plus className="w-4 h-4" />
            Tambah Peralatan
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama atau jenis alat..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50"
          >
            <option>Semua Status</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      {/* List / Table of Equipments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Alat & Merek</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis Peralatan</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">No. SILO / SIA</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Masa Berlaku</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {equipment.length === 0 ? 'Belum ada data peralatan. Tambahkan peralatan pertama Anda.' : 'Tidak ada peralatan yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filtered.map((alat) => {
                  const expired = isExpired(alat.certificate_expiry);
                  return (
                  <tr key={alat.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-800">{alat.name}</div>
                          <div className="text-xs text-slate-500">Merek: {alat.brand || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {alat.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-800 font-mono">{alat.certificate_number || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className={`w-4 h-4 ${expired ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span className={expired ? 'text-rose-600 font-bold' : ''}>
                          {alat.certificate_expiry ? new Date(alat.certificate_expiry).toLocaleDateString('id-ID') : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        !expired ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(alat)} className="text-slate-400 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg" title="Edit Data">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(alat.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg" title="Hapus Data">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Peralatan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Data Peralatan' : 'Tambah Data Peralatan'}</h2>
                <p className="text-sm text-slate-500 mt-1">Masukkan spesifikasi alat beserta sertifikat kelayakannya.</p>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Peralatan / Mesin <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Excavator PC200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jenis Peralatan <span className="text-rose-500">*</span></label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="">Pilih Jenis</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c === 'Power Supply' ? 'Power Supply (Genset)' : c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Merek / Brand</label>
                    <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Komatsu, Miller" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">No. SILO / SIA</label>
                    <input type="text" value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Nomor Sertifikat Kelayakan" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Masa Berlaku</label>
                    <input type="date" value={form.certificate_expiry} onChange={(e) => setForm({ ...form, certificate_expiry: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm text-slate-700" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm shadow-primary/30 flex items-center gap-2 disabled:opacity-70">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

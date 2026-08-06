'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, Users } from 'lucide-react';
import { getWorkers, saveWorker, deleteWorker, WorkerItem } from './actions';

const emptyForm = {
  id: undefined as string | undefined,
  full_name: '',
  position: '',
  ktp_number: '',
  bpjs_number: '',
  certification: '',
  status: 'Active' as 'Active' | 'Inactive',
};

export default function PekerjaMasterPage() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      setWorkers(await getWorkers());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWorkers(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return workers.filter(w => {
      const matchesQuery = !q || w.full_name.toLowerCase().includes(q) || w.position.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'Semua Status' || w.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [workers, query, statusFilter]);

  const openAdd = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (w: WorkerItem) => {
    setForm({
      id: w.id,
      full_name: w.full_name,
      position: w.position,
      ktp_number: w.ktp_number || '',
      bpjs_number: w.bpjs_number || '',
      certification: w.certification || '',
      status: w.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.position) {
      alert('Nama dan jabatan wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      await saveWorker(form);
      setIsModalOpen(false);
      await fetchWorkers();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data pekerja.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data pekerja ini?')) return;
    try {
      await deleteWorker(id);
      await fetchWorkers();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data pekerja.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Data Pekerja</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola master data pekerja untuk didaftarkan ke proyek-proyek Anda.
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <Plus className="w-4 h-4" />
            Tambah Pekerja
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
            placeholder="Cari nama atau jabatan..."
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
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* List / Table of Workers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Pekerja</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Jabatan</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">No. KTP / BPJS</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sertifikasi</th>
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
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {workers.length === 0 ? 'Belum ada data pekerja. Tambahkan pekerja pertama Anda.' : 'Tidak ada pekerja yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filtered.map((pekerja) => (
                  <tr key={pekerja.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {pekerja.full_name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-800">{pekerja.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {pekerja.position}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-800">{pekerja.ktp_number || '—'} (KTP)</div>
                      <div className="text-xs text-slate-500">{pekerja.bpjs_number || '—'} (BPJS)</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pekerja.certification ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {pekerja.certification || 'Tidak Ada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pekerja.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {pekerja.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(pekerja)} className="text-slate-400 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg" title="Edit Data">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(pekerja.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg" title="Hapus Data">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Pekerja */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Data Pekerja' : 'Tambah Data Pekerja'}</h2>
                <p className="text-sm text-slate-500 mt-1">Masukkan profil pekerja beserta dokumen identitas.</p>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Lengkap <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Budi Santoso" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Jabatan / Posisi <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Welder, Helper, dll" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">No. KTP</label>
                    <input type="text" value={form.ktp_number} onChange={(e) => setForm({ ...form, ktp_number: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="16 Digit NIK" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">No. BPJS Ketenagakerjaan</label>
                    <input type="text" value={form.bpjs_number} onChange={(e) => setForm({ ...form, bpjs_number: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Nomor BPJS" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Sertifikasi Spesifik (Opsional)</label>
                  <input type="text" value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Ahli K3 Umum, Welder 6G" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
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

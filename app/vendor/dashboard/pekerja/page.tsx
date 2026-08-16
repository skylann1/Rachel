'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, Users, ShieldCheck, Wrench, AlertTriangle } from 'lucide-react';
import { getWorkers, saveWorker, deleteWorker, WorkerItem, CompetencyItem } from './actions';
import { FileUploadField } from '@/components/vendor/file-upload-field';
import { getExpiry, expiryLabel, EXPIRY_TONE, worstExpiry } from '@/lib/document-expiry';

const emptyForm = {
  id: undefined as string | undefined,
  full_name: '',
  position: '',
  ktp_number: '',
  bpjs_number: '',
  education: '',
  id_card_url: null as string | null,
  status: 'Active' as 'Active' | 'Inactive',
  competencies: [] as CompetencyItem[],
};

const emptyCompetency: CompetencyItem = {
  category: 'Safety',
  title: '',
  valid_from: null,
  valid_to: null,
  document_url: null,
};

const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm';

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

  // Berapa pekerja yang punya kompetensi kedaluwarsa — dipakai sebagai peringatan di atas tabel.
  const expiredCount = useMemo(
    () => workers.filter(w => worstExpiry(w.competencies.map(c => c.valid_to)) === 'expired').length,
    [workers],
  );

  const openAdd = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (w: WorkerItem) => {
    setForm({
      id: w.id,
      full_name: w.full_name,
      position: w.position,
      ktp_number: w.ktp_number || '',
      bpjs_number: w.bpjs_number || '',
      education: w.education || '',
      id_card_url: w.id_card_url,
      status: w.status,
      competencies: w.competencies.map(c => ({ ...c })),
    });
    setIsModalOpen(true);
  };

  const updateCompetency = (index: number, patch: Partial<CompetencyItem>) => {
    setForm(prev => ({
      ...prev,
      competencies: prev.competencies.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const addCompetency = (category: 'Safety' | 'Teknis') => {
    setForm(prev => ({ ...prev, competencies: [...prev.competencies, { ...emptyCompetency, category }] }));
  };

  const removeCompetency = (index: number) => {
    setForm(prev => ({ ...prev, competencies: prev.competencies.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!form.full_name || !form.position) {
      alert('Nama dan jabatan wajib diisi.');
      return;
    }
    const incomplete = form.competencies.find(c => c.title.trim() && c.valid_from && c.valid_to && c.valid_to < c.valid_from);
    if (incomplete) {
      alert(`Masa berlaku kompetensi "${incomplete.title}" tidak valid — tanggal akhir mendahului tanggal mulai.`);
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

  const renderCompetencyGroup = (category: 'Safety' | 'Teknis') => {
    const Icon = category === 'Safety' ? ShieldCheck : Wrench;
    const rows = form.competencies
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.category === category);

    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Icon className="w-4 h-4 text-primary" />
            Kompetensi {category}
          </span>
          <button
            type="button"
            onClick={() => addCompetency(category)}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada kompetensi {category.toLowerCase()}.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(({ c, i }) => {
              const info = getExpiry(c.valid_to);
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={c.title}
                      onChange={(e) => updateCompetency(i, { title: e.target.value })}
                      className={inputClass}
                      placeholder={category === 'Safety' ? 'Contoh: HSSE Passport' : 'Contoh: Basic Coating'}
                    />
                    <button
                      type="button"
                      onClick={() => removeCompetency(i)}
                      className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title="Hapus kompetensi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Berlaku dari</label>
                      <input
                        type="date"
                        value={c.valid_from || ''}
                        onChange={(e) => updateCompetency(i, { valid_from: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Sampai</label>
                      <input
                        type="date"
                        value={c.valid_to || ''}
                        onChange={(e) => updateCompetency(i, { valid_to: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {c.valid_to && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${EXPIRY_TONE[info.status]}`}>
                      {expiryLabel(info)}
                    </span>
                  )}

                  <FileUploadField
                    label="Bukti dokumen"
                    value={c.document_url}
                    onChange={(url) => updateCompetency(i, { document_url: url })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Data Pekerja</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola master data pekerja beserta kompetensinya untuk ditarik ke JSA dan proyek berikutnya.
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

      {expiredCount > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold text-rose-800">
            {expiredCount} pekerja memiliki kompetensi yang sudah kedaluwarsa. Perbarui sebelum didaftarkan ke pekerjaan baru.
          </p>
        </div>
      )}

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
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Identitas</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kompetensi</th>
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
                filtered.map((pekerja) => {
                  const worst = worstExpiry(pekerja.competencies.map(c => c.valid_to));
                  return (
                    <tr key={pekerja.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {pekerja.full_name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-slate-800">{pekerja.full_name}</div>
                            {pekerja.education && <div className="text-xs text-slate-500">{pekerja.education}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {pekerja.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-800">{pekerja.ktp_number || '—'} (KTP)</div>
                        <div className="text-xs text-slate-500">{pekerja.bpjs_number || '—'} (BPJS)</div>
                        {pekerja.id_card_url && (
                          <a href={pekerja.id_card_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline">
                            Lihat ID Card
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {pekerja.competencies.length === 0 ? (
                          <span className="text-xs text-slate-400">Belum ada</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-700">{pekerja.competencies.length} kompetensi</span>
                            <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${EXPIRY_TONE[worst]}`}>
                              {worst === 'expired' ? 'Ada yang kedaluwarsa'
                                : worst === 'expiring' ? 'Ada yang segera berakhir'
                                : worst === 'valid' ? 'Semua berlaku'
                                : 'Tanpa masa berlaku'}
                            </span>
                          </div>
                        )}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Pekerja */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Data Pekerja' : 'Tambah Data Pekerja'}</h2>
                <p className="text-sm text-slate-500 mt-1">Profil pekerja, dokumen identitas, dan kompetensi yang dimiliki.</p>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Lengkap <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} placeholder="Contoh: Budi Santoso" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jabatan / Posisi <span className="text-rose-500">*</span></label>
                    <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={inputClass} placeholder="Contoh: Operator Cat" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Pendidikan Formal</label>
                    <input type="text" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} className={inputClass} placeholder="Contoh: SMA" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">No. KTP</label>
                    <input type="text" value={form.ktp_number} onChange={(e) => setForm({ ...form, ktp_number: e.target.value })} className={inputClass} placeholder="16 Digit NIK" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">No. BPJS Ketenagakerjaan</label>
                    <input type="text" value={form.bpjs_number} onChange={(e) => setForm({ ...form, bpjs_number: e.target.value })} className={inputClass} placeholder="Nomor BPJS" />
                  </div>
                </div>

                <FileUploadField
                  label="ID Card"
                  value={form.id_card_url}
                  onChange={(url) => setForm({ ...form, id_card_url: url })}
                  hint="Foto atau PDF kartu identitas pekerja, maksimal 5MB."
                />

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })} className={inputClass}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="pt-2 space-y-4">
                  {renderCompetencyGroup('Safety')}
                  {renderCompetencyGroup('Teknis')}
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

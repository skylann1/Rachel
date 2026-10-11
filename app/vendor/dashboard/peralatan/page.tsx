'use client';

import { ModalPortal } from '@/components/ui/modal-portal';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, Truck, AlertTriangle } from 'lucide-react';
import { getEquipment, saveEquipment, deleteEquipment, EquipmentItem } from './actions';
import type { AssetDocumentItem } from '@/lib/asset-document';
import { FileUploadField } from '@/components/vendor/file-upload-field';
import { AssetDocumentEditor } from '@/components/vendor/asset-document-editor';
import { EXPIRY_TONE, worstExpiry } from '@/lib/document-expiry';

const emptyForm = {
  id: undefined as string | undefined,
  name: '',
  category: '',
  brand: '',
  type_serial: '',
  dimension: '',
  capacity: '',
  quantity: 1,
  unit: 'unit',
  photo_url: null as string | null,
  documents: [] as AssetDocumentItem[],
};

const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm';

export default function PeralatanMasterPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');

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
    return equipment.filter(e =>
      !q || e.name.toLowerCase().includes(q) || (e.brand || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
    );
  }, [equipment, query]);

  const expiredCount = useMemo(
    () => equipment.filter(e => worstExpiry(e.documents.map(d => d.valid_to)) === 'expired').length,
    [equipment],
  );

  const openAdd = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (e: EquipmentItem) => {
    setForm({
      id: e.id,
      name: e.name,
      category: e.category,
      brand: e.brand || '',
      type_serial: e.type_serial || '',
      dimension: e.dimension || '',
      capacity: e.capacity || '',
      quantity: e.quantity ?? 1,
      unit: e.unit || 'unit',
      photo_url: e.photo_url,
      documents: e.documents.map(d => ({ ...d })),
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) {
      alert('Nama alat dan kategori wajib diisi.');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Data Peralatan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola master data peralatan beserta dokumen kelayakannya untuk ditarik ke JSA dan proyek berikutnya.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Peralatan
        </button>
      </div>

      {expiredCount > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold text-rose-800">
            {expiredCount} peralatan memiliki dokumen yang sudah kedaluwarsa. Perbarui sebelum digunakan di pekerjaan baru.
          </p>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama, merek, atau kategori..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Peralatan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Spesifikasi</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dokumen</th>
                <th className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {equipment.length === 0 ? 'Belum ada data peralatan. Tambahkan peralatan pertama Anda.' : 'Tidak ada peralatan yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filtered.map((alat) => {
                  const worst = worstExpiry(alat.documents.map(d => d.valid_to));
                  return (
                    <tr key={alat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">{alat.name}</div>
                        <div className="text-xs text-slate-500">{alat.category}{alat.brand ? ` • ${alat.brand}` : ''}</div>
                        {alat.photo_url && (
                          <a href={alat.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline">
                            Lihat foto
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{alat.type_serial || '—'}</div>
                        <div className="text-xs text-slate-500">
                          {alat.dimension ? `${alat.dimension}` : ''}{alat.dimension && alat.capacity ? ' • ' : ''}{alat.capacity || ''}
                          {!alat.dimension && !alat.capacity && '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700 tabular-nums">
                        {alat.quantity ?? 1} {alat.unit || 'unit'}
                      </td>
                      <td className="px-6 py-4">
                        {alat.documents.length === 0 ? (
                          <span className="text-xs text-slate-400">Belum ada</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-700">{alat.documents.length} dokumen</span>
                            <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${EXPIRY_TONE[worst]}`}>
                              {worst === 'expired' ? 'Ada yang kedaluwarsa'
                                : worst === 'expiring' ? 'Ada yang segera berakhir'
                                : worst === 'valid' ? 'Semua berlaku'
                                : 'Tanpa masa berlaku'}
                            </span>
                          </div>
                        )}
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

      {isModalOpen && (
        <ModalPortal zIndex={100}>
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Data Peralatan' : 'Tambah Data Peralatan'}</h2>
              <p className="text-sm text-slate-500 mt-1">Spesifikasi alat, dokumentasi foto, dan dokumen kelayakan.</p>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Alat <span className="text-rose-500">*</span></label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Contoh: Compressor" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Kategori <span className="text-rose-500">*</span></label>
                    <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} placeholder="Contoh: Alat Berat, Tools" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Merek / Brand</label>
                    <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass} placeholder="Contoh: Perkins" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Tipe / Seri</label>
                    <input type="text" value={form.type_serial} onChange={(e) => setForm({ ...form, type_serial: e.target.value })} className={inputClass} placeholder="Contoh: K-1320" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Dimensi</label>
                    <input type="text" value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })} className={inputClass} placeholder="Contoh: 1 x 0,5 x 0,5 m" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Kapasitas</label>
                    <input type="text" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={inputClass} placeholder="Contoh: 1 CFM" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jumlah</label>
                    <input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Satuan</label>
                    <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} placeholder="unit" />
                  </div>
                </div>

                <FileUploadField
                  label="Foto Peralatan"
                  value={form.photo_url}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                  accept="image/*"
                  hint="Foto kondisi alat, maksimal 5MB."
                />

                <AssetDocumentEditor
                  documents={form.documents}
                  onChange={(documents) => setForm({ ...form, documents })}
                  namePlaceholder="Contoh: Sertifikasi Kelayakan"
                  issuerPlaceholder="Contoh: Sucofindo"
                />
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
        </ModalPortal>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, Package, AlertTriangle } from 'lucide-react';
import { getMaterials, saveMaterial, deleteMaterial, MaterialItem } from './actions';
import type { AssetDocumentItem } from '@/lib/asset-document';
import { FileUploadField } from '@/components/vendor/file-upload-field';
import { AssetDocumentEditor } from '@/components/vendor/asset-document-editor';
import { EXPIRY_TONE, worstExpiry } from '@/lib/document-expiry';

const emptyForm = {
  id: undefined as string | undefined,
  name: '',
  brand: '',
  type_serial: '',
  dimension: '',
  quantity: 1,
  unit: 'unit',
  photo_url: null as string | null,
  documents: [] as AssetDocumentItem[],
};

const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm';

export default function MaterialMasterPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      setMaterials(await getMaterials());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMaterials(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return materials.filter(m =>
      !q || m.name.toLowerCase().includes(q) || (m.brand || '').toLowerCase().includes(q) || (m.type_serial || '').toLowerCase().includes(q),
    );
  }, [materials, query]);

  const expiredCount = useMemo(
    () => materials.filter(m => worstExpiry(m.documents.map(d => d.valid_to)) === 'expired').length,
    [materials],
  );

  const openAdd = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (m: MaterialItem) => {
    setForm({
      id: m.id,
      name: m.name,
      brand: m.brand || '',
      type_serial: m.type_serial || '',
      dimension: m.dimension || '',
      quantity: m.quantity ?? 1,
      unit: m.unit || 'unit',
      photo_url: m.photo_url,
      documents: m.documents.map(d => ({ ...d })),
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      alert('Nama material wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      await saveMaterial(form);
      setIsModalOpen(false);
      await fetchMaterials();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data material.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data material ini?')) return;
    try {
      await deleteMaterial(id);
      await fetchMaterials();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data material.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Data Material</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola master data material beserta dokumen keselamatannya (MSDS, dsb.) untuk ditarik ke JSA.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Material
        </button>
      </div>

      {expiredCount > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold text-rose-800">
            {expiredCount} material memiliki dokumen yang sudah kedaluwarsa. Perbarui sebelum digunakan di pekerjaan baru.
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
            placeholder="Cari nama, merek, atau tipe..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
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
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    {materials.length === 0 ? 'Belum ada data material. Tambahkan material pertama Anda.' : 'Tidak ada material yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filtered.map((mat) => {
                  const worst = worstExpiry(mat.documents.map(d => d.valid_to));
                  return (
                    <tr key={mat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">{mat.name}</div>
                        {mat.brand && <div className="text-xs text-slate-500">{mat.brand}</div>}
                        {mat.photo_url && (
                          <a href={mat.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline">
                            Lihat foto
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{mat.type_serial || '—'}</div>
                        <div className="text-xs text-slate-500">{mat.dimension || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700 tabular-nums">
                        {mat.quantity ?? 1} {mat.unit || 'unit'}
                      </td>
                      <td className="px-6 py-4">
                        {mat.documents.length === 0 ? (
                          <span className="text-xs text-slate-400">Belum ada</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-700">{mat.documents.length} dokumen</span>
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
                          <button onClick={() => openEdit(mat)} className="text-slate-400 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg" title="Edit Data">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(mat.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg" title="Hapus Data">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Data Material' : 'Tambah Data Material'}</h2>
              <p className="text-sm text-slate-500 mt-1">Spesifikasi material, dokumentasi foto, dan dokumen keselamatan.</p>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Material <span className="text-rose-500">*</span></label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Contoh: Cat" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Merek / Brand</label>
                    <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass} placeholder="Contoh: Jotun" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Tipe / Seri</label>
                    <input type="text" value={form.type_serial} onChange={(e) => setForm({ ...form, type_serial: e.target.value })} className={inputClass} placeholder="Contoh: RAL 1330" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Dimensi</label>
                    <input type="text" value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })} className={inputClass} placeholder="Contoh: 1 x 0,5 x 0,5 m" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jumlah</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Satuan</label>
                    <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} placeholder="Contoh: galon" />
                  </div>
                </div>

                <FileUploadField
                  label="Foto Material"
                  value={form.photo_url}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                  accept="image/*"
                  hint="Foto kemasan atau material, maksimal 5MB."
                />

                <AssetDocumentEditor
                  documents={form.documents}
                  onChange={(documents) => setForm({ ...form, documents })}
                  namePlaceholder="Contoh: MSDS"
                  issuerPlaceholder="Contoh: Manufacturer"
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
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, UploadCloud, FileText, Download, Trash2, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { getVendorDocuments, saveDocumentMetadata, deleteVendorDocument } from './actions';
import { uploadVendorDocument } from '@/utils/supabase/storage';

export default function DokumenK3Page() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [nama, setNama] = useState('');
  const [jenis, setJenis] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const data = await getVendorDocuments();
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!nama || !jenis || !file) {
      alert('Mohon lengkapi semua field dan pilih file PDF.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload to Supabase Storage
      const path = `vendor_${Date.now()}`;
      const fileUrl = await uploadVendorDocument(file, path);

      if (!fileUrl) {
        throw new Error('Gagal mengupload file ke storage.');
      }

      // 2. Save metadata to database
      await saveDocumentMetadata({
        nama,
        jenis,
        file_url: fileUrl,
      });

      // 3. Reset form and refresh list
      setNama('');
      setJenis('');
      setFile(null);
      setIsModalOpen(false);
      fetchDocuments();
    } catch (error: any) {
      alert(error.message || 'Terjadi kesalahan saat upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) {
      try {
        await deleteVendorDocument(id);
        fetchDocuments();
      } catch (error) {
        alert('Gagal menghapus dokumen.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dokumen K3</h1>
          <p className="text-sm text-slate-500 mt-1">
            Unggah dan kelola dokumen K3 perusahaan Anda sebagai persyaratan kelayakan vendor.
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <UploadCloud className="w-4 h-4" />
            Unggah Dokumen
          </button>
        </div>
      </div>

      {/* List / Table of Documents */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Dokumen</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis Dokumen</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Upload</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status Validasi</th>
                <th scope="col" className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat dokumen...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Belum ada dokumen yang diunggah.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-800">{doc.name}</div>
                          <div className="text-xs text-slate-500">{doc.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {doc.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(doc.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        doc.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                        doc.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {doc.status === 'Approved' ? <CheckCircle2 className="w-3 h-3" /> : 
                         doc.status === 'Rejected' ? <XCircle className="w-3 h-3" /> : 
                         <Clock className="w-3 h-3" />}
                        {doc.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg" title="Download/Lihat">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg" title="Hapus Dokumen">
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

      {/* Modal Upload Dokumen */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Unggah Dokumen K3</h2>
                <p className="text-sm text-slate-500 mt-1">Upload dokumen persyaratan K3 dalam format PDF.</p>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Nama Dokumen <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" 
                    placeholder="Contoh: Sertifikat SMK3 2024" 
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Jenis Dokumen <span className="text-rose-500">*</span></label>
                  <select 
                    value={jenis}
                    onChange={(e) => setJenis(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm"
                  >
                    <option value="">Pilih Jenis Dokumen</option>
                    <option value="Sertifikasi K3">Sertifikasi K3</option>
                    <option value="Dokumen Kebijakan">Dokumen Kebijakan</option>
                    <option value="Dokumen Organisasi">Struktur Organisasi P2K3</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                
                {/* File Upload Area */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">File Dokumen (PDF) <span className="text-rose-500">*</span></label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors relative">
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1 text-center">
                      <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                      <div className="flex text-sm text-slate-600 justify-center">
                        <span className="relative font-medium text-primary hover:text-primary/80">
                          {file ? file.name : "Pilih file PDF"}
                        </span>
                        {!file && <p className="pl-1">or drag and drop</p>}
                      </div>
                      <p className="text-xs text-slate-500">PDF up to 10MB</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button 
                onClick={() => setIsModalOpen(false)} 
                disabled={isUploading}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={handleUpload} 
                disabled={isUploading}
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm shadow-primary/30 flex items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                {isUploading ? 'Mengunggah...' : 'Upload Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

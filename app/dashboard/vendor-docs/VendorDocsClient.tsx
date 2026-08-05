'use client';

import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, CheckCircle2, XCircle, Clock, Loader2, Building2 } from 'lucide-react';
import { getAllVendorDocuments, updateDocumentStatus } from './actions';

export default function VendorDocsClient({ canApprove }: { canApprove: boolean }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const data = await getAllVendorDocuments();
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (confirm(`Apakah Anda yakin ingin mengubah status dokumen ini menjadi ${newStatus}?`)) {
      setIsUpdating(id);
      try {
        const result = await updateDocumentStatus(id, newStatus);
        if (result.error) {
          alert('Gagal mengubah status: ' + result.error);
        } else {
          fetchDocuments();
        }
      } catch (error: any) {
        alert('Gagal mengubah status dokumen: ' + error.message);
      } finally {
        setIsUpdating(null);
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Cari dokumen atau vendor..."
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 rounded-t-xl">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider rounded-tl-xl">Dokumen</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tgl Upload</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider rounded-tr-xl">Aksi</th>
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
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-800">{doc.name}</div>
                        <div className="text-xs text-slate-500">{doc.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">
                        {doc.vendor_profiles?.company_name || 'Vendor Tidak Ditemukan'}
                      </span>
                    </div>
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
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg" title="Unduh / Lihat Dokumen">
                        <Download className="w-4 h-4" />
                      </a>
                      
                      {canApprove && (!doc.status || doc.status === 'Pending') && (
                        <>
                          <button 
                            onClick={() => handleStatusChange(doc.id, 'Approved')}
                            disabled={isUpdating === doc.id}
                            className="text-emerald-600 hover:text-emerald-700 transition-colors p-2 hover:bg-emerald-50 rounded-lg disabled:opacity-50" 
                            title="Setujui Dokumen"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleStatusChange(doc.id, 'Rejected')}
                            disabled={isUpdating === doc.id}
                            className="text-rose-600 hover:text-rose-700 transition-colors p-2 hover:bg-rose-50 rounded-lg disabled:opacity-50" 
                            title="Tolak Dokumen"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

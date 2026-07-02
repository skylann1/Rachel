'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search, Plus, MapPin, Phone, Mail, Edit2, Trash2, CheckCircle2, AlertTriangle, FileText, Building2, X, Download, Eye, User } from 'lucide-react';
import EditVendorModal from './EditVendorModal';



export default function VendorPageClient({ initialVendors }: { initialVendors: any[] }) {
  const [selectedVendorForDocs, setSelectedVendorForDocs] = useState<any | null>(null);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Search and filter states (Client side filtering for simplicity or can be handled by server)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status CSMS');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredVendors = initialVendors.filter(vendor => {
    const matchSearch = vendor.company_name?.toLowerCase().includes(search.toLowerCase()) || 
                        vendor.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
    
    let matchStatus = true;
    if (statusFilter === 'Verified (Lulus)' && vendor.csms_status !== 'Verified') matchStatus = false;
    if (statusFilter === 'Pending Review' && vendor.csms_status !== 'Pending Review') matchStatus = false;
    if (statusFilter === 'Suspended' && vendor.csms_status !== 'Suspended') matchStatus = false;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Data Vendor</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola direktori mitra kerja, status verifikasi K3, dan detail kontak.</p>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama perusahaan atau PIC..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50"
          >
            <option>Semua Status CSMS</option>
            <option>Verified (Lulus)</option>
            <option>Pending Review</option>
            <option>Suspended</option>
          </select>
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <div key={vendor.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            {/* Card Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 line-clamp-1" title={vendor.company_name}>{vendor.company_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{vendor.id.split('-')[0]}...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Body - Details */}
            <div className="p-5 flex-1 space-y-4">
              {/* Contact Info */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><User className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700">PIC: {vendor.profiles?.full_name || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><Phone className="w-4 h-4" /></div>
                  {vendor.phone || 'N/A'}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><Mail className="w-4 h-4" /></div>
                  <span className="truncate" title={vendor.company_email || vendor.profiles?.email}>{vendor.company_email || vendor.profiles?.email || 'N/A'}</span>
                </div>
              </div>

              {/* Status and Metrics */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Status K3 / CSMS</span>
                  {vendor.csms_status === 'Verified' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lulus Verifikasi
                    </span>
                  )}
                  {(!vendor.csms_status || vendor.csms_status === 'Pending Review') && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Evaluasi Dokumen
                    </span>
                  )}
                  {vendor.csms_status === 'Suspended' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Suspended
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col items-end">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Proyek Aktif</span>
                   <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-0.5 rounded-full">{vendor.projects?.[0]?.count || 0}</span>
                </div>
              </div>
            </div>

            {/* Card Footer - Actions */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                  onClick={() => setSelectedVendorForDocs(vendor)}
                  className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
               >
                  <FileText className="w-3.5 h-3.5" /> Dokumen
               </button>
               <button 
                  onClick={() => setSelectedVendorForEdit(vendor)}
                  className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
               >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
               </button>
            </div>
          </div>
        ))}

        {filteredVendors.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Data Vendor Tidak Ditemukan</h3>
            <p className="text-slate-500 text-sm max-w-md text-center">
              Belum ada data vendor yang cocok dengan kriteria pencarian Anda. Pastikan akun vendor telah didaftarkan melalui menu Manajemen Akun.
            </p>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {mounted && selectedVendorForDocs && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedVendorForDocs(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Dokumen Sertifikasi K3</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedVendorForDocs.company_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedVendorForDocs(null)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-600 mb-6">Berikut adalah daftar dokumen pendukung CSMS yang telah diunggah oleh vendor ini. Silakan unduh atau pratinjau untuk proses evaluasi.</p>
              <div className="space-y-3">
                {selectedVendorForDocs.vendor_documents?.length > 0 ? (
                  selectedVendorForDocs.vendor_documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:text-primary transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            {doc.type} • {doc.size || 'Unknown Size'} • Diunggah {new Date(doc.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.file_url && (
                          <>
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Pratinjau">
                              <Eye className="w-4 h-4" />
                            </a>
                            <a href={doc.file_url} download className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Unduh">
                              <Download className="w-4 h-4" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-200">
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Belum ada dokumen</p>
                    <p className="text-xs text-slate-500 mt-1">Vendor belum mengunggah dokumen sertifikasi apa pun.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedVendorForDocs(null)} className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Action Modals */}
      <EditVendorModal isOpen={!!selectedVendorForEdit} onClose={() => setSelectedVendorForEdit(null)} vendor={selectedVendorForEdit} />

    </div>
  );
}

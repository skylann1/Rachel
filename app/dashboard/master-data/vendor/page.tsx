"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search, Plus, MapPin, Phone, Mail, Edit2, Trash2, CheckCircle2, AlertTriangle, FileText, Building2, X, Download, Eye } from 'lucide-react';

const mockVendors = [
  { id: 'VND-001', name: 'PT. Konstruksi Sejahtera', pic: 'Budi Santoso', phone: '0812-3456-7890', email: 'contact@konstruksi-sejahtera.com', status: 'Verified', projects: 3 },
  { id: 'VND-002', name: 'CV. Teknik Mesin Nusantara', pic: 'Andi Wijaya', phone: '0813-4567-8901', email: 'info@tmn-engineering.com', status: 'Pending Review', projects: 1 },
  { id: 'VND-003', name: 'PT. Solusi Elektrik', pic: 'Siti Aminah', phone: '0811-5678-9012', email: 'admin@solusi-elektrik.co.id', status: 'Verified', projects: 5 },
  { id: 'VND-004', name: 'PT. Bangun Graha', pic: 'Reza Rahardian', phone: '0815-6789-0123', email: 'hello@bangungraha.com', status: 'Suspended', projects: 0 },
  { id: 'VND-005', name: 'CV. Karya Abadi', pic: 'Dewi Lestari', phone: '0819-7890-1234', email: 'support@karyaabadi.net', status: 'Verified', projects: 2 },
];

const mockDocuments = [
  { id: 1, name: 'Profil_Perusahaan_2026.pdf', type: 'PDF', size: '2.4 MB', date: '10 Jun 2026' },
  { id: 2, name: 'Sertifikat_ISO_45001.pdf', type: 'PDF', size: '1.1 MB', date: '12 Jun 2026' },
  { id: 3, name: 'Laporan_Kinerja_K3_2025.pdf', type: 'PDF', size: '5.6 MB', date: '15 Jun 2026' },
  { id: 4, name: 'Struktur_Organisasi_HSE.png', type: 'Image', size: '800 KB', date: '20 Jun 2026' },
];

export default function VendorManagementPage() {
  const [selectedVendorForDocs, setSelectedVendorForDocs] = useState<typeof mockVendors[0] | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Data Vendor</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola direktori mitra kerja, status verifikasi K3, dan detail kontak.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30">
          <Plus className="w-4 h-4" />
          Registrasi Vendor
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama perusahaan atau PIC..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50">
            <option>Semua Status CSMS</option>
            <option>Verified (Lulus)</option>
            <option>Pending Review</option>
            <option>Suspended</option>
          </select>
        </div>
      </div>

      {/* Data Grid / Cards (Alternative to Table for a more modern feel) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockVendors.map((vendor) => (
          <div key={vendor.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            {/* Card Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 line-clamp-1" title={vendor.name}>{vendor.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{vendor.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Body - Details */}
            <div className="p-5 flex-1 space-y-4">
              {/* Contact Info */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><FileText className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700">PIC: {vendor.pic}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><Phone className="w-4 h-4" /></div>
                  {vendor.phone}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-6 flex justify-center text-slate-400"><Mail className="w-4 h-4" /></div>
                  <span className="truncate" title={vendor.email}>{vendor.email}</span>
                </div>
              </div>

              {/* Status and Metrics */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Status K3 / CSMS</span>
                  {vendor.status === 'Verified' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lulus Verifikasi
                    </span>
                  )}
                  {vendor.status === 'Pending Review' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Evaluasi Dokumen
                    </span>
                  )}
                  {vendor.status === 'Suspended' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Suspended
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col items-end">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Proyek Aktif</span>
                   <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-0.5 rounded-full">{vendor.projects}</span>
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
               <Link href={`/dashboard/master-data/vendor/${vendor.id}`} className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
               </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Document Preview Modal */}
      {mounted && selectedVendorForDocs && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedVendorForDocs(null)}
          ></div>

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Dokumen Sertifikasi K3</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedVendorForDocs.name} ({selectedVendorForDocs.id})</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVendorForDocs(null)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-600 mb-6">Berikut adalah daftar dokumen pendukung CSMS yang telah diunggah oleh vendor ini. Silakan unduh atau pratinjau untuk proses evaluasi.</p>
              
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:text-primary transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {doc.type} • {doc.size} • Diunggah {doc.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Pratinjau">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Unduh">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedVendorForDocs(null)}
                className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

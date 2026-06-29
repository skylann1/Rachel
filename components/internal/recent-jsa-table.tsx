import React from 'react';
import { FileText, MoreHorizontal, CheckCircle2, Clock, XCircle } from 'lucide-react';

const mockJsaData = [
  {
    id: 'JSA-2026-001',
    vendorName: 'PT. Konstruksi Sejahtera',
    projectName: 'Penggalian Pipa Gas Area A',
    dateSubmitted: '2026-06-25',
    status: 'Menunggu Review',
  },
  {
    id: 'JSA-2026-002',
    vendorName: 'CV. Teknik Mesin Nusantara',
    projectName: 'Maintenance Kompresor Stasiun B',
    dateSubmitted: '2026-06-24',
    status: 'Menunggu Validasi',
  },
  {
    id: 'JSA-2026-003',
    vendorName: 'PT. Solusi Elektrik',
    projectName: 'Instalasi Panel Listrik Baru',
    dateSubmitted: '2026-06-23',
    status: 'Disetujui',
  },
  {
    id: 'JSA-2026-004',
    vendorName: 'PT. Bangun Graha',
    projectName: 'Pengecatan Fasilitas Pipa',
    dateSubmitted: '2026-06-22',
    status: 'Ditolak',
  },
  {
    id: 'JSA-2026-005',
    vendorName: 'CV. Karya Abadi',
    projectName: 'Inspeksi Rutin Jalur Distribusi',
    dateSubmitted: '2026-06-20',
    status: 'Disetujui',
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Menunggu Review':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
          <Clock className="w-3 h-3" />
          Menunggu Review HSE
        </span>
      );
    case 'Menunggu Validasi':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
          <Clock className="w-3 h-3" />
          Menunggu Validasi PM
        </span>
      );
    case 'Disetujui':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Disetujui
        </span>
      );
    case 'Ditolak':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
          <XCircle className="w-3 h-3" />
          Ditolak
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {status}
        </span>
      );
  }
};

export function RecentJsaTable() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">Pengajuan JSA Terbaru</h3>
        <button className="text-sm font-medium text-primary hover:text-primary/80">Lihat Semua</button>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">ID JSA</th>
                <th className="px-6 py-4">Nama Vendor</th>
                <th className="px-6 py-4">Proyek / Pekerjaan</th>
                <th className="px-6 py-4">Tanggal Pengajuan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mockJsaData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {item.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-primary">{item.vendorName}</td>
                  <td className="px-6 py-4 text-slate-600">{item.projectName}</td>
                  <td className="px-6 py-4 text-slate-500">{item.dateSubmitted}</td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

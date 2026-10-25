import React from 'react';

/**
 * Primitif tabel daftar yang dipakai bersama halaman-halaman list (Proyek, Arsip,
 * Inspeksi, dst.) supaya tampilannya konsisten: kartu putih, header abu-abu,
 * baris bergaris tipis, bisa digeser ke samping di layar sempit.
 */
export function DataTable({ children, minWidth = 900 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>{children}</table>
      </div>
    </div>
  );
}

export function DataHead({ columns }: { columns: { label: string; className?: string }[] }) {
  return (
    <thead>
      <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {columns.map((c) => (
          <th key={c.label} className={`px-4 py-3 whitespace-nowrap ${c.className ?? ''}`}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}

export const ROW_CLS = 'hover:bg-slate-50/70 transition-colors align-top';
export const CELL_CLS = 'px-4 py-3.5';

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-slate-400">{children}</td>
    </tr>
  );
}

/** Tombol aksi kecil seragam untuk kolom "Aksi". */
export const ACTION_LINK_CLS =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border whitespace-nowrap transition-colors';

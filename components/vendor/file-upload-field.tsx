'use client';

import React, { useRef, useState } from 'react';
import { Upload, Loader2, FileCheck2, X } from 'lucide-react';
import { uploadVendorDocument } from '@/utils/supabase/storage';

/**
 * Satu kolom unggah berkas untuk master data (KTP/ID card, foto alat, bukti
 * kompetensi, sertifikat). Berkas diunggah begitu dipilih lalu komponen
 * mengembalikan URL publiknya, sehingga form induk cukup menyimpan URL — bukan
 * objek File — dan bisa dikirim apa adanya ke server action.
 */
export function FileUploadField({
  label,
  value,
  onChange,
  accept = 'image/*,.pdf',
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  hint?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran berkas melebihi 5MB.');
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const url = await uploadVendorDocument(file, 'master-data');
      if (!url) {
        setError('Gagal mengunggah berkas. Coba lagi.');
        return;
      }
      onChange(url);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 block mb-2">{label}</label>

      {value ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
          <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-800 hover:underline truncate flex-1"
          >
            Lihat berkas terunggah
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-emerald-700 hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0"
            title="Hapus berkas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition-all disabled:opacity-60"
        >
          {isUploading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...</>
            : <><Upload className="w-4 h-4" /> Pilih berkas</>}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error
        ? <p className="text-xs text-rose-600 font-medium mt-1.5">{error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

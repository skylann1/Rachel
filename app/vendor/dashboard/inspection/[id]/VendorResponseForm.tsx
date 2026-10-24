'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, Loader2, UploadCloud } from 'lucide-react';
import { submitVendorResponse } from '../actions';
import { uploadImage } from '@/utils/supabase/storage';

export default function VendorResponseForm({ inspectionId, status }: { inspectionId: string; status: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'In Progress') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3 text-amber-700 text-sm font-bold">
        <Clock className="w-5 h-5 shrink-0" /> Bukti perbaikan terkirim — menunggu validasi HSE.
      </div>
    );
  }
  if (status === 'Closed') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-emerald-700 text-sm font-bold">
        <CheckCircle className="w-5 h-5 shrink-0" /> Temuan ini sudah ditutup.
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) { setError('Unggah foto bukti perbaikan.'); return; }
    setBusy(true);
    const formData = new FormData(e.currentTarget);
    try {
      const url = await uploadImage(file, 'inspections-evidence');
      if (!url) throw new Error('Foto gagal diunggah. Coba lagi.');
      formData.append('vendor_evidence_url', url);
      await submitVendorResponse(inspectionId, formData);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim tindak lanjut.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-white border-2 border-rose-200 rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-bold text-rose-700 uppercase tracking-wider">Tindak Lanjut Temuan</h2>
      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1.5">Foto Bukti Perbaikan <span className="text-rose-500">*</span></label>
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div onClick={() => fileRef.current?.click()} className="w-full h-36 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 cursor-pointer overflow-hidden">
          {file ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <>
              <UploadCloud className="w-6 h-6 mb-1" />
              <span className="text-xs font-bold">Pilih foto kondisi yang sudah aman</span>
            </>
          )}
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1.5">Tindakan Perbaikan yang Dilakukan <span className="text-rose-500">*</span></label>
        <textarea name="vendor_response" required rows={4} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none text-sm resize-none" placeholder="Jelaskan apa yang sudah diperbaiki di lapangan..." />
      </div>
      {error && <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>}
      <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {busy ? 'Mengirim...' : 'Kirim Bukti Perbaikan'}
      </button>
    </form>
  );
}

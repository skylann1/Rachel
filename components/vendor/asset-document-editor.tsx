'use client';

import React from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { FileUploadField } from './file-upload-field';
import { getExpiry, expiryLabel, EXPIRY_TONE } from '@/lib/document-expiry';
import type { AssetDocumentItem } from '@/lib/asset-document';

const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm';

/**
 * Daftar dokumen pendukung yang bisa ditambah/dihapus — dipakai bersama oleh
 * master data Peralatan dan Material karena bentuk datanya identik
 * (nama dokumen, lembaga penerbit, masa berlaku, berkas bukti).
 */
export function AssetDocumentEditor({
  documents,
  onChange,
  namePlaceholder,
  issuerPlaceholder,
}: {
  documents: AssetDocumentItem[];
  onChange: (next: AssetDocumentItem[]) => void;
  namePlaceholder: string;
  issuerPlaceholder: string;
}) {
  const update = (index: number, patch: Partial<AssetDocumentItem>) => {
    onChange(documents.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const add = () => {
    onChange([...documents, { doc_name: '', issuer: null, valid_to: null, document_url: null }]);
  };

  const remove = (index: number) => {
    onChange(documents.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <FileText className="w-4 h-4 text-primary" />
          Dokumen Pendukung
        </span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Dokumen
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-slate-400">Belum ada dokumen pendukung.</p>
      ) : (
        <div className="space-y-3">
          {documents.map((d, i) => {
            const info = getExpiry(d.valid_to);
            return (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={d.doc_name}
                    onChange={(e) => update(i, { doc_name: e.target.value })}
                    className={inputClass}
                    placeholder={namePlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title="Hapus dokumen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Lembaga penerbit</label>
                    <input
                      type="text"
                      value={d.issuer || ''}
                      onChange={(e) => update(i, { issuer: e.target.value || null })}
                      className={inputClass}
                      placeholder={issuerPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Berlaku sampai</label>
                    <input
                      type="date"
                      value={d.valid_to || ''}
                      onChange={(e) => update(i, { valid_to: e.target.value || null })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {d.valid_to && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${EXPIRY_TONE[info.status]}`}>
                    {expiryLabel(info)}
                  </span>
                )}

                <FileUploadField
                  label="Bukti dokumen"
                  value={d.document_url}
                  onChange={(url) => update(i, { document_url: url })}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

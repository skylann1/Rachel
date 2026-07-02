'use client';

import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Shield } from 'lucide-react';
import { addRole } from './actions';

export default function AddRoleModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void, onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await addRole(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setLoading(false);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose(); // Fallback
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm whitespace-normal">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">Tambah Role Baru</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors p-1 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <form id="add-role-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Role <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="name" 
                required 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                placeholder="Contoh: Sub Kontraktor"
              />
              <p className="text-[11px] text-slate-500 mt-1">*Nama akan otomatis diformat huruf kecil (misal: sub_kontraktor).</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipe Role <span className="text-rose-500">*</span></label>
              <select 
                name="type" 
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm bg-white"
              >
                <option value="internal">Internal (PGN)</option>
                <option value="external">External (Vendor)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi Role</label>
              <textarea 
                name="description" 
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm resize-none"
                placeholder="Jelaskan kegunaan role ini..."
              ></textarea>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button 
            form="add-role-form"
            type="submit" 
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-xl transition-all shadow-sm shadow-primary/30 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

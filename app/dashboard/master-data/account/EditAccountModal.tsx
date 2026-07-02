'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { updateAccount } from './actions';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
  roles: any[];
}

export default function EditAccountModal({ isOpen, onClose, account, roles }: EditAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState(account.type);
  const [role, setRole] = useState(account.role);

  useEffect(() => {
    if (isOpen) {
      setType(account.type);
      setRole(account.role);
      setError('');
    }
  }, [isOpen, account]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await updateAccount(account.id, formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm whitespace-normal text-left">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Edit Akun Pengguna</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
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

          <form id="edit-account-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email (Tidak bisa diubah)</label>
              <input 
                type="email" 
                value={account.email} 
                disabled
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap</label>
              <input 
                type="text" 
                name="fullName" 
                defaultValue={account.name}
                required 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tipe Akun</label>
                <select 
                  name="type" 
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setType(newType);
                    const newRoles = roles.filter(r => r.type === newType);
                    if (!newRoles.find(r => r.name === role)) {
                       setRole(newRoles.length > 0 ? newRoles[0].name : '');
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm bg-white"
                >
                  <option value="external">External (Vendor)</option>
                  <option value="internal">Internal (PGN)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                <select 
                  name="role" 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm bg-white capitalize"
                >
                  {roles
                    .filter(r => r.type === type)
                    .map(r => (
                    <option key={r.name} value={r.name}>
                      {r.name} {r.is_system ? '(System)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {type === 'internal' ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor Induk Pegawai (NIP)</label>
                <input 
                  type="text" 
                  name="nip" 
                  defaultValue={account.nip || ''}
                  required 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                  placeholder="Masukkan NIP"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Perusahaan (Vendor)</label>
                <input 
                  type="text" 
                  name="companyName" 
                  defaultValue={account.companyName || ''}
                  required 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                  placeholder="Contoh: PT Bangun Persada"
                />
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
          >
            Batal
          </button>
          <button 
            type="submit"
            form="edit-account-form"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-sm shadow-primary/30 transition-all flex items-center justify-center min-w-[150px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Perubahan'}
          </button>
        </div>

      </div>
    </div>
  );
}

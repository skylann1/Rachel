"use client";

import { useState } from 'react';
import { Lock, Eye, EyeOff, Save, Loader2, KeyRound } from 'lucide-react';
import { changePassword } from '@/app/actions/profile';

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 focus:border-primary focus:ring-4 focus:ring-blue-50 rounded-xl pl-10 pr-10 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/** Self-service password change, shared by both the internal and vendor profile pages. */
export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Semua kolom wajib diisi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    const { error } = await changePassword({ currentPassword, newPassword });
    setIsLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-800">Ubah Kata Sandi</h3>
      </div>
      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl px-4 py-3">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl px-4 py-3">
            Kata sandi berhasil diubah.
          </div>
        )}

        <PasswordField label="Kata Sandi Saat Ini" value={currentPassword} onChange={setCurrentPassword} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PasswordField label="Kata Sandi Baru" value={newPassword} onChange={setNewPassword} />
          <PasswordField label="Konfirmasi Kata Sandi Baru" value={confirmPassword} onChange={setConfirmPassword} />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Simpan Kata Sandi
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Edit2, ShieldOff, Shield, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import EditAccountModal from './EditAccountModal';
import { suspendAccount, deleteAccount } from './actions';

interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
  type: string;
  companyName: string | null;
  nip: string | null;
  status: string;
}

export default function AccountActions({ account, roles }: { account: Account, roles: any[] }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmSuspendOpen, setIsConfirmSuspendOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const isSuspended = account.status === 'Inactive';

  async function handleSuspend() {
    setLoading(true);
    await suspendAccount(account.id, !isSuspended);
    setLoading(false);
    setIsConfirmSuspendOpen(false);
  }

  async function handleDelete() {
    setLoading(true);
    await deleteAccount(account.id);
    setLoading(false);
    setIsConfirmDeleteOpen(false);
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="text-slate-400 hover:text-primary transition-colors p-1" 
          title="Edit Akun"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        
        <button 
          onClick={() => setIsConfirmSuspendOpen(true)}
          className={`transition-colors p-1 ${isSuspended ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-rose-500'}`}
          title={isSuspended ? "Aktifkan Akun" : "Nonaktifkan Akun"}
        >
          {isSuspended ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
        </button>
        
        <button 
          onClick={() => setIsConfirmDeleteOpen(true)}
          className="text-slate-400 hover:text-rose-600 transition-colors p-1" 
          title="Hapus Akun"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <EditAccountModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        account={account} 
        roles={roles}
      />

      {/* Suspend Confirmation Modal */}
      {isConfirmSuspendOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm whitespace-normal text-left">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isSuspended ? 'bg-amber-100' : 'bg-rose-100'}`}>
              {isSuspended ? <Shield className="w-6 h-6 text-amber-600" /> : <ShieldOff className="w-6 h-6 text-rose-600" />}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {isSuspended ? 'Aktifkan Akun?' : 'Nonaktifkan Akun?'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {isSuspended 
                ? `Pengguna ${account.name} akan dapat mengakses sistem kembali.`
                : `Pengguna ${account.name} tidak akan bisa login ke dalam sistem sebelum diaktifkan kembali.`}
            </p>
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setIsConfirmSuspendOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleSuspend}
                disabled={loading}
                className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center ${isSuspended ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm whitespace-normal text-left">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Permanen?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Tindakan ini akan menghapus <strong>{account.name}</strong> beserta seluruh profil terkait secara permanen. Data yang telah dihapus tidak dapat dikembalikan.
            </p>
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setIsConfirmDeleteOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

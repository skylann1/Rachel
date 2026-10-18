'use client';

import { ModalPortal } from '@/components/ui/modal-portal';
import { useEffect, useState } from 'react';
import { X, Loader2, Plus, Search } from 'lucide-react';
import AccountActions from '@/app/dashboard/master-data/account/AccountActions';
import AddAccountModal from '@/app/dashboard/master-data/account/AddAccountModal';
import { getVendorStaff } from './actions';

interface StaffAccount {
  id: string; name: string; email: string; role: string; type: string;
  companyName: string | null; nip: string | null; jabatan: string | null; status: string;
}

export default function VendorStaffModal({
  isOpen, onClose, vendor, canManageAccounts, vendorRoles,
}: {
  isOpen: boolean;
  onClose: () => void;
  vendor: { id: string; company_name: string } | null;
  canManageAccounts: boolean;
  vendorRoles: any[];
}) {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const load = async () => {
    if (!vendor) return;
    setLoading(true);
    const result = await getVendorStaff(vendor.id);
    setStaff(result.staff as StaffAccount[]);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && vendor) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vendor?.id]);

  if (!isOpen || !vendor) return null;

  return (
    <ModalPortal zIndex={100}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Staff Perusahaan</h2>
            <p className="text-xs text-slate-500 mt-0.5">{vendor.company_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {canManageAccounts && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 px-3 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Staff
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
          ) : staff.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Search className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Belum ada staff</p>
              <p className="text-xs text-slate-500 mt-1">Perusahaan ini belum punya akun staff.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map(account => (
                <div key={account.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {account.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{account.name}</p>
                      <p className="text-xs text-slate-500 truncate">{account.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {account.role}
                      </span>
                      <p className={`text-[10px] font-bold mt-1 ${account.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {account.status === 'Active' ? 'Aktif' : 'Nonaktif'}
                      </p>
                    </div>
                    {canManageAccounts && (
                      <AccountActions account={account} roles={vendorRoles} lockedType="vendor" onChanged={load} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddAccountModal
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); load(); }}
        roles={vendorRoles}
        vendorOrgId={vendor.id}
      />
    </ModalPortal>
  );
}

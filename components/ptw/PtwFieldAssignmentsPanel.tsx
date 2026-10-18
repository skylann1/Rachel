'use client';

import { useMemo, useState } from 'react';
import { UserPlus, Users, UserCheck, ShieldCheck, Loader2, Search } from 'lucide-react';
import type { FieldPeran } from '@/lib/ptw-field';
import { FIELD_PERAN_LABEL } from '@/lib/ptw-field';

interface ProfileLite {
  id?: string;
  full_name?: string | null;
  email?: string | null;
}

export interface PtwLite {
  id: string;
  ptw_type?: string | null;
  ptw_number?: string | null;
  status?: string | null;
}

interface Props {
  /** Daftar PTW proyek (id + nomor/tipe cukup buat judul kartu). */
  ptws: PtwLite[];
  /** Baris mentah ptw_field_assignments (semua riwayat; hanya baris aktif yang ditampilkan). */
  assignments: any[];
  /** Lookup nama dari server (profileById dari page.tsx). */
  profileById?: Record<string, ProfileLite>;
  /** Kandidat yang bisa ditugaskan (bila kosong, fallback ke profileById). */
  candidates?: ProfileLite[];
  /** Permission user saat ini: 'pemegang' boleh ditugaskan/ganti bila true, dsb. */
  canAssign?: Partial<Record<FieldPeran, boolean>>;
  /** Dipanggil saat user memilih kandidat. Return false/null untuk batal. */
  onAssign?: (params: { ptwId: string; peran: FieldPeran; userId: string; alasan?: string }) => Promise<boolean | void>;
}

export default function PtwFieldAssignmentsPanel({
  ptws,
  assignments,
  profileById = {},
  candidates,
  canAssign = {},
  onAssign,
}: Props) {
  const [modal, setModal] = useState<{ ptwId: string; peran: FieldPeran } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [alasan, setAlasan] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeOf = (ptwId: string, peran: FieldPeran) =>
    assignments.find(
      (a: any) => a.ptw_id === ptwId && a.peran === peran && (a.aktif_sampai === null || a.aktif_sampai === undefined)
    );

  const nameOf = (userId?: string | null) => {
    if (!userId) return '-';
    return profileById[userId]?.full_name || profileById[userId]?.email || '-';
  };

  const candidateList = useMemo(() => {
    const base = candidates && candidates.length > 0 ? candidates : Object.values(profileById);
    const map = new Map<string, ProfileLite>();
    for (const p of base) if (p?.id) map.set(p.id, p);
    const q = searchTerm.trim().toLowerCase();
    return Array.from(map.values())
      .filter((p) =>
        !q ||
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [candidates, profileById, searchTerm]);

  const handleAssign = async () => {
    if (!modal || !selectedUserId || !onAssign) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onAssign({
        ptwId: modal.ptwId,
        peran: modal.peran,
        userId: selectedUserId,
        alasan: alasan.trim() || undefined,
      });
      if (ok === false) return; // caller tahan modal & sudah menampilkan error
      setModal(null);
      setSelectedUserId('');
      setAlasan('');
    } catch (e: any) {
      setError(e?.message || 'Gagal menugaskan peran lapangan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (ptws.length === 0) return null;

  return (
    <div className="space-y-4">
      {ptws.map((ptw) => {
        const holder = activeOf(ptw.id, 'pemegang');
        const pengawas = activeOf(ptw.id, 'pengawas');
        return (
          <div key={ptw.id} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-slate-800">{ptw.ptw_type || 'PTW'}</h3>
                <p className="text-sm text-slate-500">{ptw.ptw_number || 'Belum bernomor'}</p>
              </div>
              {ptw.status && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {ptw.status}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-slate-800">{FIELD_PERAN_LABEL.pemegang}</span>
                  </div>
                  {canAssign.pemegang && (
                    <button
                      onClick={() => { setModal({ ptwId: ptw.id, peran: 'pemegang' }); setSelectedUserId(''); setAlasan(''); setError(null); }}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1 font-medium"
                    >
                      <UserPlus className="w-3 h-3" />
                      {holder ? 'Ganti' : 'Tugaskan'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium">{nameOf(holder?.user_id)}</p>
                {holder?.aktif_dari ? (
                  <p className="text-xs text-slate-400 mt-1">
                    Sejak {new Date(holder.aktif_dari).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 italic">Belum ditugaskan</p>
                )}
              </div>

              <div className="p-4 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">{FIELD_PERAN_LABEL.pengawas}</span>
                  </div>
                  {canAssign.pengawas && (
                    <button
                      onClick={() => { setModal({ ptwId: ptw.id, peran: 'pengawas' }); setSelectedUserId(''); setAlasan(''); setError(null); }}
                      className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 font-medium"
                    >
                      <UserPlus className="w-3 h-3" />
                      {pengawas ? 'Ganti' : 'Tugaskan'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium">{nameOf(pengawas?.user_id)}</p>
                {pengawas?.aktif_dari ? (
                  <p className="text-xs text-slate-400 mt-1">
                    Sejak {new Date(pengawas.aktif_dari).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 italic">Belum ditugaskan</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">
                {modal.peran === 'pemegang' ? 'Tugaskan Pemegang PTW' : 'Tugaskan Pengawas PTW'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Penjabat lama akan ditutup otomatis (riwayat tetap tersimpan).
              </p>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">{error}</div>}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="border border-slate-200 rounded-lg divide-y max-h-64 overflow-y-auto">
                {candidateList.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 text-center">Tidak ada kandidat ditemukan.</div>
                ) : (
                  candidateList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedUserId(p.id || '')}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                        selectedUserId === p.id ? 'bg-primary/10 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{p.full_name || p.email || p.id}</span>
                      {selectedUserId === p.id && <UserCheck className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))
                )}
              </div>
              <textarea
                placeholder="Alasan penugasan (opsional)"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                onClick={handleAssign}
                className="px-3 py-2 text-sm rounded-lg bg-primary text-white hover:opacity-90 flex items-center gap-2"
                disabled={submitting || !selectedUserId}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                {submitting ? 'Menyimpan...' : 'Simpan Penugasan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

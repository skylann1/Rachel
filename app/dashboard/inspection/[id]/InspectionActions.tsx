'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, UserPlus, Loader2 } from 'lucide-react';
import { delegateInspection, closeInspectionDirectly, validateInspection, getVendorsAndProjects } from '../actions';

const field = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none text-sm';

export default function InspectionActions({ inspectionId, status, hasVendor, assigneeName }: { inspectionId: string; status: string; hasVendor: boolean; assigneeName: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'Open') getVendorsAndProjects().then((vp) => setUsers(vp.internalUsers));
  }, [status]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'Closed') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-emerald-700 text-sm font-bold">
        <CheckCircle className="w-5 h-5" /> Temuan ini sudah ditutup.
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tindakan</h2>
      <p className="text-xs text-slate-500">Penanggung jawab saat ini: <span className="font-bold text-slate-700">{assigneeName ?? 'Belum di-assign'}</span></p>

      {status === 'Open' && hasVendor && (
        <div className="space-y-2">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
            <option value="">Pilih petugas internal</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.profiles.full_name}</option>)}
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} placeholder="Catatan disposisi (opsional)" />
          <button disabled={busy || !assignee} onClick={() => run(() => delegateInspection(inspectionId, assignee, notes))} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 rounded-xl">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Disposisi Tugas
          </button>
          <p className="text-[11px] text-slate-400">Menunggu vendor mengirim bukti perbaikan.</p>
        </div>
      )}

      {status === 'Open' && !hasVendor && (
        <div className="space-y-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} placeholder="Catatan penutupan (opsional)" />
          <button disabled={busy} onClick={() => run(() => closeInspectionDirectly(inspectionId, notes))} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Tutup Langsung
          </button>
        </div>
      )}

      {status === 'In Progress' && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-medium">Vendor sudah mengirim bukti perbaikan — periksa lalu validasi.</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} placeholder="Catatan validasi (opsional)" />
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => run(() => validateInspection(inspectionId, false, notes))} className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 rounded-xl">
              <XCircle className="w-4 h-4" /> Tolak
            </button>
            <button disabled={busy} onClick={() => run(() => validateInspection(inspectionId, true, notes))} className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl">
              <CheckCircle className="w-4 h-4" /> Setujui & Tutup
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>}
    </section>
  );
}

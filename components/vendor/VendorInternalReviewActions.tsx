'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ShieldQuestion } from 'lucide-react';
import { getMyVendorReviewAssignment, approveVendorInternalReview, rejectVendorInternalReview, type VendorReviewDocType } from '@/app/vendor/dashboard/approval/actions';

export function VendorInternalReviewActions({ projectId, docType, docId }: {
  projectId: string;
  docType: VendorReviewDocType;
  docId: string | null;
}) {
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!docId) { setLoading(false); return; }
      const assignment = await getMyVendorReviewAssignment(projectId, docType);
      if (!cancelled) {
        setAssignmentId(assignment?.id ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, docType, docId]);

  async function handleApprove() {
    if (!docId) return;
    setBusy(true);
    setError(null);
    try {
      await approveVendorInternalReview(docType, docId);
      setDone('approved');
    } catch (err: any) {
      setError(err.message || 'Gagal menyetujui dokumen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!docId || !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await rejectVendorInternalReview(docType, docId, note.trim());
      setDone('rejected');
    } catch (err: any) {
      setError(err.message || 'Gagal menolak dokumen.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !docId || (!assignmentId && !done)) return null;

  if (done === 'approved') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-emerald-700">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">Anda telah menyetujui dokumen ini di tahap Review Internal Vendor.</p>
      </div>
    );
  }
  if (done === 'rejected') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center gap-3 text-rose-700">
        <XCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">Dokumen ditolak dan dikembalikan ke Draft untuk direvisi.</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Menunggu Review Internal Anda</p>
          <p className="text-xs text-amber-700 mt-1">Anda ditugaskan sebagai reviewer internal vendor untuk dokumen ini sebelum diajukan ke PGSOL/PGN.</p>
        </div>
      </div>

      {error && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}

      {!showRejectForm ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Setujui
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-rose-600 border border-rose-200 text-sm font-bold rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Tolak
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan revisi untuk vendor..."
            rows={3}
            className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-300"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={busy || !note.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Kirim Penolakan
            </button>
            <button
              type="button"
              onClick={() => { setShowRejectForm(false); setNote(''); }}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

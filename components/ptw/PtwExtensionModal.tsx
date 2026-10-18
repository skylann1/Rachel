'use client';

import { useState } from 'react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { X, Loader2, AlertCircle, CalendarClock } from 'lucide-react';
import { PTW_MAX_VALID_DAYS } from '@/lib/ptw-types';
import { requestPtwExtension } from '@/app/dashboard/projects/[id]/completion-actions';

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PtwExtensionModal({
  ptwId, ptwTitle, validFrom, validTo, onClose,
}: {
  ptwId: string;
  ptwTitle: string;
  validFrom: string;
  validTo: string;
  onClose: () => void;
}) {
  const minDate = addDays(validTo, 1);
  const maxDate = addDays(validFrom, PTW_MAX_VALID_DAYS - 1);
  const noRoom = minDate > maxDate;

  const [newValidTo, setNewValidTo] = useState(minDate <= maxDate ? minDate : '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = !noRoom && !!newValidTo && newValidTo >= minDate && newValidTo <= maxDate && reason.trim().length > 0 && !loading;

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const res = await requestPtwExtension({ ptwId, newValidTo, reason });
    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <ModalPortal zIndex={100}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Perpanjangan PTW</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ptwTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 space-y-1">
            <p><strong>Berlaku saat ini:</strong> {formatDate(validFrom)} s/d {formatDate(validTo)}</p>
            <p className="text-xs text-slate-500">Masa berlaku PTW maksimal {PTW_MAX_VALID_DAYS} hari sejak tanggal mulai (paling lambat {formatDate(maxDate)}).</p>
          </div>

          {noRoom && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">PTW ini sudah mencapai batas {PTW_MAX_VALID_DAYS} hari dan tidak bisa diperpanjang lagi.</p>
            </div>
          )}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {!noRoom && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Berlaku sampai (baru)</label>
                <input
                  type="date"
                  value={newValidTo}
                  min={minDate}
                  max={maxDate}
                  onChange={e => setNewValidTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Alasan perpanjangan <span className="text-rose-500">*</span></label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Mengapa pekerjaan belum selesai dan butuh tambahan waktu?"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">
            Batal
          </button>
          {!noRoom && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              Ajukan Perpanjangan
            </button>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

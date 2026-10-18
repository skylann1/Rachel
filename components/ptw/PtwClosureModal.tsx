'use client';

import { useState } from 'react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PTW_CLOSURE_CHECKLIST } from '@/lib/ptw-status';
import { requestPtwClosure } from '@/app/dashboard/projects/[id]/completion-actions';

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function PtwClosureModal({
  ptwId, ptwTitle, openCheckinCount, onClose,
}: {
  ptwId: string;
  ptwTitle: string;
  /** Jumlah pekerja yang masih check-in pada PTW ini — penutupan diblokir selama > 0. */
  openCheckinCount: number;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [finishedAt, setFinishedAt] = useState(nowLocalInput);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allChecked = PTW_CLOSURE_CHECKLIST.every(item => checked[item.key]);
  const blocked = openCheckinCount > 0;
  const canSubmit = allChecked && !blocked && note.trim().length > 0 && !!finishedAt && !loading;

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const res = await requestPtwClosure({ ptwId, checklist: checked, note, finishedAt });
    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <ModalPortal zIndex={100}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Penutupan PTW</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ptwTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {blocked && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Masih ada <strong>{openCheckinCount} pekerja</strong> yang belum check-out. Selesaikan check-out dulu sebelum menutup PTW.
              </p>
            </div>
          )}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Checklist penutupan</p>
            {PTW_CLOSURE_CHECKLIST.map(item => (
              <label key={item.key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={!!checked[item.key]}
                  onChange={e => setChecked(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="mt-0.5 rounded-sm"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Waktu pekerjaan selesai</label>
            <input
              type="datetime-local"
              value={finishedAt}
              max={nowLocalInput()}
              onChange={e => setFinishedAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan penutupan <span className="text-rose-500">*</span></label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ringkasan hasil pekerjaan, kondisi akhir area, atau temuan yang perlu dicatat."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Ajukan Penutupan
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

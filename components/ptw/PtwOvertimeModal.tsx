'use client';

import { useState } from 'react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { X, Loader2, AlertCircle, Moon } from 'lucide-react';
import { requestPtwOvertime } from '@/app/dashboard/projects/[id]/completion-actions';
import { overtimeMinutes, formatDuration } from '@/lib/ptw-overtime';

function todayJakarta() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function PtwOvertimeModal({
  ptwId, ptwTitle, validFrom, validTo, workStart, workEnd, onClose,
}: {
  ptwId: string; ptwTitle: string; validFrom: string; validTo: string;
  workStart?: string | null; workEnd?: string | null; onClose: () => void;
}) {
  const today = todayJakarta();
  const minDate = validFrom > today ? validFrom : today;
  const [tanggal, setTanggal] = useState(minDate <= validTo ? minDate : '');
  const [mulai, setMulai] = useState(workEnd || '17:00');
  const [selesai, setSelesai] = useState('21:00');
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const minutes = overtimeMinutes(mulai, selesai);
  const lewatTengahMalam = !!mulai && !!selesai && selesai <= mulai;
  const canSubmit = !!tanggal && tanggal >= minDate && tanggal <= validTo && mulai !== selesai && alasan.trim().length > 0 && !loading;

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const res = await requestPtwOvertime({ ptwId, tanggal, mulai, selesai, alasan });
    if (res.success) window.location.reload();
    else { setError(res.error); setLoading(false); }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <ModalPortal zIndex={100}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Ajukan Lembur PTW</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ptwTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <p><strong>Jam kerja normal PTW:</strong> {workStart || '-'} – {workEnd || '-'}</p>
            <p>Pekerjaan di luar jam itu wajib diajukan per tanggal dan diverifikasi HSSE sebelum dilakukan. Lembur yang disetujui tercetak di dokumen PTW.</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal lembur</label>
            <input type="date" value={tanggal} min={minDate} max={validTo} onChange={e => setTanggal(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Jam mulai</label>
              <input type="time" value={mulai} onChange={e => setMulai(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Jam selesai</label>
              <input type="time" value={selesai} onChange={e => setSelesai(e.target.value)} className={inputCls} />
            </div>
          </div>
          {mulai && selesai && mulai !== selesai && (
            <p className="text-xs font-semibold text-primary">
              Durasi lembur {formatDuration(minutes)}{lewatTengahMalam ? ' — melewati tengah malam (selesai di hari berikutnya)' : ''}.
            </p>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Alasan lembur <span className="text-rose-500">*</span></label>
            <textarea rows={3} value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Mengapa pekerjaan harus dilanjutkan di luar jam kerja normal?" className={inputCls} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">Batal</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Moon className="w-4 h-4" />}
            Ajukan Lembur
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

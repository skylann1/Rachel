'use client';

import React from 'react';
import { CheckCircle2, Clock, Circle, AlertTriangle } from 'lucide-react';
import type { StageAssignmentRowWithName } from '@/lib/stage-assignments';

export interface StageTimelineStep {
  key: string;
  label: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function names(rows: StageAssignmentRowWithName[]) {
  return rows.map(r => r.assignee_name || 'Tidak diketahui').join(', ');
}

/**
 * Timeline detail satu dokumen (Prosedur/JSA/PTW) lintas SELURUH tahapnya —
 * bukan cuma tahap yang sedang berjalan. `currentIndex` dan `rows` harus
 * dihitung dari status LIVE dokumen (lihat procedureStageIndex/jsaStageIndex/
 * ptwStageIndex di lib/*-status.ts), karena stage_assignments sendiri bisa
 * memuat baris 'pending' untuk tahap yang jauh di depan (admin PGN boleh
 * menugaskan semua tahap sekaligus di muka lewat halaman Kelola Proyek).
 */
export function DocStageTimeline({
  steps, currentIndex, rows,
}: {
  steps: readonly StageTimelineStep[];
  /** -1 = belum mulai (Draft), steps.length = semua tahap selesai. */
  currentIndex: number;
  rows: Record<string, StageAssignmentRowWithName[]>;
}) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const stepRows = rows[step.key] ?? [];
        const state: 'done' | 'current' | 'upcoming' = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';

        let detail: React.ReactNode = null;
        if (state === 'done') {
          const approvedRows = stepRows.filter(r => r.status === 'approved');
          if (approvedRows.length > 0) {
            const latest = approvedRows.reduce((a, b) => (a.decided_at ?? '') > (b.decided_at ?? '') ? a : b);
            detail = <span>Disetujui oleh <strong>{names(approvedRows)}</strong> · {formatDate(latest.decided_at)}</span>;
          } else {
            detail = <span className="text-slate-400">Dilalui (detail reviewer tidak tercatat)</span>;
          }
        } else if (state === 'current') {
          const pendingRows = stepRows.filter(r => r.status === 'pending');
          if (pendingRows.length > 0) {
            detail = <span>Menunggu persetujuan dari <strong>{names(pendingRows)}</strong></span>;
          } else {
            detail = (
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Belum ada reviewer ditugaskan untuk tahap ini
              </span>
            );
          }
        } else {
          const assignedRows = stepRows.filter(r => r.status === 'pending');
          detail = assignedRows.length > 0
            ? <span className="text-slate-400">Sudah ditugaskan ke {names(assignedRows)} — menunggu urutan</span>
            : <span className="text-slate-400">Belum sampai tahap ini</span>;
        }

        const Icon = state === 'done' ? CheckCircle2 : state === 'current' ? Clock : Circle;
        const iconTone = state === 'done' ? 'text-emerald-600 bg-emerald-50' : state === 'current' ? 'text-amber-600 bg-amber-50' : 'text-slate-300 bg-slate-50';
        const labelTone = state === 'upcoming' ? 'text-slate-400' : 'text-slate-800';

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${iconTone}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className={`text-sm font-bold ${labelTone}`}>{step.label}</div>
              <div className="text-xs mt-0.5">{detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

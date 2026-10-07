'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DocStageTimeline, type StageTimelineStep } from './doc-stage-timeline';
import type { StageAssignmentRowWithName } from '@/lib/stage-assignments';

/**
 * Siapa yang sedang ditunggu, dari sudut pandang orang yang melihat:
 *   action   — tahap ini menunggu KAMU (ada stage_assignments pending milikmu)
 *   waiting  — berjalan, tapi bukan tahapmu
 *   done     — seluruh tahap sudah lewat
 *   returned — ditolak, dikembalikan ke vendor
 *   idle     — belum diajukan sama sekali
 */
export type RailTone = 'action' | 'waiting' | 'done' | 'returned' | 'idle';

const CURRENT_SEGMENT: Record<RailTone, string> = {
  action: 'bg-amber-400',
  waiting: 'bg-sky-400',
  done: 'bg-emerald-500',
  returned: 'bg-rose-400',
  idle: 'bg-slate-200',
};

const EYEBROW_TONE: Record<RailTone, string> = {
  action: 'text-amber-700',
  waiting: 'text-sky-700',
  done: 'text-emerald-700',
  returned: 'text-rose-700',
  idle: 'text-slate-400',
};

/**
 * Posisi satu dokumen di dalam rantai persetujuannya, sebagai bar bertahap —
 * satu segmen per tahap, jadi "tahap ke berapa dari berapa" kebaca tanpa
 * perlu diklik dulu. Urutan tahap datang dari *_STAGE_SEQUENCE di
 * lib/*-status.ts, dan `currentIndex` HARUS dihitung dari status live dokumen
 * (procedureStageIndex/jsaStageIndex/ptwStageIndex) — bukan dari
 * stage_assignments, yang bisa punya baris 'pending' untuk tahap yang masih
 * jauh di depan.
 */
export function StageRail({
  steps, currentIndex, tone, rows, onRollback, className = '',
}: {
  steps: readonly StageTimelineStep[];
  /** -1 = belum diajukan, steps.length = seluruh tahap selesai. */
  currentIndex: number;
  tone: RailTone;
  /** stage_assignments per stage_key — tanpa ini, rincian per tahap & hitungan approver disembunyikan. */
  rows?: Record<string, StageAssignmentRowWithName[]>;
  onRollback?: (step: StageTimelineStep) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const total = steps.length;
  const current = currentIndex >= 0 && currentIndex < total ? steps[currentIndex] : null;
  const currentRows = current && rows ? rows[current.key] ?? [] : [];
  const approvedCount = currentRows.filter(r => r.status === 'approved').length;

  const eyebrow = tone === 'done' ? `Selesai — ${total} tahap dilalui`
    : tone === 'returned' ? 'Dikembalikan untuk revisi'
    : current ? `Tahap ${currentIndex + 1} dari ${total}`
    : 'Belum diajukan';

  return (
    <div className={className}>
      <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${EYEBROW_TONE[tone]}`}>
        {eyebrow}
      </div>
      {current && (
        <div className="text-sm font-bold text-slate-800 mt-0.5">{current.label}</div>
      )}

      <div className="flex items-center gap-1 mt-2.5" role="presentation">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          const fill = state === 'done' ? 'bg-emerald-500'
            : state === 'current' ? CURRENT_SEGMENT[tone]
            : 'bg-slate-200';
          return (
            <span
              key={step.key}
              title={`${i + 1}. ${step.label}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${fill} ${
                state === 'current' && tone === 'action' ? 'motion-safe:animate-pulse' : ''
              }`}
            />
          );
        })}
      </div>

      {current && rows && (
        <div className="mt-2.5">
          {currentRows.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Belum ada reviewer ditugaskan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1">
              <Users className="w-3.5 h-3.5" /> {approvedCount} dari {currentRows.length} sudah menyetujui
            </span>
          )}
        </div>
      )}

      {tone === 'done' && (
        <div className="mt-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Seluruh tahap disetujui
          </span>
        </div>
      )}

      {rows && (
        <>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? 'Sembunyikan rincian tahapan' : 'Lihat rincian tiap tahapan'}
          </button>
          {open && (
            <div className="mt-3 bg-white rounded-xl border border-slate-200 p-4">
              <DocStageTimeline
                steps={steps}
                currentIndex={currentIndex}
                rows={rows}
                onRollback={onRollback}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  ChevronDown, Trash2, Copy, AlertTriangle, CheckCircle2, ArrowRight, ShieldOff, Replace, Wrench, ClipboardList, HardHat, TrendingDown,
} from 'lucide-react';
import { rpnLevel, type JsaRisk } from '@/lib/jsa-risk';
import type { StepKebutuhan } from '@/lib/procedure-kebutuhan';

export interface ControlDetail {
  eliminasi: string;
  substitusi: string;
  rekayasa: string;
  administrasi: string;
  apd: string;
}

export interface JsaStepData {
  id: number;
  langkah: string;
  kebutuhan?: StepKebutuhan;
  jenisBahaya: string;
  sebab: string;
  potensiBahaya: string;
  faktorPositif: ControlDetail;
  inherentRisk: JsaRisk;
  mitigasi: ControlDetail;
  residualRisk: JsaRisk;
}

const BAHAYA_OPTIONS = ['Fisika', 'Kimia', 'Biologi', 'Ergonomi', 'Psikologi'];

/** Hirarki pengendalian: dari yang paling efektif (atas) ke yang paling lemah (bawah). */
const CONTROL_FIELDS: { key: keyof ControlDetail; label: string; hint: string; icon: React.ElementType }[] = [
  { key: 'eliminasi', label: 'Eliminasi', hint: 'Hilangkan sumber bahaya', icon: ShieldOff },
  { key: 'substitusi', label: 'Substitusi', hint: 'Ganti dengan yang lebih aman', icon: Replace },
  { key: 'rekayasa', label: 'Rekayasa Alat', hint: 'Pelindung / pengaman teknis', icon: Wrench },
  { key: 'administrasi', label: 'Administrasi', hint: 'Prosedur, rambu, pelatihan', icon: ClipboardList },
  { key: 'apd', label: 'APD', hint: 'Alat pelindung diri', icon: HardHat },
];

const RISK_FACTORS: { key: 'severity' | 'intensitas' | 'kapabilitas' | 'history'; label: string }[] = [
  { key: 'severity', label: 'Severity' },
  { key: 'intensitas', label: 'Intensitas' },
  { key: 'kapabilitas', label: 'Kapabilitas' },
  { key: 'history', label: 'History' },
];

const hasControl = (c: ControlDetail) => Object.values(c).some(v => (v || '').trim().length > 0);

/** Isian yang belum ada pada langkah ini — dipakai pill kelengkapan & peringatan. */
export function stepIssues(step: JsaStepData): string[] {
  const issues: string[] = [];
  if (!(step.langkah || '').trim()) issues.push('Langkah pekerjaan belum diisi');
  if (!(step.sebab || '').trim()) issues.push('Sebab / sumber bahaya belum diisi');
  if (!(step.potensiBahaya || '').trim()) issues.push('Potensi bahaya belum diisi');
  if (!hasControl(step.faktorPositif) && !hasControl(step.mitigasi)) issues.push('Belum ada pengendalian (faktor positif / mitigasi)');
  return issues;
}

/** Peringatan substantif tentang risiko — tidak memblokir submit, tapi perlu dibaca. */
export function stepWarnings(step: JsaStepData): string[] {
  const w: string[] = [];
  const inh = step.inherentRisk.rpn;
  const res = step.residualRisk.rpn;
  if (res > inh) w.push('Residual Risk lebih tinggi dari Inherent Risk — mitigasi seharusnya menurunkan risiko, bukan menaikkannya.');
  if (inh >= 5 && !hasControl(step.mitigasi)) w.push('Risiko awal sudah Sedang atau lebih, tetapi pengendalian tambahan (mitigasi) kosong.');
  if (res >= 10) w.push(`Residual Risk masih ${rpnLevel(res).label} (RPN ${res}) — pertimbangkan pengendalian tambahan lebih tinggi pada hirarki.`);
  if (inh >= 5 && res === inh && hasControl(step.mitigasi)) w.push('Mitigasi diisi tetapi nilai Residual Risk sama dengan Inherent — perbarui nilai residual setelah mitigasi.');
  return w;
}

function Scale({ value, onChange, tone }: { value: number; onChange: (v: number) => void; tone: 'orange' | 'emerald' }) {
  const on = tone === 'orange' ? 'bg-orange-500 text-white border-orange-500' : 'bg-emerald-600 text-white border-emerald-600';
  return (
    <div className="flex gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-lg border text-xs font-bold transition-colors ${
            value === n ? on : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function RiskPanel({
  title, tone, risk, onChange, subtitle,
}: {
  title: string; subtitle: string; tone: 'orange' | 'emerald'; risk: JsaRisk; onChange: (field: string, value: number) => void;
}) {
  const level = rpnLevel(risk.rpn);
  const frame = tone === 'orange' ? 'border-orange-200 bg-orange-50/50' : 'border-emerald-200 bg-emerald-50/50';
  const head = tone === 'orange' ? 'text-orange-800' : 'text-emerald-800';
  return (
    <div className={`rounded-2xl border p-4 ${frame}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className={`text-sm font-bold ${head}`}>{title}</h4>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-xl px-3 py-1.5 text-center shrink-0 ${level.badge}`}>
          <p className="text-[10px] font-semibold leading-none opacity-90">RPN</p>
          <p className="text-xl font-black leading-tight">{risk.rpn}</p>
          <p className="text-[10px] font-bold leading-none">{level.label}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {RISK_FACTORS.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-slate-600 w-24 shrink-0">{f.label}</label>
            <Scale value={risk[f.key]} onChange={v => onChange(f.key, v)} tone={tone} />
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>Total <b className="text-slate-800">{risk.total}</b></span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span>Probability <b className="text-slate-800">{risk.probability}</b></span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span>RPN = {risk.severity} × {risk.probability} = <b className="text-slate-800">{risk.rpn}</b></span>
      </div>
    </div>
  );
}

function ControlGroup({
  title, subtitle, value, onChange, accent,
}: {
  title: string; subtitle: string; value: ControlDetail; onChange: (k: keyof ControlDetail, v: string) => void; accent: string;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <h4 className={`text-sm font-bold ${accent}`}>{title}</h4>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      {CONTROL_FIELDS.map(f => {
        const Icon = f.icon;
        return (
          <div key={f.key}>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              {f.label}
              <span className="font-normal text-slate-400">· {f.hint}</span>
            </label>
            <textarea
              value={value[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-300"
              placeholder="—"
            />
          </div>
        );
      })}
    </div>
  );
}

export default function JsaStepCard({
  step, index, langkahLocked, canRemove, canDuplicate, kebutuhan,
  onPatch, onRisk, onControl, onRemove, onDuplicate,
}: {
  step: JsaStepData;
  index: number;
  /** true kalau langkah mengikuti Prosedur Kerja (tidak bisa diubah di JSA). */
  langkahLocked: boolean;
  canRemove: boolean;
  canDuplicate: boolean;
  /** Blok "Kebutuhan dari Prosedur" (chip centang) — dirender page karena butuh data prosedur. */
  kebutuhan?: React.ReactNode;
  onPatch: (patch: Partial<JsaStepData>) => void;
  onRisk: (which: 'inherentRisk' | 'residualRisk', field: string, value: number) => void;
  onControl: (which: 'faktorPositif' | 'mitigasi', field: keyof ControlDetail, value: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(true);
  const issues = stepIssues(step);
  const warnings = stepWarnings(step);
  const inh = step.inherentRisk.rpn;
  const res = step.residualRisk.rpn;
  const reduction = inh > 0 ? Math.round(((inh - res) / inh) * 100) : 0;
  const inhLevel = rpnLevel(inh);
  const resLevel = rpnLevel(res);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-200">
        <span className="w-8 h-8 rounded-xl bg-slate-900 text-white text-sm font-black flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-slate-800 truncate">{step.langkah?.trim() || 'Langkah pekerjaan belum diisi'}</p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded-md font-bold ${inhLevel.badge}`}>RPN {inh}</span>
            <ArrowRight className="w-3 h-3" />
            <span className={`px-1.5 py-0.5 rounded-md font-bold ${resLevel.badge}`}>RPN {res}</span>
            {inh > 0 && res <= inh && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700">
                <TrendingDown className="w-3 h-3" /> turun {reduction}%
              </span>
            )}
          </p>
        </button>

        <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border ${
          issues.length === 0
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {issues.length === 0 ? <><CheckCircle2 className="w-3.5 h-3.5" /> Lengkap</> : <><AlertTriangle className="w-3.5 h-3.5" /> {issues.length} isian kurang</>}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {canDuplicate && (
            <button type="button" onClick={onDuplicate} title="Duplikat langkah" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Copy className="w-4 h-4" />
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={onRemove} title="Hapus langkah" className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => setOpen(o => !o)} title={open ? 'Ciutkan' : 'Buka'} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {open && (
        <div className="p-4 sm:p-5 space-y-5">
          {/* 1. Identifikasi bahaya */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Identifikasi Bahaya</h4>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Langkah pekerjaan</label>
                {langkahLocked ? (
                  <div className="px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl">
                    {step.langkah}
                    <p className="text-[10px] text-slate-400 mt-1">Mengikuti Prosedur Kerja — ubah di Prosedur.</p>
                  </div>
                ) : (
                  <textarea
                    value={step.langkah}
                    onChange={e => onPatch({ langkah: e.target.value })}
                    rows={2}
                    placeholder="Tuliskan langkah pekerjaan..."
                    className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Jenis bahaya</label>
                <div className="flex flex-wrap gap-1.5">
                  {BAHAYA_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onPatch({ jenisBahaya: opt })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        step.jenisBahaya === opt
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Sebab / sumber</label>
                <textarea
                  value={step.sebab}
                  onChange={e => onPatch({ sebab: e.target.value })}
                  rows={2}
                  placeholder="Sebab / sumber bahaya..."
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Potensi bahaya</label>
                <textarea
                  value={step.potensiBahaya}
                  onChange={e => onPatch({ potensiBahaya: e.target.value })}
                  rows={2}
                  placeholder="Potensi bahaya yang dapat terjadi..."
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              {kebutuhan}
            </div>

            <ControlGroup
              title="Faktor Positif"
              subtitle="Pengendalian yang sudah ada sebelum pekerjaan"
              value={step.faktorPositif}
              onChange={(k, v) => onControl('faktorPositif', k, v)}
              accent="text-slate-800"
            />

            <ControlGroup
              title="Pengendalian Tambahan / Mitigasi"
              subtitle="Yang akan dilakukan untuk menurunkan risiko"
              value={step.mitigasi}
              onChange={(k, v) => onControl('mitigasi', k, v)}
              accent="text-emerald-800"
            />
          </div>

          {/* 2. Penilaian risiko */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RiskPanel
              title="Inherent Risk"
              subtitle="Risiko sebelum mitigasi"
              tone="orange"
              risk={step.inherentRisk}
              onChange={(f, v) => onRisk('inherentRisk', f, v)}
            />
            <RiskPanel
              title="Residual Risk"
              subtitle="Risiko setelah pengendalian tambahan"
              tone="emerald"
              risk={step.residualRisk}
              onChange={(f, v) => onRisk('residualRisk', f, v)}
            />
          </div>

          {/* 3. Peringatan */}
          {(issues.length > 0 || warnings.length > 0) && (
            <ul className="space-y-1.5">
              {issues.map(m => (
                <li key={m} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {m}
                </li>
              ))}
              {warnings.map(m => (
                <li key={m} className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

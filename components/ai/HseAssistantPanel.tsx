'use client';

import React, { useState } from 'react';
import { Sparkles, Zap, CheckCircle2, Eye, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';

export interface HseAnomaly {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  auto_comment: string;
  suggested_hazard?: string;
  suggested_mitigation?: string;
}

const SEVERITY_CONFIG = {
  critical: { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700 border-rose-200', icon: '🔴', label: 'KRITIS', dot: 'bg-rose-400', text: 'text-rose-300' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🟡', label: 'PERINGATAN', dot: 'bg-amber-400', text: 'text-amber-300' },
  info: { border: 'border-l-sky-500', bg: 'bg-sky-50', badge: 'bg-sky-100 text-sky-700 border-sky-200', icon: '🔵', label: 'INFO', dot: 'bg-sky-400', text: 'text-sky-300' },
} as const;

export interface HseAssistantPanelProps {
  score: number;
  summary: string;
  anomalies: HseAnomaly[];
  /** Label shown above each anomaly's comment, e.g. "Langkah 2 — Pembongkaran Keramik". */
  getStepLabel?: (id: number) => string | undefined;
  /** Vendor flow: scroll the JSA table to the row and highlight it. */
  onLocateStep?: (id: number) => void;
  /** Internal review flow: return the raw step content to show inline when a card is expanded. */
  renderStepDetail?: (id: number) => React.ReactNode;
  /** Vendor flow: "Terapkan Saran" button that auto-fills the suggestion into the form. */
  renderSuggestionAction?: (anomaly: HseAnomaly) => React.ReactNode;
}

export function HseAssistantPanel({
  score,
  summary,
  anomalies,
  getStepLabel,
  onLocateStep,
  renderStepDetail,
  renderSuggestionAction,
}: HseAssistantPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const counts = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
  };

  return (
    <div className="bg-white rounded-3xl border border-violet-200 shadow-xl overflow-hidden ring-4 ring-violet-50">
      <div className="bg-gradient-to-r from-slate-900 to-violet-900 px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="48" cy="48" r="40" fill="none"
                stroke={score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{score}</span>
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-300" />
              <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider">Evaluasi AI — Skor Kepatuhan K3</h4>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{summary}</p>
            <div className="flex items-center gap-4 mt-3 text-xs font-bold">
              {(['critical', 'warning', 'info'] as const).map(sev => counts[sev] > 0 && (
                <span key={sev} className={`flex items-center gap-1.5 ${SEVERITY_CONFIG[sev].text}`}>
                  <span className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG[sev].dot}`} />
                  {counts[sev]} {sev === 'critical' ? 'Kritis' : sev === 'warning' ? 'Peringatan' : 'Info'}
                </span>
              ))}
              {anomalies.length === 0 && (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tidak ada anomali ditemukan
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="px-4 sm:px-6 py-5 space-y-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-bold text-slate-800">{anomalies.length} temuan AI ditemukan</p>
          </div>
          {anomalies.map(a => {
            const cfg = SEVERITY_CONFIG[a.severity];
            const isExpanded = expandedId === a.id;
            const stepLabel = getStepLabel?.(a.id);
            return (
              <div key={a.id} className={`bg-white border border-slate-200 ${cfg.border} border-l-4 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.badge}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                          {a.category}
                        </span>
                      </div>
                      {stepLabel && <p className="text-xs font-bold text-slate-800 mb-1">{stepLabel}</p>}
                      <p className="text-sm text-slate-600 leading-relaxed">{a.auto_comment}</p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2">
                      {onLocateStep && (
                        <button
                          onClick={() => onLocateStep(a.id)}
                          className="flex items-center gap-1.5 justify-center px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                          title="Scroll ke baris JSA ini"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lihat Baris <ArrowDown className="w-3 h-3" />
                        </button>
                      )}
                      {!onLocateStep && renderStepDetail && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="flex items-center gap-1.5 justify-center px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lihat Langkah {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {!onLocateStep && renderStepDetail && isExpanded && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      {renderStepDetail(a.id)}
                    </div>
                  )}

                  {(a.suggested_hazard || a.suggested_mitigation) && (
                    <div className={`mt-3 p-3 rounded-lg ${cfg.bg} space-y-3`}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Saran Perbaikan AI
                        </p>
                        {renderSuggestionAction?.(a)}
                      </div>
                      {a.suggested_hazard && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 mt-0.5 w-16">Bahaya:</span>
                          <p className="text-xs text-slate-700 flex-1">{a.suggested_hazard}</p>
                        </div>
                      )}
                      {a.suggested_mitigation && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 mt-0.5 w-16">Mitigasi:</span>
                          <p className="text-xs text-slate-700 flex-1">{a.suggested_mitigation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

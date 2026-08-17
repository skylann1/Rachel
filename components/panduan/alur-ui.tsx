import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';

/**
 * Primitif visual untuk halaman Panduan Alur (versi vendor & internal).
 * Dipakai berdua supaya bahasa visualnya sama persis — yang beda cuma isi
 * dan sudut pandangnya.
 *
 * Catatan Tailwind: kelas warna ditulis lengkap di TONES, tidak dirakit
 * lewat template string (`bg-${tone}-50`), karena Tailwind memindai kelas
 * secara statis dan kelas hasil interpolasi tidak akan ikut ter-generate.
 */

export type Tone = 'blue' | 'amber' | 'emerald' | 'red' | 'slate' | 'indigo';

export const TONES: Record<Tone, {
  softBg: string; border: string; text: string; iconBox: string; dot: string; line: string; chip: string;
}> = {
  blue: {
    softBg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    iconBox: 'bg-blue-100 text-blue-600', dot: 'bg-blue-600', line: 'bg-blue-200',
    chip: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  amber: {
    softBg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
    iconBox: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500', line: 'bg-amber-200',
    chip: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  emerald: {
    softBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    iconBox: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-600', line: 'bg-emerald-200',
    chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  red: {
    softBg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
    iconBox: 'bg-red-100 text-red-600', dot: 'bg-red-600', line: 'bg-red-200',
    chip: 'bg-red-100 text-red-700 border-red-200',
  },
  slate: {
    softBg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700',
    iconBox: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', line: 'bg-slate-200',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  indigo: {
    softBg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700',
    iconBox: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-600', line: 'bg-indigo-200',
    chip: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
};

/** Header besar bergradien, mengikuti gaya header detail proyek. */
export function PanduanHero({ title, subtitle, icon: Icon, badge }: {
  title: string; subtitle: string; icon: LucideIcon; badge: string;
}) {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2" />
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 sm:items-center">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-sm text-white flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
          <Icon className="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <div>
          <span className="inline-block bg-white/10 border border-white/20 text-blue-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest mb-2">
            {badge}
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h1>
          <p className="text-blue-200/90 mt-2 text-sm max-w-2xl leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/** Strip ringkas di atas timeline: 3 fase + panah. */
export function PhaseStrip({ phases }: { phases: { label: string; icon: LucideIcon; tone: Tone }[] }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto hide-scrollbar pb-1">
      {phases.map((p, i) => {
        const t = TONES[p.tone];
        const Icon = p.icon;
        return (
          <React.Fragment key={p.label}>
            <div className={`flex-1 min-w-[120px] flex flex-col items-center gap-2 p-4 rounded-2xl border ${t.border} ${t.softBg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.iconBox}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-black text-center leading-tight ${t.text}`}>{p.label}</span>
            </div>
            {i < phases.length - 1 && (
              <div className="flex items-center shrink-0 text-slate-300">
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Satu tahap pada timeline vertikal, dengan nomor bulat + garis penghubung. */
export function PhaseCard({ step, totalSteps, eyebrow, title, subtitle, icon: Icon, tone, isLast, children }: {
  step: number; totalSteps: number; eyebrow: string; title: string; subtitle: string;
  icon: LucideIcon; tone: Tone; isLast?: boolean; children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className="relative pl-0 sm:pl-16">
      {/* Nomor bulat + garis penghubung ke tahap berikutnya (desktop) */}
      <div className="hidden sm:flex flex-col items-center absolute left-0 top-0 bottom-0 w-12">
        <div className={`w-12 h-12 rounded-2xl ${t.dot} text-white flex items-center justify-center font-black text-lg shadow-lg shrink-0`}>
          {step}
        </div>
        {!isLast && <div className={`w-1 flex-1 ${t.line} rounded-full mt-2 mb-2`} />}
      </div>

      <div className={`bg-white border ${t.border} rounded-2xl shadow-sm overflow-hidden ${isLast ? '' : 'mb-6'}`}>
        <div className={`${t.softBg} px-5 sm:px-7 py-5 border-b ${t.border} flex items-start gap-4`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${t.iconBox}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-widest ${t.text}`}>{eyebrow}</span>
              <span className="text-[10px] font-bold text-slate-400">Tahap {step} dari {totalSteps}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">{title}</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
          </div>
        </div>
        <div className="p-5 sm:p-7 space-y-5">{children}</div>
      </div>
    </div>
  );
}

/** Kolom "siapa melakukan apa" — dipakai berpasangan di dalam PhaseCard. */
export function Lane({ title, icon: Icon, tone, items }: {
  title: string; icon: LucideIcon; tone: Tone; items: React.ReactNode[];
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-xl border ${t.border} ${t.softBg} p-4`}>
      <div className={`flex items-center gap-2 font-black text-xs uppercase tracking-wider mb-3 ${t.text}`}>
        <Icon className="w-4 h-4" /> {title}
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rantai status persis seperti yang muncul di aplikasi. */
export function StatusFlow({ label, statuses }: {
  label: string; statuses: { name: string; tone: Tone }[];
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {statuses.map((s, i) => (
          <React.Fragment key={s.name}>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${TONES[s.tone].chip} whitespace-nowrap`}>
              {s.name}
            </span>
            {i < statuses.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Kotak catatan/peringatan. */
export function NoteBox({ tone, icon: Icon, title, children }: {
  tone: Tone; icon: LucideIcon; title: string; children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-xl border ${t.border} ${t.softBg} p-4 flex gap-3`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.iconBox}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className={`font-black text-sm ${t.text}`}>{title}</div>
        <div className="text-sm text-slate-600 mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** Kartu ringkas untuk grid fitur lapangan (QR / toolbox / SWA). */
export function FeatureCard({ icon: Icon, tone, title, children }: {
  icon: LucideIcon; tone: Tone; title: string; children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`bg-white border ${t.border} rounded-2xl p-5 shadow-sm`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${t.iconBox}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-black text-slate-800 text-sm">{title}</h3>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}

/** Judul seksi di luar timeline. */
export function SectionTitle({ icon: Icon, title, subtitle }: {
  icon: LucideIcon; title: string; subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

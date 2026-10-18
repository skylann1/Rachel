'use client';

import React, { useMemo, useState } from 'react';
import { ClipboardList, Lock, Loader2, Send, UserCheck } from 'lucide-react';
import {
  PTW_TYPES, PTW_MAX_VALID_DAYS, PtwSafetyChecklistData, flattenSafetyChecklist, ptwValidDayDates,
} from '@/lib/ptw-types';
import { PTW_STATUS } from '@/lib/ptw-status';
import {
  FIELD_PERAN_LABEL, dayRowStatus, formatCheckDate, formatCheckTime, parseDateUtc,
  type DayRowStatus, type FieldPeran,
} from '@/lib/ptw-field';

export interface DailyCheckPtw {
  id: string;
  ptw_type?: string | null;
  ptw_number?: string | null;
  /** Status EFEKTIF (sudah memperhitungkan Expired) — sama seperti PtwSafetyCheckTab. */
  status: string;
  valid_from?: string | null;
  valid_to?: string | null;
  safety_checklist?: PtwSafetyChecklistData | null;
}

interface Props {
  ptws: DailyCheckPtw[];
  /** Baris mentah ptw_daily_checks lintas semua PTW proyek ini. */
  dailyChecks: any[];
  /** Baris mentah ptw_field_assignments lintas semua PTW proyek ini. */
  assignments: any[];
  profileById?: Record<string, { full_name?: string | null; email?: string | null }>;
  /** Caller saat ini. */
  currentUserId: string;
  /** Hari ini (WIB) 'YYYY-MM-DD'; dikirim dari page. */
  today: string;
  /** true kalau caller punya permission (di samping status peran aktif). */
  canFill: boolean;
  /** Dipanggil saat submit; return false = tahan form (caller tampilkan pesan). */
  onSubmit?: (params: { ptwId: string; uraian?: string; requiredKeys?: string[] }) => Promise<boolean | void>;
}

const STATUS_CHIP: Record<DayRowStatus, string> = {
  lengkap: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sebagian: 'bg-amber-100 text-amber-700 border-amber-200',
  terlewat: 'bg-rose-100 text-rose-700 border-rose-200',
  hari_ini: 'bg-blue-100 text-blue-700 border-blue-200',
  mendatang: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<DayRowStatus, string> = {
  lengkap: 'Lengkap',
  sebagian: 'Sebagian',
  terlewat: 'Terlewat',
  hari_ini: 'Hari Ini',
  mendatang: 'Mendatang',
};

const fmt = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Semua key checklist yang checkable untuk tipe PTW ini — persis required_keys RPC pengawas. */
function requiredKeysFor(ptwType?: string | null): string[] {
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];
  return flattenSafetyChecklist(typeDef)
    .filter(r => r.checkable && r.key)
    .map(r => r.key as string);
}

export default function PtwDailyCheckTab({
  ptws, dailyChecks, assignments, profileById = {}, currentUserId, today, canFill, onSubmit,
}: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Hari yang sedang dibuka per PTW di tampilan HP (indeks kolom hari, 0-based). */
  const [mobileDay, setMobileDay] = useState<Record<string, number>>({});

  const nameOf = (userId?: string | null) => {
    if (!userId) return '-';
    return profileById[userId]?.full_name || profileById[userId]?.email || '-';
  };

  const todayUtc = parseDateUtc(today);

  if (ptws.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Belum ada PTW di proyek ini.</p>
      </div>
    );
  }

  const handle = async (ptwId: string) => {
    if (!onSubmit) return;
    const ptw = ptws.find(p => p.id === ptwId);
    const myPeran = assignments.find(
      (a: any) => a.ptw_id === ptwId && a.user_id === currentUserId && a.aktif_sampai == null
    )?.peran as FieldPeran | undefined;
    if (!myPeran) return;

    setSubmittingId(ptwId);
    setError(null);
    try {
      // Pemegang wajib uraian; pengawas wajib seluruh kolom hari ini terjawab di safety checklist.
      const ok = await onSubmit({
        ptwId,
        uraian: myPeran === 'pemegang' ? (form[ptwId] || '') : undefined,
        requiredKeys: myPeran === 'pengawas' ? requiredKeysFor(ptw?.ptw_type) : undefined,
      });
      if (ok !== false) setForm(f => ({ ...f, [ptwId]: '' }));
    } catch (e: any) {
      setError(e?.message || 'Gagal mengirim daily check.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/10 px-5 py-4 flex items-start gap-3">
        <ClipboardList className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-slate-800">Isian Riksa Harian (Daily Check)</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Catatan harian pelaksanaan PTW oleh <strong>Pemegang PTW</strong> (uraian pekerjaan) dan
            konfirmasi <strong>Pengawas PTW</strong>. Satu isian per peran per hari — kolom Pengawas
            menuntut seluruh baris Safety Checklist hari itu terjawab dulu.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</div>
      )}

      {ptws.map(ptw => {
        const myAssignment = assignments.find(
          (a: any) => a.ptw_id === ptw.id && a.user_id === currentUserId && a.aktif_sampai == null
        );
        const myPeran: FieldPeran | undefined = myAssignment?.peran;
        const dayDates = ptwValidDayDates(ptw.valid_from, ptw.valid_to);
        const checksOfPtw = dailyChecks.filter((c: any) => c.ptw_id === ptw.id);
        const active = ptw.status === PTW_STATUS.aktif;

        // Hari ini dalam masa berlaku?
        const todayIdx = dayDates.findIndex(d => d === today);
        const todayHari = todayIdx >= 0 ? todayIdx + 1 : null;
        const isMyTurn = !!myPeran && active && canFill && todayHari !== null;

        // Sudah isi hari ini?
        const alreadyToday = myPeran
          ? checksOfPtw.some((c: any) => c.hari_ke === todayHari && c.peran === myPeran)
          : false;

        const title = (PTW_TYPES.find(t => t.id === ptw.ptw_type) || PTW_TYPES[0]).title.split('(')[0].trim();

        return (
          <section key={ptw.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ptw.ptw_number ? <>No. <span className="font-mono">{ptw.ptw_number}</span> · </> : null}
                  Berlaku {fmt(ptw.valid_from)} – {fmt(ptw.valid_to)}
                </p>
              </div>
              <span className="self-start sm:self-auto text-[11px] font-bold border rounded-full px-2.5 py-1 bg-slate-100 text-slate-600 border-slate-200">
                {ptw.status}
              </span>
            </div>

            {/* Tabel hari 1-7 — desktop */}
            <div className="hidden md:block px-5 py-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-3">Hari</th>
                    <th className="pb-2 pr-3">Tanggal</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Pemegang</th>
                    <th className="pb-2">Pengawas</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: dayDates.length || PTW_MAX_VALID_DAYS }, (_, i) => {
                    const hari = i + 1;
                    const dayDate = dayDates[i];
                    if (!dayDate) {
                      return (
                        <tr key={hari} className={`border-t ${hari > 7 && (hari - 1) % 7 === 0 ? 'border-t-2 border-indigo-300' : 'border-slate-100'}`}>
                          <td className="py-2 pr-3 font-mono text-slate-400">{hari}</td>
                          <td className="py-2 pr-3 text-slate-300" colSpan={4}>Tidak dalam masa berlaku</td>
                        </tr>
                      );
                    }
                    const holderCheck = checksOfPtw.find((c: any) => c.hari_ke === hari && c.peran === 'pemegang');
                    const pengawasCheck = checksOfPtw.find((c: any) => c.hari_ke === hari && c.peran === 'pengawas');
                    const filledCount = (holderCheck ? 1 : 0) + (pengawasCheck ? 1 : 0);
                    const st = dayRowStatus(dayDate, today, filledCount);
                    return (
                      <tr key={hari} className={`border-t ${hari > 7 && (hari - 1) % 7 === 0 ? 'border-t-2 border-indigo-300' : 'border-slate-100'}`}>
                        <td className="py-2 pr-3 font-mono font-bold text-slate-600">
                          {hari}
                          {hari > 7 && (hari - 1) % 7 === 0 && (
                            <span className="block text-[9px] font-bold uppercase tracking-wide text-indigo-500">Lembar {Math.floor((hari - 1) / 7) + 1}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{formatCheckDate(dayDate)}</td>
                        <td className="py-2 pr-3">
                          <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_CHIP[st]}`}>
                            {STATUS_LABEL[st]}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {holderCheck ? (
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <span className="font-bold">{holderCheck.inisial || '?'}</span>
                              <span className="truncate max-w-[12rem]">{nameOf(holderCheck.user_id)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          {pengawasCheck ? (
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <span className="font-bold">{pengawasCheck.inisial || '?'}</span>
                              <span className="truncate max-w-[12rem]">{nameOf(pengawasCheck.user_id)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tampilan HP: chip hari + satu kartu ringkasan per hari */}
            <div className="md:hidden px-5 py-4 space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                {Array.from({ length: dayDates.length || PTW_MAX_VALID_DAYS }, (_, i) => i).map((i) => {
                  const hari = i + 1;
                  const dayDate = dayDates[i];
                  const selected = (mobileDay[ptw.id] ?? (todayHari ? todayHari - 1 : 0)) === i;
                  return (
                    <button
                      key={hari}
                      type="button"
                      disabled={!dayDate}
                      onClick={() => setMobileDay((m) => ({ ...m, [ptw.id]: i }))}
                      aria-pressed={selected}
                      className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-bold text-left transition-colors disabled:opacity-40 ${
                        selected ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Hari {hari}{hari > 7 && <span className="ml-1 text-[9px] font-bold uppercase text-indigo-400">L{Math.floor((hari - 1) / 7) + 1}</span>}
                      {dayDate && (
                        <span className={`block font-normal ${selected ? 'text-white/80' : 'text-slate-400'}`}>
                          {formatCheckDate(dayDate)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const i = mobileDay[ptw.id] ?? (todayHari ? todayHari - 1 : 0);
                const hari = i + 1;
                const dayDate = dayDates[i];
                if (!dayDate) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      Tidak dalam masa berlaku
                    </div>
                  );
                }
                const holderCheck = checksOfPtw.find((c: any) => c.hari_ke === hari && c.peran === 'pemegang');
                const pengawasCheck = checksOfPtw.find((c: any) => c.hari_ke === hari && c.peran === 'pengawas');
                const filledCount = (holderCheck ? 1 : 0) + (pengawasCheck ? 1 : 0);
                const st = dayRowStatus(dayDate, today, filledCount);
                return (
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{formatCheckDate(dayDate)}</span>
                      <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_CHIP[st]}`}>
                        {STATUS_LABEL[st]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Pemegang</p>
                        {holderCheck ? (
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                            <span className="font-bold">{holderCheck.inisial || '?'}</span>
                            <span className="truncate">{nameOf(holderCheck.user_id)}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-300">—</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Pengawas</p>
                        {pengawasCheck ? (
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                            <span className="font-bold">{pengawasCheck.inisial || '?'}</span>
                            <span className="truncate">{nameOf(pengawasCheck.user_id)}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-300">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Form pengisian hari ini */}
            {isMyTurn && !alreadyToday && myPeran && (
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    Isi Daily Check Hari Ini — {FIELD_PERAN_LABEL[myPeran]} (Hari ke-{todayHari})
                  </p>
                  {myPeran === 'pemegang' ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        placeholder="Uraian pekerjaan yang dilaksanakan hari ini..."
                        value={form[ptw.id] || ''}
                        onChange={(e) => setForm(f => ({ ...f, [ptw.id]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 mt-2">
                      Pengawas wajib memastikan seluruh baris Safety Checklist hari ini sudah terjawab
                      sebelum konfirmasi. Bila belum, isi dulu di tab <strong>Safety Check</strong>.
                    </p>
                  )}
                  <button
                    onClick={() => handle(ptw.id)}
                    disabled={submittingId === ptw.id || (myPeran === 'pemegang' && !(form[ptw.id] || '').trim())}
                    className="mt-3 w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-3 sm:py-2 text-sm font-bold rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingId === ptw.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    {submittingId === ptw.id ? 'Mengirim...' : 'Kirim Daily Check'}
                  </button>
                </div>
              </div>
            )}

            {isMyTurn && alreadyToday && (
              <div className="px-5 pb-5">
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Daily check {FIELD_PERAN_LABEL[myPeran!].toLowerCase()} hari ini sudah Anda kirim.
                </p>
              </div>
            )}

            {!myPeran && checksOfPtw.length === 0 && (
              <div className="px-5 pb-5">
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  {active
                    ? 'Anda bukan Pemegang/Pengawas aktif PTW ini, jadi hanya bisa melihat.'
                    : 'Hanya lihat — PTW tidak aktif.'}
                </p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

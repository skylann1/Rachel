"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Users, ClipboardList, LogIn, LogOut, Siren, CheckCircle2, MapPin, Building2 } from 'lucide-react';
import { PTW_STATUS } from '@/lib/ptw-status';
import { logToolboxMeeting, checkInWorker, checkOutWorker, triggerStopWork } from './actions';

interface Checkin {
  id: string;
  worker_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

interface Meeting {
  id: string;
  topics: string;
  attendees: { name: string }[];
  conducted_by_name: string;
  created_at: string;
}

export default function CheckinClient({
  token, effectiveStatus, ptw, project, meeting, checkins,
}: {
  token: string;
  effectiveStatus: string;
  ptw: { id: string; ptwNumber: string | null; permitTitle: string; workers: { id?: string; worker_name: string }[]; stoppedAt: string | null; stoppedReason: string | null; stoppedByName: string | null };
  project: { name: string; location: string; vendorName: string };
  meeting: Meeting | null;
  checkins: Checkin[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // React state updates aren't synchronous, so a fast double-click/double-tap
  // can fire two handlers before `loading` re-renders the button as disabled.
  // This ref blocks re-entrant calls immediately, in the same tick.
  const busyRef = useRef(false);
  const [showStopForm, setShowStopForm] = useState(false);
  const [stopReporter, setStopReporter] = useState('');
  const [stopReason, setStopReason] = useState('');
  const [topics, setTopics] = useState('');
  const [conductedBy, setConductedBy] = useState('');
  const [attendeeNames, setAttendeeNames] = useState(['']);
  const [manualWorkerName, setManualWorkerName] = useState('');

  const openCheckins = checkins.filter(c => !c.checked_out_at);
  const isActiveStage = effectiveStatus === PTW_STATUS.aktif;
  const isStopped = effectiveStatus === PTW_STATUS.stoppedSwa;

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleLogMeeting = () => run(async () => {
    await logToolboxMeeting(token, {
      topics,
      attendees: attendeeNames.filter(n => n.trim()).map(name => ({ name: name.trim() })),
      conductedByName: conductedBy,
    });
    setTopics(''); setConductedBy(''); setAttendeeNames(['']);
  });

  const handleCheckIn = (name: string) => run(async () => {
    if (!name.trim()) return;
    await checkInWorker(token, name.trim());
  });

  const handleCheckOut = (id: string) => run(() => checkOutWorker(token, id));

  const handleStopWork = () => run(async () => {
    await triggerStopWork(token, { reporterName: stopReporter, reason: stopReason });
    setShowStopForm(false); setStopReporter(''); setStopReason('');
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-24 space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{ptw.ptwNumber || 'Belum bernomor'}</p>
        <h1 className="text-xl font-black text-slate-800 leading-tight">{ptw.permitTitle}</h1>
        <div className="mt-3 space-y-1 text-sm text-slate-500">
          <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {project.name} — {project.vendorName}</p>
          <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {project.location}</p>
        </div>
      </div>

      {!isActiveStage && !isStopped && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-slate-500 text-sm">PTW ini berstatus <strong>{effectiveStatus}</strong> — check-in dan Stop Work hanya berlaku selama PTW Aktif.</p>
        </div>
      )}

      {isStopped && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-red-700 font-black mb-2"><Siren className="w-5 h-5" /> STOP WORK AUTHORITY AKTIF</div>
          <p className="text-sm text-red-800"><strong>Dilaporkan oleh:</strong> {ptw.stoppedByName}</p>
          <p className="text-sm text-red-800"><strong>Alasan:</strong> {ptw.stoppedReason}</p>
          <p className="text-xs text-red-600 mt-1">{ptw.stoppedAt && new Date(ptw.stoppedAt).toLocaleString('id-ID')}</p>
          <p className="text-xs text-red-600 mt-2">Pekerjaan dihentikan. Hanya PM/HSSE yang dapat mengaktifkan kembali PTW ini dari dashboard internal.</p>
        </div>
      )}

      {isActiveStage && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-3"><ClipboardList className="w-4 h-4 text-primary" /> Toolbox Meeting Hari Ini</div>
            {meeting ? (
              <div className="text-sm">
                <p className="flex items-center gap-1.5 text-emerald-600 font-bold mb-2"><CheckCircle2 className="w-4 h-4" /> Sudah dicatat</p>
                <p className="text-slate-600"><strong>Topik:</strong> {meeting.topics}</p>
                <p className="text-slate-600"><strong>Pemimpin:</strong> {meeting.conducted_by_name}</p>
                <p className="text-slate-500 text-xs mt-1">{meeting.attendees?.length || 0} peserta hadir</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Belum ada toolbox meeting hari ini — catat dulu sebelum check-in pekerja.</p>
                <input value={conductedBy} onChange={e => setConductedBy(e.target.value)} placeholder="Nama pemimpin briefing" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <textarea value={topics} onChange={e => setTopics(e.target.value)} placeholder="Topik yang dibahas" rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <div className="space-y-2">
                  {attendeeNames.map((name, i) => (
                    <input key={i} value={name} onChange={e => setAttendeeNames(a => a.map((v, idx) => idx === i ? e.target.value : v))}
                      placeholder={`Nama peserta ${i + 1}`} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  ))}
                  <button onClick={() => setAttendeeNames(a => [...a, ''])} className="text-xs font-bold text-primary">+ Tambah peserta</button>
                </div>
                <button disabled={loading || !topics.trim() || !conductedBy.trim()} onClick={handleLogMeeting}
                  className="w-full bg-primary text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-40">
                  Catat Toolbox Meeting
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-bold text-slate-800"><Users className="w-4 h-4 text-primary" /> Check-in Pekerja</div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{openCheckins.length} di lokasi</span>
            </div>
            {!meeting ? (
              <p className="text-xs text-slate-400 italic">Terkunci sampai toolbox meeting hari ini dicatat.</p>
            ) : (
              <div className="space-y-3">
                {ptw.workers.length > 0 && (
                  <div className="space-y-2">
                    {ptw.workers.map((w, i) => {
                      const open = openCheckins.find(c => c.worker_name === w.worker_name);
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm border border-slate-100 rounded-xl px-3 py-2">
                          <span className="font-medium text-slate-700">{w.worker_name}</span>
                          {open ? (
                            <button disabled={loading} onClick={() => handleCheckOut(open.id)} className="flex items-center gap-1 text-xs font-bold text-red-600"><LogOut className="w-3.5 h-3.5" /> Check-out</button>
                          ) : (
                            <button disabled={loading} onClick={() => handleCheckIn(w.worker_name)} className="flex items-center gap-1 text-xs font-bold text-emerald-600"><LogIn className="w-3.5 h-3.5" /> Check-in</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Orang yang check-in di luar daftar pekerja PTW (lewat "Nama pekerja lain")
                    tetap harus muncul di sini supaya bisa di-check-out — sebelumnya cuma
                    daftar ptw.workers yang dapat tombol check-out, jadi orang ini "hilang". */}
                {(() => {
                  const rosterNames = new Set(ptw.workers.map(w => w.worker_name));
                  const walkIns = openCheckins.filter(c => !rosterNames.has(c.worker_name));
                  return walkIns.length > 0 ? (
                    <div className="space-y-2">
                      {walkIns.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-sm border border-amber-100 bg-amber-50 rounded-xl px-3 py-2">
                          <span className="font-medium text-slate-700">{c.worker_name} <span className="text-[10px] text-amber-600 font-bold uppercase ml-1">Di luar daftar PTW</span></span>
                          <button disabled={loading} onClick={() => handleCheckOut(c.id)} className="flex items-center gap-1 text-xs font-bold text-red-600"><LogOut className="w-3.5 h-3.5" /> Check-out</button>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div className="flex gap-2 pt-1">
                  <input value={manualWorkerName} onChange={e => setManualWorkerName(e.target.value)} placeholder="Nama pekerja lain"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  <button disabled={loading || !manualWorkerName.trim()} onClick={() => { handleCheckIn(manualWorkerName); setManualWorkerName(''); }}
                    className="bg-emerald-600 text-white text-xs font-bold px-3 rounded-xl disabled:opacity-40">Check-in</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {(isActiveStage) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
          <div className="max-w-lg mx-auto">
            {!showStopForm ? (
              <button onClick={() => setShowStopForm(true)} className="w-full bg-red-600 text-white font-black text-sm py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
                <Siren className="w-5 h-5" /> STOP WORK — HENTIKAN PEKERJAAN
              </button>
            ) : (
              <div className="bg-white border-2 border-red-300 rounded-2xl p-4 shadow-xl space-y-2">
                <div className="flex items-center gap-2 font-black text-red-700 text-sm"><ShieldAlert className="w-4 h-4" /> Konfirmasi Stop Work Authority</div>
                <input value={stopReporter} onChange={e => setStopReporter(e.target.value)} placeholder="Nama Anda" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <textarea value={stopReason} onChange={e => setStopReason(e.target.value)} placeholder="Alasan menghentikan pekerjaan" rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => setShowStopForm(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm font-bold text-slate-600">Batal</button>
                  <button disabled={loading || !stopReporter.trim() || !stopReason.trim()} onClick={handleStopWork}
                    className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-black disabled:opacity-40">Hentikan Sekarang</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

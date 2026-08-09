'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Users, Truck, Stamp, ShieldAlert, FileText, HardHat, FlaskConical, Plus, Trash2, CalendarClock, Flame, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';
import PtwPDF from '@/components/ptw/PtwPDF';
import { savePtw, getPtw, getPtwList, getProjectPeriod } from '../actions';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center animate-pulse text-slate-400 font-medium">Memuat Pratinjau Dokumen...</div> }
);
import {
  PTW_TYPES, APD_ITEMS, PtwType, PTW_GAS_TEST_TYPES, PtwGasTestEntry,
  HOT_WORK_JOB_TYPES, PTW_MAX_VALID_DAYS, PtwGasTestFrequency,
  hazardSourcesFor, APD_CATEGORY_LABELS,
} from '@/lib/ptw-types';
import { getWorkers, WorkerItem } from '@/app/vendor/dashboard/pekerja/actions';
import { getEquipment, EquipmentItem } from '@/app/vendor/dashboard/peralatan/actions';

export default function PTWCreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';
  const typeParam = typeof params.type === 'string' ? params.type : '';
  const typeDef = PTW_TYPES.find(t => t.id === typeParam);
  const ptwType = (typeDef?.id ?? 'dingin') as PtwType;

  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);

  // APD state (Grouped by part)
  const [selectedApd, setSelectedApd] = useState<{ [key: string]: string[] }>({
    kepala: [], telinga: [], kaki: [], ketinggian: [], pernapasan: [], tangan: [], badan: []
  });

  const [selectedPekerja, setSelectedPekerja] = useState<string[]>([]);
  const [selectedPeralatan, setSelectedPeralatan] = useState<string[]>([]);
  const [gasTests, setGasTests] = useState<PtwGasTestEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Masa berlaku izin — milik PTW sendiri, bukan durasi proyek.
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // Khusus tipe panas
  const [hotWorkTypes, setHotWorkTypes] = useState<string[]>([]);
  const [gasFreq, setGasFreq] = useState<PtwGasTestFrequency>({ o2: '', toxic: '', combustible: '' });

  const requiresGasTest = PTW_GAS_TEST_TYPES.includes(ptwType);
  const isHotWork = ptwType === 'panas';
  // Form Panas memakai satu butir bahaya yang berbeda dari tipe lain.
  const hazardSources = hazardSourcesFor(ptwType);

  // Kolom checklist harian di form hanya sampai "Hari ke-7".
  const durasiHari = (validFrom && validTo)
    ? Math.floor((new Date(validTo).getTime() - new Date(validFrom).getTime()) / 86_400_000) + 1
    : 0;
  const masaBerlakuError = !validFrom || !validTo
    ? 'Masa berlaku izin wajib diisi.'
    : durasiHari < 1
      ? 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'
      : durasiHari > PTW_MAX_VALID_DAYS
        ? `Masa berlaku maksimal ${PTW_MAX_VALID_DAYS} hari (terisi ${durasiHari} hari). Form PTW hanya menyediakan kolom checklist sampai Hari ke-${PTW_MAX_VALID_DAYS}.`
        : null;

  const [rosterPekerja, setRosterPekerja] = useState<WorkerItem[]>([]);
  const [rosterPeralatan, setRosterPeralatan] = useState<EquipmentItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);

  React.useEffect(() => {
    if (!typeDef) {
      router.replace(`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}`);
      return;
    }

    async function loadData() {
      const [workers, equipment, data, siblings, periode] = await Promise.all([
        getWorkers(),
        getEquipment(),
        projectId ? getPtw(projectId, ptwType) : Promise.resolve(null),
        projectId ? getPtwList(projectId) : Promise.resolve([]),
        projectId ? getProjectPeriod(projectId) : Promise.resolve(null),
      ]);
      setRosterPekerja(workers);
      setRosterPeralatan(equipment);
      setIsLoadingRoster(false);

      if (data) {
        // Merevisi PTW tipe ini yang sudah pernah diajukan.
        if (data.workers) setSelectedPekerja(data.workers.map((w: any) => w.id).filter(Boolean));
        if (data.equipment) setSelectedPeralatan(data.equipment.map((e: any) => e.id).filter(Boolean));
        if (data.hazards) setSelectedHazards(data.hazards);
        if (data.apd) setSelectedApd(data.apd);
        if (data.gas_tests) setGasTests(data.gas_tests);
        if (data.hot_work_types) setHotWorkTypes(data.hot_work_types);
        if (data.gas_test_frequency) setGasFreq(data.gas_test_frequency);
        if (data.valid_from) setValidFrom(data.valid_from);
        if (data.valid_to) setValidTo(data.valid_to);
        if (data.work_start) setWorkStart(data.work_start);
        if (data.work_end) setWorkEnd(data.work_end);
      } else if (siblings.length > 0) {
        // Belum pernah diajukan untuk tipe ini — bantu isi awal dari tipe PTW
        // lain di proyek yang sama (kemungkinan besar tim/alat & jadwalnya
        // sama), tapi tetap bisa diubah oleh vendor.
        const mostRecent = [...siblings].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0] as any;
        if (mostRecent?.workers) setSelectedPekerja(mostRecent.workers.map((w: any) => w.id).filter(Boolean));
        if (mostRecent?.equipment) setSelectedPeralatan(mostRecent.equipment.map((e: any) => e.id).filter(Boolean));
        if (mostRecent?.valid_from) setValidFrom(mostRecent.valid_from);
        if (mostRecent?.valid_to) setValidTo(mostRecent.valid_to);
        if (mostRecent?.work_start) setWorkStart(mostRecent.work_start);
        if (mostRecent?.work_end) setWorkEnd(mostRecent.work_end);
      }

      // Belum ada acuan sama sekali — mulai dari tanggal proyek, dipotong
      // ke batas 7 hari supaya vendor tidak langsung kena error.
      if (!data && siblings.length === 0 && periode?.start_date) {
        const mulai = new Date(periode.start_date);
        const selesaiProyek = periode.end_date ? new Date(periode.end_date) : mulai;
        const batas = new Date(mulai.getTime() + (PTW_MAX_VALID_DAYS - 1) * 86_400_000);
        const selesai = selesaiProyek < batas ? selesaiProyek : batas;
        setValidFrom(mulai.toISOString().slice(0, 10));
        setValidTo(selesai.toISOString().slice(0, 10));
      }
    }
    loadData();
  }, [projectId, ptwType, typeDef, router]);

  const toggleHazard = (hz: string) => {
    setSelectedHazards(prev =>
      prev.includes(hz) ? prev.filter(x => x !== hz) : [...prev, hz]
    );
  };

  const toggleApd = (category: string, item: string) => {
    setSelectedApd(prev => {
      const catList = prev[category] || [];
      const updated = catList.includes(item) ? catList.filter(x => x !== item) : [...catList, item];
      return { ...prev, [category]: updated };
    });
  };

  const togglePekerja = (id: string) => {
    setSelectedPekerja(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const togglePeralatan = (id: string) => {
    setSelectedPeralatan(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const addGasTestRow = () => {
    setGasTests(prev => [...prev, {
      tanggal: '', waktu: '', o2Hasil: '', o2Sesuai: true,
      toxicHasil: '', toxicSesuai: true, combustibleHasil: '', combustibleSesuai: true,
      keterangan: '', namaPelaksana: ''
    }]);
  };

  const updateGasTestRow = (index: number, field: keyof PtwGasTestEntry, value: string | boolean) => {
    setGasTests(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const removeGasTestRow = (index: number) => {
    setGasTests(prev => prev.filter((_, i) => i !== index));
  };

  const selectedPekerjaData = rosterPekerja
    .filter(p => selectedPekerja.includes(p.id))
    .map(p => ({ id: p.id, worker_name: p.full_name, worker_role: p.position, certification: p.certification }));
  const selectedPeralatanData = rosterPeralatan
    .filter(p => selectedPeralatan.includes(p.id))
    .map(p => ({ id: p.id, name: p.name, type: p.category, certificate_number: p.certificate_number }));

  const toggleHotWorkType = (item: string) => {
    setHotWorkTypes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const handleAjukan = async () => {
    if (masaBerlakuError) {
      alert(masaBerlakuError);
      return;
    }
    setIsSubmitting(true);
    try {
      await savePtw(projectId, selectedPekerjaData, selectedPeralatanData, ptwType, selectedHazards, selectedApd, requiresGasTest ? gasTests : [], {
        validFrom,
        validTo,
        workStart,
        workEnd,
        hotWorkTypes: isHotWork ? hotWorkTypes : [],
        gasTestFrequency: isHotWork ? gasFreq : {},
      });
      alert("PTW berhasil diajukan dan sedang menunggu validasi Project Manager!");
      router.push(`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Terjadi kesalahan saat mengajukan PTW.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!typeDef) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Nav */}
      <div>
        <Link href={`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar PTW
        </Link>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Stamp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{typeDef.title.split('(')[0].trim()}</h1>
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">Project ID: {projectId}</div>
            </div>
          </div>
          <button onClick={handleAjukan} disabled={isSubmitting || !!masaBerlakuError || (selectedPekerja.length === 0 && selectedPeralatan.length === 0)} className="px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-600/30 flex items-center gap-2">
            {isSubmitting ? (
              <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengajukan...</span>
            ) : (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Ajukan PTW</span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left Column: Form Settings */}
        <div className="space-y-6">

          {/* Masa Berlaku Izin */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><CalendarClock className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Masa Berlaku Izin</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Masa berlaku PTW terpisah dari durasi proyek dan maksimal {PTW_MAX_VALID_DAYS} hari,
              mengikuti kolom checklist harian pada form.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Mulai</label>
                <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Selesai</label>
                <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jam Mulai</label>
                <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jam Selesai</label>
                <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              </div>
            </div>

            {masaBerlakuError ? (
              <div className="mt-3 flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <span>{masaBerlakuError}</span>
              </div>
            ) : (
              <p className="mt-3 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                Izin berlaku {durasiHari} hari ({workStart} – {workEnd}).
              </p>
            )}
          </div>

          {/* Jenis Pekerjaan Panas — khusus Ijin Kerja Panas */}
          {isHotWork && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Flame className="w-5 h-5" /></div>
                <h2 className="text-lg font-bold text-slate-800">Jenis Pekerjaan Panas</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">Pilih jenis pekerjaan panas yang akan dilakukan.</p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {HOT_WORK_JOB_TYPES.map(item => (
                  <label key={item} className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-colors text-xs font-semibold ${hotWorkTypes.includes(item) ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={hotWorkTypes.includes(item)} onChange={() => toggleHotWorkType(item)} className="rounded-sm" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>

              <div className="mb-2">
                <span className="text-sm font-bold text-slate-700">Frekuensi Pengujian Kandungan Gas</span>
                <p className="text-xs text-slate-500 mt-0.5">Contoh pengisian: &quot;4 jam&quot; atau &quot;2x sehari&quot;.</p>
              </div>
              <div className="space-y-2">
                {([
                  ['o2', 'O2'],
                  ['toxic', 'Toxic'],
                  ['combustible', 'Combustible'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-24 text-xs font-bold text-slate-600 shrink-0">{label}</span>
                    <span className="text-xs text-slate-400 shrink-0">dilakukan setiap</span>
                    <input
                      type="text"
                      value={gasFreq[key] || ''}
                      onChange={e => setGasFreq(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      placeholder="…"
                    />
                    <span className="text-xs text-slate-400 shrink-0">Jam/hari</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hazard & APD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Identifikasi Bahaya & APD</h2>
            </div>

            <div className="mb-2">
              <span className="text-sm font-bold text-slate-700">Sumber Bahaya (Pilih yang relevan)</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-6 max-h-40 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50">
              {hazardSources.map((hz, i) => (
                <label key={i} className="flex items-center gap-2 text-xs bg-white border border-slate-200 px-2 py-1 rounded shadow-sm cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={selectedHazards.includes(hz)} onChange={() => toggleHazard(hz)} className="rounded-sm" />
                  <span>{hz}</span>
                </label>
              ))}
            </div>

            <div className="mb-2 flex items-center gap-2 mt-6">
              <HardHat className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-700">Alat Pelindung Diri (APD)</span>
            </div>
            <div className="grid grid-cols-2 gap-4 border border-slate-100 rounded-xl bg-slate-50 p-4 max-h-60 overflow-y-auto">
              {Object.entries(APD_ITEMS).map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{APD_CATEGORY_LABELS[cat] || cat}</div>
                  {items.map(item => (
                    <label key={item} className="flex items-center gap-2 text-xs">
                       <input type="checkbox" checked={selectedApd[cat]?.includes(item)} onChange={() => toggleApd(cat, item)} className="rounded-sm" />
                       <span>{item}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Formulir Uji Kandungan Gas */}
          {requiresGasTest && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><FlaskConical className="w-5 h-5" /></div>
                <h2 className="text-lg font-bold text-slate-800">Formulir Uji Kandungan Gas</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Wajib diisi untuk tipe PTW ini. Standard: O2 19.5%–22%, Toxic ≤ PEL, Combustible &lt; 10% LEL.
              </p>

              <div className="space-y-3">
                {gasTests.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
                    Belum ada data uji gas. Klik &quot;Tambah Hasil Uji&quot; untuk mencatat.
                  </p>
                ) : (
                  gasTests.map((row, i) => (
                    <div key={i} className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Pengujian #{i + 1}</span>
                        <button type="button" onClick={() => removeGasTestRow(i)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={row.tanggal} onChange={e => updateGasTestRow(i, 'tanggal', e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                        <input type="time" value={row.waktu} onChange={e => updateGasTestRow(i, 'waktu', e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['o2', 'toxic', 'combustible'] as const).map(gas => (
                          <div key={gas} className="space-y-1">
                            <input
                              type="text"
                              placeholder={gas === 'o2' ? 'O2 (%)' : gas === 'toxic' ? 'Toxic' : 'Combustible (%LEL)'}
                              value={row[`${gas}Hasil` as const]}
                              onChange={e => updateGasTestRow(i, `${gas}Hasil` as keyof PtwGasTestEntry, e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                            />
                            <label className="flex items-center gap-1 text-[11px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={row[`${gas}Sesuai` as const]}
                                onChange={e => updateGasTestRow(i, `${gas}Sesuai` as keyof PtwGasTestEntry, e.target.checked)}
                                className="rounded-sm"
                              />
                              Sesuai standard
                            </label>
                          </div>
                        ))}
                      </div>
                      <input type="text" placeholder="Nama Pelaksana" value={row.namaPelaksana} onChange={e => updateGasTestRow(i, 'namaPelaksana', e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      <input type="text" placeholder="Keterangan (opsional)" value={row.keterangan} onChange={e => updateGasTestRow(i, 'keterangan', e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                    </div>
                  ))
                )}
              </div>

              <button type="button" onClick={addGasTestRow} className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl py-2 transition-colors">
                <Plus className="w-4 h-4" /> Tambah Hasil Uji
              </button>
            </div>
          )}

          {/* Pekerja Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Pilih Pekerja Bertugas</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih pekerja dari Data Master Pekerja yang akan ditugaskan di proyek ini.</p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {isLoadingRoster ? (
                <p className="text-sm text-slate-400 text-center py-4">Memuat data pekerja...</p>
              ) : rosterPekerja.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-2">Belum ada data pekerja tersimpan.</p>
                  <Link href="/vendor/dashboard/pekerja" className="text-sm font-bold text-primary hover:underline">Tambah Data Pekerja &rarr;</Link>
                </div>
              ) : (
                rosterPekerja.map((p) => (
                  <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPekerja.includes(p.id) ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={selectedPekerja.includes(p.id)}
                      onChange={() => togglePekerja(p.id)}
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">{p.full_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.position} • Sertifikat: {p.certification || 'Tidak Ada'}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Peralatan Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Truck className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Pilih Peralatan / Mesin</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih alat dari Data Master Peralatan yang akan dibawa ke lapangan.</p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {isLoadingRoster ? (
                <p className="text-sm text-slate-400 text-center py-4">Memuat data peralatan...</p>
              ) : rosterPeralatan.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-2">Belum ada data peralatan tersimpan.</p>
                  <Link href="/vendor/dashboard/peralatan" className="text-sm font-bold text-primary hover:underline">Tambah Data Peralatan &rarr;</Link>
                </div>
              ) : (
                rosterPeralatan.map((p) => (
                  <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPeralatan.includes(p.id) ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      checked={selectedPeralatan.includes(p.id)}
                      onChange={() => togglePeralatan(p.id)}
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.category} • SILO: {p.certificate_number || '—'}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: PDF Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px] sticky top-24">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
               <Stamp className="w-4 h-4 text-slate-400" /> Preview Draft PTW (Otomatis)
             </div>
          </div>
          <div className="flex-1 w-full bg-slate-500">
             <PDFViewer width="100%" height="100%" className="border-none">
               <PtwPDF
                 projectId={projectId}
                 ptwType={ptwType}
                 hazards={selectedHazards}
                 apd={selectedApd}
                 pekerja={selectedPekerjaData}
                 peralatan={selectedPeralatanData}
                 gasTests={requiresGasTest ? gasTests : []}
                 validFrom={validFrom}
                 validTo={validTo}
                 workStart={workStart}
                 workEnd={workEnd}
                 hotWorkTypes={hotWorkTypes}
                 gasTestFrequency={gasFreq}
               />
             </PDFViewer>
          </div>
        </div>

      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Plus, Trash2, Loader2, ImageOff } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { editProsedurAsReviewer } from '@/app/dashboard/approval/prosedur-edit-actions';
import { getProjectRoster } from '@/app/dashboard/approval/doc-edit-actions';
import { KebutuhanEditor, type ProjectRoster } from '@/components/prosedur/KebutuhanEditor';
import { normalizeTahapanPekerjaan, emptyKebutuhan, deriveDocumentSections, type TahapanSection } from '@/lib/procedure-kebutuhan';

const field = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary';
const lbl = 'text-xs font-bold text-slate-600 block mb-1.5';

/**
 * Reviewer (PGSOL/PGN) mengubah isi Prosedur langsung, tanpa harus menolak.
 * Status tidak berubah; server mencatat diff-nya ke riwayat perubahan dokumen.
 * Kebutuhan per langkah (pekerja/alat/material/APD/bahaya) ikut bisa diubah,
 * dipilih dari master data vendor proyek.
 */
export function ProsedurReviewerEditor({ procedureId, projectId, content, label = 'Ubah Dokumen' }: {
  procedureId: string;
  projectId: string;
  content: any;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [docNo, setDocNo] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [umum, setUmum] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [tahapan, setTahapan] = useState<TahapanSection[]>([]);
  const [penyelesaian, setPenyelesaian] = useState('');
  const [note, setNote] = useState('');
  const [roster, setRoster] = useState<ProjectRoster | null>(null);

  const openEditor = () => {
    const c = content || {};
    setDocNo(c.docNo || '');
    setSubmissionDate(c.submissionDate || '');
    setUmum(c.umum || '');
    setScopeOfWork(c.scopeOfWork || '');
    setTahapan(normalizeTahapanPekerjaan(c.tahapanPekerjaan));
    setPenyelesaian((c.penyelesaianAkhir || []).join('\n'));
    setNote('');
    setError(null);
    setOpen(true);
    getProjectRoster(projectId).then(setRoster).catch(() => setRoster(null));
  };

  const mapSection = (i: number, fn: (s: TahapanSection) => TahapanSection) =>
    setTahapan((prev) => prev.map((s, idx) => (idx === i ? fn(s) : s)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const derived = deriveDocumentSections(tahapan);
      const res = await editProsedurAsReviewer(procedureId, {
        docNo, submissionDate, umum, scopeOfWork,
        tools: derived.tools, selectedApd: derived.apd, perlengkapanLainnya: derived.perlengkapanLainnya,
        tahapanPekerjaan: tahapan.map((s) => ({ ...s, points: s.points.filter((p) => p.text.trim()) })),
        penyelesaianAkhir: penyelesaian.split('\n').map((l) => l.trim()).filter(Boolean),
      }, note);
      setOpen(false);
      if (res.changed === 0) alert('Tidak ada perubahan untuk disimpan.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
      >
        <Pencil className="w-4 h-4" /> {label}
      </button>

      {open && (
        <ModalPortal onClose={() => setOpen(false)} blocking={saving} zIndex={110}>
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-black/5">
            <div className="h-1.5 bg-gradient-to-r from-sky-500 to-sky-400 shrink-0" />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Ubah Prosedur Kerja</h3>
                <p className="text-xs text-slate-500">Perubahan langsung tercatat (siapa, kapan, apa yang berubah) dan terlihat oleh semua pihak yang ditugaskan.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={lbl}>Nomor Dokumen</label><input className={field} value={docNo} onChange={(e) => setDocNo(e.target.value)} /></div>
                <div><label className={lbl}>Tanggal Pengajuan</label><input type="date" className={field} value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} /></div>
              </div>
              <div><label className={lbl}>1. Umum</label><textarea rows={4} className={`${field} resize-y`} value={umum} onChange={(e) => setUmum(e.target.value)} /></div>
              <div><label className={lbl}>2. Ruang Lingkup (satu butir per baris)</label><textarea rows={6} className={`${field} resize-y`} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} /></div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`${lbl} mb-0`}>6. Tahapan Pekerjaan</label>
                  <button type="button" onClick={() => setTahapan((p) => [...p, { title: 'Pekerjaan Baru', points: [] }])} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tahapan</button>
                </div>
                {tahapan.map((sec, si) => (
                  <div key={si} className="border border-slate-200 rounded-2xl p-3.5 space-y-2.5 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-400">6.{si + 1}</span>
                      <input className={field} value={sec.title} onChange={(e) => mapSection(si, (s) => ({ ...s, title: e.target.value }))} />
                      <button type="button" title="Hapus tahapan" onClick={() => setTahapan((p) => p.filter((_, i) => i !== si))} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {sec.points.map((pt, pi) => (
                      <div key={pi} className="pl-6 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <textarea rows={2} className={`${field} resize-y`} value={pt.text}
                            onChange={(e) => mapSection(si, (s) => ({ ...s, points: s.points.map((p, i) => (i === pi ? { ...p, text: e.target.value } : p)) }))} />
                          <button type="button" title="Hapus langkah" onClick={() => mapSection(si, (s) => ({ ...s, points: s.points.filter((_, i) => i !== pi) }))} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <KebutuhanEditor roster={roster} value={pt.kebutuhan}
                          onChange={(k) => mapSection(si, (s) => ({ ...s, points: s.points.map((p, i) => (i === pi ? { ...p, kebutuhan: k } : p)) }))} />
                        {pt.imageUrl && (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pt.imageUrl} alt="" className="h-14 rounded-lg border border-slate-200 object-contain bg-white" />
                            <button type="button" onClick={() => mapSection(si, (s) => ({ ...s, points: s.points.map((p, i) => { if (i !== pi) return p; const { imageUrl: _x, ...rest } = p; return rest; }) }))} className="text-[11px] font-bold text-rose-600 flex items-center gap-1"><ImageOff className="w-3.5 h-3.5" /> Hapus gambar</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => mapSection(si, (s) => ({ ...s, points: [...s.points, { text: '', kebutuhan: emptyKebutuhan() }] }))} className="ml-6 text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Langkah</button>
                  </div>
                ))}
              </div>

              <div><label className={lbl}>7. Pekerjaan Penyelesaian Akhir (satu butir per baris)</label><textarea rows={5} className={`${field} resize-y`} value={penyelesaian} onChange={(e) => setPenyelesaian(e.target.value)} /></div>
              <div><label className={lbl}>Catatan perubahan (opsional)</label><input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Koreksi nomor dokumen dan urutan langkah" /></div>

              {error && <p className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">Batal</button>
              <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Perubahan
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

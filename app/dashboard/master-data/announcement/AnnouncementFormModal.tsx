'use client';

import { ModalPortal } from '@/components/ui/modal-portal';
import React, { useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Megaphone, UploadCloud, Bold, Heading2, List, ListOrdered, Quote, Link2, Paperclip, Trash2, Eye, Pencil } from 'lucide-react';
import { uploadImage } from '@/utils/supabase/storage';
import { addAnnouncement, updateAnnouncement, type Announcement } from './actions';
import { AUDIENCE_OPTIONS, NEWS_CATEGORIES, type NewsAttachment } from '@/lib/news';
import { NewsContent } from '@/components/news/NewsContent';

/** ISO → nilai <input type="datetime-local"> di zona waktu browser. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm';

export default function AnnouncementFormModal({
  isOpen,
  onClose,
  onSuccess,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editing?: Announcement | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [content, setContent] = useState(editing?.content ?? '');
  const [preview, setPreview] = useState(false);
  const [attachments, setAttachments] = useState<NewsAttachment[]>(editing?.attachments ?? []);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  /** Sisipkan markup di sekitar teks terpilih (atau di awal baris untuk blok). */
  function applyMarkup(kind: 'bold' | 'h2' | 'ul' | 'ol' | 'quote' | 'link') {
    const el = contentRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e);
    let next = value;
    let caret = e;
    if (kind === 'bold') {
      const inner = sel || 'teks tebal';
      next = value.slice(0, s) + `**${inner}**` + value.slice(e);
      caret = s + inner.length + 4;
    } else if (kind === 'link') {
      const url = window.prompt('Alamat tautan (https://...)', 'https://');
      if (!url) return;
      const label = sel || 'teks tautan';
      next = value.slice(0, s) + `[${label}](${url})` + value.slice(e);
      caret = s + label.length + url.length + 4;
    } else {
      const prefix = kind === 'h2' ? '## ' : kind === 'ul' ? '- ' : kind === 'ol' ? '1. ' : '> ';
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      caret = e + prefix.length;
    }
    setContent(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  }

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingAtt(true);
    setError('');
    try {
      const added: NewsAttachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { setError(`"${f.name}" lebih dari 10 MB.`); continue; }
        const url = await uploadImage(f, 'announcements/files');
        if (url) added.push({ name: f.name, url });
        else setError(`Gagal mengunggah "${f.name}".`);
      }
      setAttachments((a) => [...a, ...added]);
    } finally {
      setUploadingAtt(false);
      if (attInputRef.current) attInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    formData.set('content', content);
    formData.set('attachments', JSON.stringify(attachments));

    try {
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, 'announcements');
        if (!imageUrl) {
          setError('Gagal mengunggah gambar.');
          setLoading(false);
          return;
        }
        formData.set('image_url', imageUrl);
      } else if (editing) {
        formData.set('image_url', editing.image_url);
      }

      if (!formData.get('image_url')) {
        setError('Gambar wajib diunggah.');
        setLoading(false);
        return;
      }

      const result = editing
        ? await updateAnnouncement(editing.id, formData)
        : await addAnnouncement(formData);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setLoading(false);
        setImageFile(null);
        if (onSuccess) onSuccess();
        else onClose();
      }
    } catch {
      setError('Gagal menyimpan pengumuman.');
      setLoading(false);
    }
  }

  const audience = editing?.audience ?? AUDIENCE_OPTIONS.map((a) => a.value);

  return (
    <ModalPortal zIndex={100}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors p-1 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <form id="announcement-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gambar Sampul <span className="text-rose-500">*</span></label>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                {imageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                ) : editing?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Klik untuk upload gambar</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Judul <span className="text-rose-500">*</span></label>
                <input type="text" name="title" required defaultValue={editing?.title} className={INPUT} placeholder="Contoh: Sosialisasi K3 Bulan November" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori</label>
                <select name="category" defaultValue={editing?.category ?? 'Info'} className={INPUT}>
                  {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Ringkasan</label>
              <textarea name="description" rows={2} defaultValue={editing?.description || ''} className={`${INPUT} resize-none`} placeholder="Satu-dua kalimat yang tampil di carousel dan daftar berita..." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-slate-700">Isi Berita</label>
                <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                  {preview ? <><Pencil className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Pratinjau</>}
                </button>
              </div>
              {!preview && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {([
                    ['bold', Bold, 'Tebal'], ['h2', Heading2, 'Judul bagian'], ['ul', List, 'Daftar butir'],
                    ['ol', ListOrdered, 'Daftar angka'], ['quote', Quote, 'Kutipan'], ['link', Link2, 'Tautan'],
                  ] as const).map(([k, Icon, label]) => (
                    <button key={k} type="button" title={label} onClick={() => applyMarkup(k)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors">
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}
              {preview ? (
                <div className="min-h-[10rem] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                  {content.trim() ? <NewsContent content={content} /> : <p className="text-sm text-slate-400">Belum ada isi.</p>}
                </div>
              ) : (
                <textarea ref={contentRef} value={content} onChange={(e) => setContent(e.target.value)} rows={8} className={`${INPUT} font-mono text-[13px]`} placeholder={'## Judul bagian\nParagraf biasa dengan **teks tebal**.\n\n- Butir pertama\n- Butir kedua'} />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Lampiran</label>
              <input type="file" ref={attInputRef} multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={(e) => handleAttach(e.target.files)} />
              <div className="space-y-1.5">
                {attachments.map((a, i) => (
                  <div key={a.url} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                    <span className="flex items-center gap-2 min-w-0"><Paperclip className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{a.name}</span></span>
                    <button type="button" onClick={() => setAttachments((l) => l.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => attInputRef.current?.click()} disabled={uploadingAtt} className="text-xs font-bold text-primary flex items-center gap-1.5 hover:underline disabled:opacity-50">
                  {uploadingAtt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />} Tambah lampiran (maks. 10 MB per berkas)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Target Audiens</label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_OPTIONS.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary/40">
                    <input type="checkbox" name="audience" value={a.value} defaultChecked={audience.includes(a.value)} className="accent-primary" />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Jadwal Terbit</label>
                <input type="datetime-local" name="publish_at" defaultValue={toLocalInput(editing?.publish_at)} className={INPUT} />
                <p className="text-[11px] text-slate-500 mt-1">Kosongkan untuk tayang sekarang.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kedaluwarsa</label>
                <input type="datetime-local" name="expires_at" defaultValue={toLocalInput(editing?.expires_at)} className={INPUT} />
                <p className="text-[11px] text-slate-500 mt-1">Kosongkan jika tidak ada batas waktu.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Urutan Tampil</label>
                <input type="number" name="display_order" defaultValue={editing?.display_order ?? 0} className={INPUT} />
              </div>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300">
                <input type="checkbox" name="is_pinned" defaultChecked={editing?.is_pinned} className="accent-primary" /> Sematkan di atas
              </label>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer has-[:checked]:bg-rose-50 has-[:checked]:border-rose-300">
                <input type="checkbox" name="is_mandatory" defaultChecked={editing?.is_mandatory} className="accent-primary" /> Wajib dibaca
              </label>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors">
            Batal
          </button>
          <button
            form="announcement-form"
            type="submit"
            disabled={loading || uploadingAtt}
            className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-xl transition-all shadow-sm shadow-primary/30 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { DataTable, DataHead, ROW_CLS, CELL_CLS } from '@/components/ui/data-table';
import { getAnnouncementsForManagement, deleteAnnouncement, toggleAnnouncementActive, type Announcement } from './actions';
import AnnouncementFormModal from './AnnouncementFormModal';

export default function AnnouncementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await getAnnouncementsForManagement();
    setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengumuman "${title}"? Aksi ini tidak dapat dibatalkan.`)) return;
    setIsDeleting(id);
    const res = await deleteAnnouncement(id);
    setIsDeleting(null);
    if (res.error) {
      alert(res.error);
    } else {
      fetchData();
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementActive(id, !current);
    if (res.error) {
      alert(res.error);
    } else {
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> News & Pengumuman
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola konten carousel pengumuman di halaman utama dashboard.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setIsFormOpen(true); }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengumuman
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Megaphone className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">Belum ada pengumuman.</p>
        </div>
      ) : (
        <DataTable minWidth={760}>
          <DataHead columns={[
            { label: 'Gambar', className: 'w-28' }, { label: 'Pengumuman' }, { label: 'Status' }, { label: 'Aksi', className: 'text-right' },
          ]} />
          <tbody className="divide-y divide-slate-100">
            {announcements.map((item) => (
              <tr key={item.id} className={ROW_CLS}>
                <td className={CELL_CLS}>
                  <div className="w-24 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                </td>
                <td className={`${CELL_CLS} max-w-md`}>
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  {item.description && <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>}
                </td>
                <td className={CELL_CLS}>
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md border ${item.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className={`${CELL_CLS} text-right`}>
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => handleToggle(item.id, item.is_active)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { setEditing(item); setIsFormOpen(true); }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={isDeleting === item.id}
                      onClick={() => handleDelete(item.id, item.title)}
                      className={`p-2 rounded-lg transition-colors ${isDeleting === item.id ? 'text-slate-300' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <AnnouncementFormModal
        isOpen={isFormOpen}
        editing={editing}
        onClose={() => { setIsFormOpen(false); setEditing(null); }}
        onSuccess={() => { setIsFormOpen(false); setEditing(null); fetchData(); }}
      />
    </div>
  );
}

/**
 * Penyimpanan riwayat perubahan dokumen JSA/PTW (tabel document_changes, lihat
 * supabase/schema_document_changes.sql). Modul biasa — bukan "use server" —
 * karena dipakai bersama oleh banyak file action/page.
 */
import type { ChangeLogEntry, FieldChange } from '@/lib/prosedur-diff';

export type ChangeDocType = 'procedure' | 'jsa' | 'ptw';

/** Simpan satu entri; melempar error kalau gagal (mis. migrasi belum dijalankan) supaya perubahan tak pernah lolos tanpa jejak. */
export async function recordDocumentChange(supabase: any, p: {
  docType: ChangeDocType; docId: string; projectId: string;
  actorId: string; actorName: string; actorLabel: string;
  summary: string; note?: string | null; changes: FieldChange[];
}) {
  const { error } = await supabase.from('document_changes').insert({
    project_id: p.projectId, doc_type: p.docType, doc_id: p.docId,
    actor_id: p.actorId, actor_name: p.actorName, actor_label: p.actorLabel,
    summary: p.summary, note: p.note ?? null, changes: p.changes,
  });
  if (error) {
    throw new Error(`Gagal mencatat riwayat perubahan (${error.message}). Pastikan migrasi supabase/schema_document_changes.sql sudah dijalankan.`);
  }
}

/** Riwayat perubahan sebuah proyek (semua tipe dokumen), baru → lama. Aman kalau tabel belum ada (return []). */
export async function loadProjectDocumentChanges(supabase: any, projectId: string): Promise<(ChangeLogEntry & { docType: ChangeDocType; docId: string })[]> {
  const { data, error } = await supabase
    .from('document_changes')
    .select('id, doc_type, doc_id, actor_id, actor_name, actor_label, summary, note, changes, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('loadProjectDocumentChanges error:', error.message);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id, at: r.created_at, actorId: r.actor_id, actorName: r.actor_name || 'Reviewer',
    actorLabel: r.actor_label || '', summary: r.summary, note: r.note, changes: r.changes || [],
    docType: r.doc_type, docId: r.doc_id,
  }));
}

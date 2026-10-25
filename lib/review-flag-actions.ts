'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { clearReviewFlag } from '@/lib/doc-sync';

const TABLE = { procedure: 'procedures', jsa: 'jsa', ptw: 'ptw' } as const;

/**
 * "Tandai sudah ditinjau" — menghapus penanda perlu-review-ulang tanpa mengubah
 * status approval. Hanya untuk yang bisa melihat dokumennya (dicek lewat RLS
 * client biasa); penghapusannya sendiri memakai admin client.
 */
export async function dismissReviewFlag(kind: 'procedure' | 'jsa' | 'ptw', docId: string) {
  if (!(kind in TABLE)) throw new Error('Jenis dokumen tidak dikenal.');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: doc } = await supabase.from(TABLE[kind]).select('id, project_id').eq('id', docId).maybeSingle();
  if (!doc) throw new Error('Dokumen tidak ditemukan atau Anda tidak punya akses.');

  await clearReviewFlag(kind, docId);
  revalidatePath(`/dashboard/projects/${doc.project_id}`);
  revalidatePath(`/vendor/dashboard/projects/${doc.project_id}`);
}

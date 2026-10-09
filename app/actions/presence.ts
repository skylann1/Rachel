'use server';

import { createClient } from '@/utils/supabase/server';
import { touchPresence } from '@/lib/presence';

/** Dipanggil heartbeat client; user diambil dari sesi, bukan dari argumen. */
export async function touchPresenceAction(path: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await touchPresence(supabase, user.id, path);
}

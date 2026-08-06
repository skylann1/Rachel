"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import type { NotificationItem } from "@/app/dashboard/inbox/actions";

/**
 * Subscribes to live INSERTs on the notifications table for one user.
 * RLS already scopes rows to auth.uid() = user_id; the channel filter
 * just avoids receiving payloads for other users' rows over the wire.
 *
 * Channel names include a random per-instance suffix because more than
 * one consumer (e.g. the header bell and the inbox page) can be mounted
 * for the same user at once — Supabase's realtime client throws if a
 * second `.on()` is attached to a topic that's already subscribed.
 */
export function useNotificationsRealtime(userId: string | undefined, onInsert: (item: NotificationItem) => void) {
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications-${userId}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onInsertRef.current(payload.new as NotificationItem)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

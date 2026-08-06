import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { getNotifications, getNotificationPreferences } from '@/app/dashboard/inbox/actions';
import InboxClient from '@/app/dashboard/inbox/InboxClient';

export default async function VendorInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const notifications = await getNotifications();
  const mutedTypes = await getNotificationPreferences();

  return <InboxClient notifications={notifications} userId={user?.id} initialMutedTypes={mutedTypes} />;
}

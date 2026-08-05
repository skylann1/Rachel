import React from 'react';
import { getNotifications } from './actions';
import InboxClient from './InboxClient';

export default async function InboxPage() {
  const notifications = await getNotifications();
  return <InboxClient notifications={notifications} />;
}

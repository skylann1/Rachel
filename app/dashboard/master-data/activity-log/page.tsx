import { getOnlineUsers, getActivityFeed, getSecurityAlerts } from './actions';
import ActivityLogClient from './ActivityLogClient';

export default async function ActivityLogPage() {
  const [onlineUsers, feed, alerts] = await Promise.all([
    getOnlineUsers(),
    getActivityFeed({}, { limit: 50 }),
    getSecurityAlerts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau siapa yang sedang online, apa yang mereka kerjakan, dan apa saja yang berubah di sistem.</p>
      </div>
      <ActivityLogClient initialOnlineUsers={onlineUsers} initialFeed={feed} initialAlerts={alerts} />
    </div>
  );
}

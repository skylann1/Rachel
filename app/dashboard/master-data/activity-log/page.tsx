import { getOnlineUsers, getActivityFeed } from './actions';
import ActivityLogClient from './ActivityLogClient';

export default async function ActivityLogPage() {
  const [onlineUsers, feed] = await Promise.all([
    getOnlineUsers(),
    getActivityFeed({ limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau siapa yang sedang online dan apa saja yang terjadi di sistem.</p>
      </div>
      <ActivityLogClient initialOnlineUsers={onlineUsers} initialFeed={feed} />
    </div>
  );
}

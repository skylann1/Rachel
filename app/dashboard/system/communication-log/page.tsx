import { getCommunicationLog } from './actions';
import CommunicationLogClient from './CommunicationLogClient';

export default async function CommunicationLogPage() {
  const data = await getCommunicationLog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Log Email & Notifikasi</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Periksa apakah email terkirim dan notifikasi sampai ke penerimanya — berguna saat ada laporan
          &ldquo;saya tidak dapat pemberitahuan&rdquo;.
        </p>
      </div>
      <CommunicationLogClient data={data} />
    </div>
  );
}

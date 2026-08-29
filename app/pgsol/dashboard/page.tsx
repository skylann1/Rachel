import { createClient } from "@/utils/supabase/server";

export default async function PgsolDashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Selamat datang, {profile?.full_name || 'Reviewer PGSOL'}</h1>
        <p className="text-sm text-slate-500 mt-1">Gunakan menu Review JSA untuk melihat dokumen yang menunggu tindak lanjut Anda.</p>
      </div>
    </div>
  );
}

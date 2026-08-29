import { createClient } from "@/utils/supabase/server";
import { getRoleLabel } from "@/lib/roles";

export default async function PgsolProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, internal_profiles(nip)')
    .eq('id', user?.id)
    .single();

  const nip = Array.isArray(profile?.internal_profiles) ? profile?.internal_profiles[0]?.nip : (profile?.internal_profiles as any)?.nip;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Profil Saya</h1>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</p>
          <p className="text-sm text-slate-800 mt-1">{profile?.full_name}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</p>
          <p className="text-sm text-slate-800 mt-1">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</p>
          <p className="text-sm text-slate-800 mt-1">{getRoleLabel(profile?.role)}</p>
        </div>
        {nip && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">NIP</p>
            <p className="text-sm text-slate-800 mt-1">{nip}</p>
          </div>
        )}
      </div>
    </div>
  );
}

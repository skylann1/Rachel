import React from 'react';
import { createClient } from '@/utils/supabase/server';
import RolePermissionsClient from './RolePermissionsClient';
import { allPermissionModules } from '../constants';

export default async function EditRolePermissionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  
  const { data: role, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (error || !role) {
    return (
      <div className="flex justify-center p-12">
        <p className="text-rose-500 font-bold">Role tidak ditemukan.</p>
      </div>
    );
  }

  // Aktor non-PGN cuma boleh membuka role milik organisasinya sendiri.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('type, org_id').eq('id', user?.id).single();
  if (me?.type !== 'pgn' && (!me?.org_id || role.org_id !== me.org_id)) {
    return (
      <div className="flex justify-center p-12">
        <p className="text-rose-500 font-bold">Role ini bukan bagian dari organisasi Anda.</p>
      </div>
    );
  }

  return <RolePermissionsClient role={role} allModules={allPermissionModules} />;
}

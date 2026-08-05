import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUserPermissions } from '@/utils/permissions';
import AdminProjectClient from './AdminProjectClient';

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const userRole = profile?.role || 'admin';

  // Fetch project + its JSA (including steps) + its PTW (including relations) + its procedure
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, description, status,
      vendor_profiles ( company_name ),
      jsa ( id, status, rejection_note, jsa_steps ( id, step_number, pekerjaan, bahaya, risiko, tindakan ) ),
      ptw ( id, status, rejection_note, ptw_number, workers, equipment ),
      procedures ( id, status, content )
    `)
    .eq('id', projectId)
    .single();

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold text-red-600">Database Query Error</h1>
        <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded-lg overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  if (!project) return notFound();

  return (
    <div className="p-8 pb-20 bg-slate-50 min-h-screen">
      <AdminProjectClient 
        project={project} 
        userRole={userRole} 
        currentUserId={user.id} 
      />
    </div>
  );
}

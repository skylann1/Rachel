/**
 * Shared helper for writing to document_logs (the JSA/PTW/Prosedur audit
 * trail — see supabase/schema_document_logs.sql). Kept in a plain module
 * rather than inline in the "use server" action files: a type-only export
 * inside a "use server" file gets emitted as a real runtime re-export by
 * Turbopack and crashes at runtime (see lib/asset-document.ts for the same
 * gotcha), so shared types/helpers used across several action files live
 * outside those files as a rule.
 */
export type DocLogType = 'procedure' | 'jsa' | 'ptw';

export const DOC_TYPE_LABEL: Record<DocLogType, string> = {
  procedure: 'Prosedur Kerja',
  jsa: 'JSA',
  ptw: 'PTW',
};

export async function logDocumentEvent(supabase: any, params: {
  docType: DocLogType;
  docId: string;
  projectId: string;
  actorId?: string | null;
  action: string;
  notes?: string | null;
}) {
  await supabase.from('document_logs').insert({
    project_id: params.projectId,
    doc_type: params.docType,
    doc_id: params.docId,
    actor_id: params.actorId ?? null,
    action: params.action,
    notes: params.notes ?? null,
  });
}

'use client';

import AssignStagesForm, { type AssignGroup } from '@/components/internal/assign-stages-form';
import { saveVendorStageAssignment } from './assignment-actions';

interface Candidate { id: string; full_name: string; }
interface StageSlot {
  stageKey: string;
  label: string;
  candidates: Candidate[];
  currentAssigneeIds: string[];
  locked: boolean; // true kalau ada baris non-pending, tidak bisa diedit
  passed?: boolean; // dokumen sudah melewati tahap ini
}

const DOC_TITLES: { docType: AssignGroup['docType']; title: string }[] = [
  { docType: 'procedure', title: 'Prosedur Kerja' },
  { docType: 'jsa', title: 'JSA' },
  { docType: 'ptw', title: 'PTW (Permit to Work)' },
];

// Urutan tahap: HSE Vendor dulu, baru PM Vendor.
const ROLE_META: Record<string, { label: string; hint: string; order: number }> = {
  hse_vendor: { label: 'HSE Vendor', hint: 'Verifikasi aspek keselamatan (HSE) lebih dulu.', order: 0 },
  review_vendor: { label: 'PM Vendor', hint: 'Persetujuan manajemen setelah HSE, lalu diteruskan ke PGSOL.', order: 1 },
};

async function save(projectId: string, _docType: string, stageKey: string, ids: string[]) {
  return saveVendorStageAssignment(projectId, stageKey, ids);
}

export default function VendorAssignmentPanel({ projectId, slots }: { projectId: string; slots: StageSlot[] }) {
  const groups: AssignGroup[] = DOC_TITLES.map(({ docType, title }) => ({
    docType,
    title,
    stages: slots
      .filter(s => s.stageKey.startsWith(`${docType}.`))
      .map(s => {
        const meta = ROLE_META[s.stageKey.split('.')[1]];
        return {
          stageKey: s.stageKey,
          label: meta?.label ?? s.label,
          hint: meta?.hint,
          candidates: s.candidates,
          currentIds: s.currentAssigneeIds,
          locked: s.locked,
          passed: s.passed,
          order: meta?.order ?? 9,
        };
      })
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...stage }) => stage),
  })).filter(g => g.stages.length > 0);

  return (
    <AssignStagesForm
      projectId={projectId}
      groups={groups}
      save={save}
      emptyHint="Belum ada staff dengan izin tahap ini. Buat akun berole HSE Vendor / PM Vendor lewat Staff Perusahaan."
    />
  );
}

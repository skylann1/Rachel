/** Tipe Kegiatan inspeksi — kolom inspections.activity_type (supabase/schema_inspection_activity_type.sql). */
export const ACTIVITY_TYPES = ['Proyek', 'Non-Proyek', 'Audit / Kunjungan'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; desc: string; badge: string }> = {
  'Proyek': {
    label: 'Kegiatan Keproyekan',
    desc: 'Pekerjaan vendor di area proyek.',
    badge: 'bg-primary/10 text-primary',
  },
  'Non-Proyek': {
    label: 'Non-Proyek',
    desc: 'Kantor, mess, atau area internal.',
    badge: 'bg-slate-100 text-slate-600',
  },
  'Audit / Kunjungan': {
    label: 'Audit / Kunjungan',
    desc: 'Temuan pasca audit atau kunjungan lapangan.',
    badge: 'bg-violet-100 text-violet-700',
  },
};

export function normalizeActivityType(value: unknown): ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value as string) ? (value as ActivityType) : 'Proyek';
}

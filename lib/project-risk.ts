/** Kategori Risiko Proyek — kolom projects.risk_level (supabase/schema_project_risk_level.sql). NULL = belum diatur. */
export const RISK_LEVELS = ['low', 'moderate', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_META: Record<RiskLevel, {
  label: string;
  /** Strip warna di sisi kiri kartu. */
  accent: string;
  /** Latar kartu bernuansa tipis supaya level risiko terbaca sekilas. */
  tint: string;
  badge: string;
  dot: string;
}> = {
  low: {
    label: 'Low Risk',
    accent: 'border-l-emerald-500',
    tint: 'bg-gradient-to-r from-emerald-50/60 to-white',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  moderate: {
    label: 'Moderate Risk',
    accent: 'border-l-amber-500',
    tint: 'bg-gradient-to-r from-amber-50/70 to-white',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  high: {
    label: 'High Risk',
    accent: 'border-l-rose-500',
    tint: 'bg-gradient-to-r from-rose-50/70 to-white',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
};

export function parseRiskLevel(value: unknown): RiskLevel | null {
  return (RISK_LEVELS as readonly string[]).includes(value as string) ? (value as RiskLevel) : null;
}

/** Kelas pembeda kartu; proyek tanpa level (data lama) tampil netral. */
export function riskCardClasses(level: unknown): string {
  const parsed = parseRiskLevel(level);
  return parsed
    ? `border-l-4 ${RISK_META[parsed].accent} ${RISK_META[parsed].tint}`
    : 'border-l-4 border-l-slate-200 bg-white';
}

/**
 * Kategori Risiko Proyek dari RPN tertinggi di JSA (matriks Pertamina):
 * 1–4 (Low, Low to Moderate) → low; 5–9 (Moderate) → moderate;
 * ≥10 (Moderate to High, High) → high — sengaja konservatif untuk K3.
 */
export function riskLevelFromRpn(maxRpn: number): RiskLevel {
  if (maxRpn >= 10) return 'high';
  if (maxRpn >= 5) return 'moderate';
  return 'low';
}

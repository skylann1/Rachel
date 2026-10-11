// lib/jsa-risk.ts
//
// Perhitungan & klasifikasi risiko JSA — satu sumber untuk form isian
// (jsa/create/[id]/page.tsx) dan PDF (JsaPDF.tsx), supaya warna/ambang RPN
// tidak menyimpang antara layar dan dokumen. Ambang warna mengikuti
// conditional-formatting template JSA EXAMPLE.xlsx.

export interface JsaRisk {
  severity: number;
  intensitas: number;
  kapabilitas: number;
  history: number;
  total: number;
  probability: number;
  rpn: number;
}

export const DEFAULT_RISK: JsaRisk = { severity: 1, intensitas: 1, kapabilitas: 1, history: 1, total: 3, probability: 1, rpn: 1 };

/** Total (intensitas + kapabilitas + history) → nilai probability 1..5. */
export function probabilityFromTotal(total: number): number {
  if (total >= 13) return 5;
  if (total >= 10) return 4;
  if (total >= 7) return 3;
  if (total >= 4) return 2;
  return 1;
}

export function calculateRisk<T extends Pick<JsaRisk, 'severity' | 'intensitas' | 'kapabilitas' | 'history'>>(
  r: T,
): T & Pick<JsaRisk, 'total' | 'probability' | 'rpn'> {
  const total = Number(r.intensitas) + Number(r.kapabilitas) + Number(r.history);
  const probability = probabilityFromTotal(total);
  return { ...r, total, probability, rpn: Number(r.severity) * probability };
}

export interface RpnLevel {
  key: 'rendah' | 'sedang' | 'tinggi' | 'sangat-tinggi';
  label: string;
  hex: string;
  /** Warna teks di atas latar `hex` supaya tetap terbaca. */
  ink: string;
  /** Kelas Tailwind untuk badge di layar. */
  badge: string;
}

export const RPN_LEVELS: { min: number; level: RpnLevel; range: string }[] = [
  { min: 15, range: '≥ 15', level: { key: 'sangat-tinggi', label: 'Sangat Tinggi', hex: '#FF0000', ink: '#FFFFFF', badge: 'bg-rose-600 text-white' } },
  { min: 10, range: '10 – 14', level: { key: 'tinggi', label: 'Tinggi', hex: '#FFC000', ink: '#000000', badge: 'bg-orange-400 text-slate-900' } },
  { min: 5, range: '5 – 9', level: { key: 'sedang', label: 'Sedang', hex: '#FFFF00', ink: '#000000', badge: 'bg-yellow-300 text-slate-900' } },
  { min: 4, range: '4', level: { key: 'rendah', label: 'Rendah', hex: '#92D050', ink: '#000000', badge: 'bg-lime-400 text-slate-900' } },
  { min: 1, range: '1 – 3', level: { key: 'rendah', label: 'Rendah', hex: '#00B050', ink: '#FFFFFF', badge: 'bg-emerald-500 text-white' } },
];

export function rpnLevel(rpn: number): RpnLevel {
  return (RPN_LEVELS.find(l => rpn >= l.min) ?? RPN_LEVELS[RPN_LEVELS.length - 1]).level;
}

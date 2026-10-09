/**
 * Bentuk detail perubahan yang disimpan di activity_logs.metadata, plus helper
 * untuk menghitungnya. Modul biasa (bukan "use server"), jadi tipenya aman
 * diimpor dari server action maupun komponen client.
 */
export interface FieldChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface ActivityMetadata {
  /** Perubahan per-field sebelum → sesudah. */
  changes?: FieldChange[];
  /** Selisih permission role, format "modul.aksi". */
  permissions?: { added: string[]; removed: string[] };
  /** Alasan singkat (mis. pesan error auth untuk login gagal). */
  reason?: string;
  /** Login dari kombinasi perangkat yang belum pernah dipakai akun ini. */
  newDevice?: boolean;
}

function normalize(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Hanya field yang benar-benar berubah; urutan mengikuti `labels`. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, label] of Object.entries(labels)) {
    const b = normalize(before[field]);
    const a = normalize(after[field]);
    if (b !== a) changes.push({ field, label, before: b, after: a });
  }
  return changes;
}

function flattenPermissions(p: Record<string, string[]> | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const [mod, actions] of Object.entries(p ?? {})) {
    if (Array.isArray(actions)) for (const a of actions) out.add(`${mod}.${a}`);
  }
  return out;
}

export function diffPermissions(
  before: Record<string, string[]> | null | undefined,
  after: Record<string, string[]> | null | undefined,
): { added: string[]; removed: string[] } {
  const b = flattenPermissions(before);
  const a = flattenPermissions(after);
  return {
    added: [...a].filter(x => !b.has(x)).sort(),
    removed: [...b].filter(x => !a.has(x)).sort(),
  };
}

/** Metadata kosong disimpan sebagai null, bukan {}. */
export function compactMetadata(m: ActivityMetadata | null | undefined): ActivityMetadata | null {
  if (!m) return null;
  const out: ActivityMetadata = {};
  if (m.changes && m.changes.length > 0) out.changes = m.changes;
  if (m.permissions && (m.permissions.added.length > 0 || m.permissions.removed.length > 0)) out.permissions = m.permissions;
  if (m.reason) out.reason = m.reason;
  if (m.newDevice) out.newDevice = true;
  return Object.keys(out).length > 0 ? out : null;
}

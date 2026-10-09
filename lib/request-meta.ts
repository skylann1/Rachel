import { headers } from 'next/headers';

/**
 * IP dan user agent request yang sedang berjalan — dipakai activity_logs untuk
 * jejak perangkat. Hanya valid di dalam konteks request (server action / route
 * handler / server component); di luar itu mengembalikan null, tidak melempar.
 *
 * x-forwarded-for diisi proxy/CDN di depan app (Vercel); entri pertama adalah
 * klien asli. Nilainya bisa dipalsukan klien kalau app diakses tanpa proxy,
 * jadi ini petunjuk investigasi, bukan bukti identitas.
 */
export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || h.get('x-real-ip') || null;
    return { ip, userAgent: h.get('user-agent') };
  } catch {
    return { ip: null, userAgent: null };
  }
}

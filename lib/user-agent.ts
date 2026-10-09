/**
 * Ringkas user agent mentah jadi label singkat "Chrome · Windows" untuk
 * tampilan log. Pencocokan sederhana atas browser/OS yang umum — bukan parser
 * lengkap; user agent yang tak dikenali jatuh ke "Perangkat tidak dikenal".
 */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Perangkat tidak dikenal';

  // Urutan penting: Edge/Opera juga membawa token "Chrome", Chrome membawa "Safari".
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) || /CriOS\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;

  // iOS juga membawa "Mac OS X" di UA-nya, jadi cek iPhone/iPad dulu.
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;

  if (!browser && !os) return 'Perangkat tidak dikenal';
  return [browser, os].filter(Boolean).join(' · ');
}

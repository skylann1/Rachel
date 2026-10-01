/**
 * Turunan foto tampilan (thumbnail + galeri) dari satu baris `inspections`.
 * Dipakai bareng oleh app/dashboard/inspection/page.tsx dan
 * app/vendor/dashboard/inspection/page.tsx — sebelumnya logic ini ditulis
 * ulang di dua tempat dan sempat ketinggalan di-sync (lihat commit
 * 48e9b7a), jadi disatukan di sini supaya cuma ada satu sumber kebenaran.
 */
export function resolveInspectionGallery(row: {
  image_url?: string | null;
  inspection_photos?: { image_url: string }[] | null;
}): { image: string; photos: string[] } {
  const photos = (row.inspection_photos || []).map((p) => p.image_url);
  const gallery = photos.length > 0 ? photos : (row.image_url ? [row.image_url] : []);
  const image = row.image_url || photos[0] || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80';
  return { image, photos: gallery };
}

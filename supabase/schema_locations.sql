-- Master Data Lokasi (stasiun / area kerja) + tautan dari proyek.
-- Idempotent. Dijalankan manual di Supabase SQL editor.
--   locations            -> daftar lokasi master (dikelola PGN: masterData.manage_location)
--   projects.location_id -> lokasi master yang dipilih saat membuat proyek.
-- projects.location (teks) TETAP dipakai seluruh aplikasi; createProject mengisinya
-- dari locations.name sehingga tidak ada kode lain yang perlu berubah.
-- Proyek lama: location_id NULL, location teks tetap.

CREATE TABLE IF NOT EXISTS public.locations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT,
  region     TEXT,          -- wilayah / zona (opsional)
  address    TEXT,
  is_active  BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS locations_name_unique ON public.locations (lower(name));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Baca: semua user login (dropdown di form proyek). Tulis: hanya lewat service role
-- (server action yang sudah mengecek permission), jadi tidak ada policy INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Authenticated users can read locations" ON public.locations;
CREATE POLICY "Authenticated users can read locations"
ON public.locations FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_location_id_idx ON public.projects(location_id);

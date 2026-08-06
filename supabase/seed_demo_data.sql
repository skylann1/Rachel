-- SIPERMIT K3: Demo/development seed data
-- Jalankan script ini di Supabase SQL Editor
--
-- Fills inspections, incidents and PTW workers so the dashboard charts,
-- the 6-month trend, and the anomaly/priority breakdowns have something to
-- render. Without this the database is empty and every chart shows its
-- empty state, which makes the app impossible to demo or eyeball.
--
-- DEVELOPMENT ONLY — do not run against production.
--
-- Safe to re-run: everything it inserts is tagged with the marker below and
-- deleted first, so repeated runs replace the demo rows instead of piling up
-- duplicates. Rows you created by hand are never touched.

DO $$
DECLARE
  marker           TEXT := '[DEMO]';
  proj             UUID;
  proj2            UUID;
  vendor           UUID;
  reporter         UUID;
  today            DATE := CURRENT_DATE;
BEGIN
  -- Anchor everything to real existing rows; bail out rather than invent FKs.
  SELECT id INTO proj     FROM public.projects   ORDER BY created_at        LIMIT 1;
  SELECT id INTO proj2    FROM public.projects   ORDER BY created_at DESC   LIMIT 1;
  SELECT id INTO vendor   FROM public.vendor_profiles                       LIMIT 1;
  SELECT id INTO reporter FROM public.internal_profiles                     LIMIT 1;

  IF proj IS NULL THEN
    RAISE EXCEPTION 'No projects found — create at least one project before seeding.';
  END IF;
  IF reporter IS NULL THEN
    RAISE EXCEPTION 'No internal_profiles found — create an internal user before seeding.';
  END IF;

  -- ---------------------------------------------------------------- cleanup
  DELETE FROM public.inspections WHERE title LIKE marker || '%';
  DELETE FROM public.incidents   WHERE title LIKE marker || '%';

  -- ------------------------------------------------------------ inspections
  -- Spread across the last 6 months so the trend line has real shape, with a
  -- mix of finding_type / priority / status so every breakdown is populated.
  INSERT INTO public.inspections
    (project_id, reported_by, target_vendor, title, location, finding_type, priority, status, created_at)
  VALUES
    -- 5 months ago
    (proj,  reporter, vendor, marker || ' APD lengkap di area galian',        'Area Galian A',   'Safe Act',         'Low',      'Closed',      today - 152),
    (proj,  reporter, vendor, marker || ' Rambu K3 terpasang baik',           'Gerbang Utama',   'Safe Condition',   'Low',      'Closed',      today - 148),
    (proj,  reporter, vendor, marker || ' Pekerja tanpa helm di zona wajib',  'Area Galian B',   'Unsafe Act',       'High',     'Closed',      today - 145),
    -- 4 months ago
    (proj,  reporter, vendor, marker || ' Housekeeping area kerja rapi',      'Workshop',        'Safe Condition',   'Low',      'Closed',      today - 120),
    (proj,  reporter, vendor, marker || ' Kabel listrik terkelupas',          'Panel Listrik',   'Unsafe Condition', 'Critical', 'Closed',      today - 118),
    (proj2, reporter, vendor, marker || ' Briefing K3 pagi dilaksanakan',     'Muster Point',    'Safe Act',         'Low',      'Closed',      today - 112),
    -- 3 months ago
    (proj,  reporter, vendor, marker || ' Scaffolding tanpa tag inspeksi',    'Area Struktur',   'Unsafe Condition', 'High',     'Closed',      today - 92),
    (proj,  reporter, vendor, marker || ' Penggunaan full body harness',      'Ketinggian 12m',  'Safe Act',         'Low',      'Closed',      today - 88),
    -- 2 months ago
    (proj,  reporter, vendor, marker || ' APAR kedaluwarsa',                  'Gudang Material', 'Unsafe Condition', 'Medium',   'Closed',      today - 62),
    (proj2, reporter, vendor, marker || ' Rambu jalur evakuasi jelas',        'Koridor Utama',   'Safe Condition',   'Low',      'Closed',      today - 58),
    (proj,  reporter, vendor, marker || ' Material menghalangi jalur darurat','Koridor Timur',   'Unsafe Condition', 'High',     'In Progress', today - 55),
    -- last month
    (proj,  reporter, vendor, marker || ' Izin kerja panas dipatuhi',         'Area Welding',    'Safe Act',         'Low',      'Closed',      today - 32),
    (proj,  reporter, vendor, marker || ' Operator alat berat tanpa SIO',     'Area Manuver',    'Unsafe Act',       'Critical', 'In Progress', today - 28),
    (proj2, reporter, vendor, marker || ' Genangan oli di lantai kerja',      'Workshop',        'Unsafe Condition', 'Medium',   'Open',        today - 24),
    -- this month
    (proj,  reporter, vendor, marker || ' Toolbox meeting terdokumentasi',    'Muster Point',    'Safe Act',         'Low',      'Closed',      today - 12),
    (proj,  reporter, vendor, marker || ' Pekerja merokok di area terlarang', 'Belakang Gudang', 'Unsafe Act',       'High',     'Open',        today - 8),
    (proj,  reporter, vendor, marker || ' Galian tanpa pembatas pengaman',    'Area Galian C',   'Unsafe Condition', 'Critical', 'Open',        today - 5),
    (proj2, reporter, vendor, marker || ' Pemeriksaan APD harian tertib',     'Gerbang Utama',   'Safe Condition',   'Low',      'Closed',      today - 2);

  -- --------------------------------------------------------------- incidents
  -- Deliberately low-severity and old: keeps the "days without incident"
  -- streak meaningful instead of resetting it to zero.
  INSERT INTO public.incidents
    (project_id, reported_by, title, type, incident_date, incident_time, location,
     chronology, immediate_action, status, created_at)
  VALUES
    (proj, reporter, marker || ' Hampir terpeleset di area basah', 'Near Miss',
     today - 78, '09:15',  'Koridor Timur',
     'Pekerja hampir terpeleset pada genangan air sisa hujan. Tidak ada cedera.',
     'Area dikeringkan dan dipasang rambu lantai licin.', 'Selesai', today - 78),
    (proj, reporter, marker || ' Tergores plat saat handling', 'First Aid',
     today - 45, '14:30',  'Workshop',
     'Tangan pekerja tergores sisi plat saat pemindahan material tanpa sarung tangan.',
     'Luka dibersihkan dan dibalut di klinik proyek.', 'Selesai', today - 45);

  -- ---------------------------------------------------------- PTW manpower
  -- Safe Man-Hours is derived from the length of ptw.workers, so an empty
  -- array leaves that KPI reading zero.
  UPDATE public.ptw
  SET workers = '[
        {"name": "Budi Santoso",   "role": "Supervisor"},
        {"name": "Andi Pratama",   "role": "Welder"},
        {"name": "Rudi Hartono",   "role": "Helper"},
        {"name": "Slamet Riyadi",  "role": "Operator"},
        {"name": "Joko Susilo",    "role": "Rigger"},
        {"name": "Agus Setiawan",  "role": "Safety Man"}
      ]'::jsonb
  WHERE workers IS NULL OR jsonb_array_length(workers) = 0;

  RAISE NOTICE 'Seed complete: 18 inspections, 2 incidents, PTW workers populated.';
END $$;

-- Verify what landed.
SELECT 'inspections' AS tabel, count(*) AS jumlah FROM public.inspections WHERE title LIKE '[DEMO]%'
UNION ALL
SELECT 'incidents',            count(*)           FROM public.incidents   WHERE title LIKE '[DEMO]%';

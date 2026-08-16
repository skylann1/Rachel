-- SIPERMIT/RACHEL K3: Pendalaman master data Pekerja, Peralatan, dan Material
-- Jalankan script ini di Supabase SQL Editor
--
-- Latar belakang (Review 1, lembar "kebutuhan orang / alat / material"):
-- Setiap baris langkah kerja pada JSA harus mencantumkan kebutuhan orang,
-- alat, dan material secara rinci — lengkap dengan kompetensi, masa berlaku,
-- dan bukti dokumennya. Catatan klien menegaskan "semua data tersimpan dalam
-- data pekerja/peralatan/material dan dapat ditarik untuk proyek selanjutnya",
-- jadi rinciannya disimpan sebagai master data yang dapat dipakai ulang,
-- bukan diketik ulang di tiap JSA.
--
-- Struktur lama hanya menyediakan satu kolom teks `certification` pada pekerja
-- dan sepasang kolom sertifikat pada peralatan, sehingga tidak mampu menampung
-- banyak kompetensi/dokumen sekaligus beserta masa berlakunya masing-masing.
-- Karena itu rinciannya dipecah menjadi tabel anak.

-- ---------------------------------------------------------------- PEKERJA
ALTER TABLE public.vendor_workers
ADD COLUMN IF NOT EXISTS id_card_url TEXT,
ADD COLUMN IF NOT EXISTS education TEXT;

CREATE TABLE IF NOT EXISTS public.vendor_worker_competencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES public.vendor_workers(id) ON DELETE CASCADE NOT NULL,
  -- 'Safety' | 'Teknis' — mengikuti pengelompokan pada catatan klien.
  category TEXT NOT NULL DEFAULT 'Safety',
  title TEXT NOT NULL,
  valid_from DATE,
  valid_to DATE,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_competencies_worker
  ON public.vendor_worker_competencies(worker_id);

ALTER TABLE public.vendor_worker_competencies ENABLE ROW LEVEL SECURITY;

-- Hak akses menumpang pada baris induknya: mitra kerja hanya boleh menyentuh
-- kompetensi milik pekerjanya sendiri.
CREATE POLICY "Vendors manage own worker competencies"
ON public.vendor_worker_competencies FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.vendor_workers w
  WHERE w.id = worker_id AND w.vendor_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vendor_workers w
  WHERE w.id = worker_id AND w.vendor_id = auth.uid()
));

CREATE POLICY "Internal users can view worker competencies"
ON public.vendor_worker_competencies FOR SELECT
USING (public.is_internal_user());


-- -------------------------------------------------------------- PERALATAN
ALTER TABLE public.vendor_equipment
ADD COLUMN IF NOT EXISTS type_serial TEXT,
ADD COLUMN IF NOT EXISTS dimension TEXT,
ADD COLUMN IF NOT EXISTS capacity TEXT,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unit',
ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE TABLE IF NOT EXISTS public.vendor_equipment_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES public.vendor_equipment(id) ON DELETE CASCADE NOT NULL,
  doc_name TEXT NOT NULL,          -- mis. "Sertifikasi Kelayakan"
  issuer TEXT,                     -- lembaga penerbit, mis. "Sucofindo"
  valid_to DATE,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_documents_equipment
  ON public.vendor_equipment_documents(equipment_id);

ALTER TABLE public.vendor_equipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors manage own equipment documents"
ON public.vendor_equipment_documents FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.vendor_equipment e
  WHERE e.id = equipment_id AND e.vendor_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vendor_equipment e
  WHERE e.id = equipment_id AND e.vendor_id = auth.uid()
));

CREATE POLICY "Internal users can view equipment documents"
ON public.vendor_equipment_documents FOR SELECT
USING (public.is_internal_user());


-- --------------------------------------------------------------- MATERIAL
-- Entitas baru: sebelumnya material sama sekali tidak punya tempat penyimpanan.
CREATE TABLE IF NOT EXISTS public.vendor_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,              -- mis. "Cat"
  brand TEXT,                      -- mis. "Jotun"
  type_serial TEXT,                -- mis. "RAL 1330"
  dimension TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'unit',        -- mis. "galon"
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_materials_vendor
  ON public.vendor_materials(vendor_id);

ALTER TABLE public.vendor_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage their own materials"
ON public.vendor_materials FOR ALL
USING (vendor_id = auth.uid())
WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Internal users can view all materials"
ON public.vendor_materials FOR SELECT
USING (public.is_internal_user());


CREATE TABLE IF NOT EXISTS public.vendor_material_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID REFERENCES public.vendor_materials(id) ON DELETE CASCADE NOT NULL,
  doc_name TEXT NOT NULL,          -- mis. "MSDS"
  issuer TEXT,                     -- mis. "Manufacturer"
  valid_to DATE,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_documents_material
  ON public.vendor_material_documents(material_id);

ALTER TABLE public.vendor_material_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors manage own material documents"
ON public.vendor_material_documents FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.vendor_materials m
  WHERE m.id = material_id AND m.vendor_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vendor_materials m
  WHERE m.id = material_id AND m.vendor_id = auth.uid()
));

CREATE POLICY "Internal users can view material documents"
ON public.vendor_material_documents FOR SELECT
USING (public.is_internal_user());

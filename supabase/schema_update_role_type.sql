-- Menambahkan kolom type pada tabel roles
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'internal';

-- Mengupdate tipe role yang sudah ada
UPDATE public.roles SET type = 'external' WHERE name = 'vendor';
UPDATE public.roles SET type = 'internal' WHERE name IN ('admin', 'hse', 'pm', 'pengawas');

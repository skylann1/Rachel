-- supabase/schema_vendor_documents_bucket.sql
--
-- Bucket `vendor-documents` untuk upload dokumen persyaratan vendor
-- (uploadVendorDocument di utils/supabase/storage.ts), mengikuti pola
-- `sipermit-images` di schema.sql. Sebelum file ini, bucket-nya tidak pernah
-- dibuat dari SQL — upload hanya berhasil kalau seseorang membuat bucket
-- secara manual lewat Supabase Dashboard.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read vendor documents" ON storage.objects;
CREATE POLICY "Public read vendor documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-documents');

DROP POLICY IF EXISTS "Authenticated users can upload vendor documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload vendor documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vendor-documents' AND auth.role() = 'authenticated');
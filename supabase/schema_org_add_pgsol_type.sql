-- supabase/schema_org_add_pgsol_type.sql
--
-- Menambah label enum baru SEBELUM label lama di-rename (lihat
-- schema_org_rename_type_labels.sql) — Postgres tidak mengizinkan ADD VALUE
-- dan pemakaian value itu di transaksi yang sama, jadi file ini SENGAJA
-- cuma berisi satu statement dan harus dijalankan sebagai file terpisah.
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pgsol';

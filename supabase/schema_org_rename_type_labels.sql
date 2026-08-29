-- supabase/schema_org_rename_type_labels.sql
--
-- Dijalankan SETELAH schema_org_backfill_internal.sql dan
-- schema_org_backfill_vendor.sql selesai (keduanya masih memakai label
-- lama 'internal'/'external'). File ini SENGAJA cuma berisi rename enum —
-- jangan gabung dengan statement lain (lihat Global Constraints).
ALTER TYPE user_type RENAME VALUE 'internal' TO 'pgn';
ALTER TYPE user_type RENAME VALUE 'external' TO 'vendor';

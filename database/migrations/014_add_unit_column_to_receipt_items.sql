-- =====================================================================
-- Migration 014: Add Unit (unit) Column to receipt_items
-- Menambahkan kolom satuan ukuran item (kg, ml, pcs, liter, pack, dll)
-- ke tabel receipt_items di public schema maupun seluruh skema tenant.
-- =====================================================================

-- 1. Tambah kolom unit pada public.receipt_items
ALTER TABLE public.receipt_items ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'pcs';

-- 2. Migrasi ke seluruh skema tenant yang terisolasi
DO $$
DECLARE
    t_rec RECORD;
    target_schema TEXT;
    clean_id TEXT;
BEGIN
    FOR t_rec IN 
        SELECT id FROM public.tenants WHERE "schemaMigrated" = true
    LOOP
        clean_id := LOWER(REPLACE(t_rec.id::text, '-', '_'));
        target_schema := 'tenant_' || clean_id;

        IF EXISTS (
            SELECT 1 FROM information_schema.schemata 
            WHERE schema_name = target_schema
        ) THEN
            RAISE NOTICE 'Adding unit column to schema: %', target_schema;

            EXECUTE format('
                ALTER TABLE %I.receipt_items 
                ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT ''pcs'';
            ', target_schema);
        END IF;
    END LOOP;
END $$;

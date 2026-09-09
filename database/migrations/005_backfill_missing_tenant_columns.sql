-- =====================================================================
-- Migration 005: Backfill Missing Tenant Columns
-- 
-- PENTING / CATATAN PENGGUNAAN:
-- Script ini HANYA perlu dijalankan jika SUDAH ADA tenant yang telanjur
-- dimigrasi ke skema terisolasi (schemaMigrated = true) SEBELUM perbaikan
-- kolom paymentStatus, staffName, createdByUsername, dan subCategory diterapkan.
--
-- JIKA BELUM ADA tenant yang dimigrasi, ATAU tenant baru dimigrasi setelah
-- perbaikan template dan script migrasi diterapkan, file ini TIDAK PERLU
-- dijalankan karena template dan script migrasi sudah otomatis menyalin
-- semua kolom tersebut.
-- =====================================================================

-- ---------------------------------------------------------------------
-- OPSI A: AUTOMATIC BACKFILL (Untuk Semua Tenant yang Sudah Migrasi)
-- Blok PL/pgSQL berikut mencari semua tenant dengan schemaMigrated = true,
-- memastikan kolom baru ada, lalu melakukan UPDATE (bukan INSERT) dari
-- tabel shared public ke skema masing-masing tenant.
-- ---------------------------------------------------------------------

DO $$
DECLARE
    t_rec RECORD;
    target_schema TEXT;
    clean_id TEXT;
BEGIN
    -- Set session to superadmin to bypass RLS during maintenance/backfill
    PERFORM set_config('app.is_superadmin', 'true', true);

    FOR t_rec IN 
        SELECT id FROM public.tenants WHERE "schemaMigrated" = true
    LOOP
        clean_id := LOWER(REPLACE(t_rec.id::text, '-', '_'));
        target_schema := 'tenant_' || clean_id;

        -- Verifikasi keberadaan skema
        IF EXISTS (
            SELECT 1 FROM information_schema.schemata 
            WHERE schema_name = target_schema
        ) THEN
            RAISE NOTICE 'Processing backfill for schema: % (Tenant ID: %)', target_schema, t_rec.id;

            -- Set tenant context
            PERFORM set_config('app.current_tenant_id', t_rec.id::text, true);

            -- 1. Pastikan kolom-kolom baru sudah ada di tabel receipts
            EXECUTE format('
                ALTER TABLE %I.receipts 
                ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT ''Lunas'',
                ADD COLUMN IF NOT EXISTS "staffName" TEXT DEFAULT ''Admin'',
                ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;
            ', target_schema);

            -- 2. Pastikan kolom subCategory sudah ada di tabel receipt_items
            EXECUTE format('
                ALTER TABLE %I.receipt_items 
                ADD COLUMN IF NOT EXISTS "subCategory" TEXT DEFAULT ''Umum'';
            ', target_schema);

            -- 3. UPDATE data receipts dari public.receipts (menyelaraskan data asli yang tertinggal)
            EXECUTE format('
                UPDATE %I.receipts target
                SET 
                    "paymentStatus" = COALESCE(src."paymentStatus", target."paymentStatus", ''Lunas''),
                    "staffName" = COALESCE(src."staffName", target."staffName", ''Admin''),
                    "createdByUsername" = COALESCE(src."createdByUsername", target."createdByUsername"),
                    notes = COALESCE(target.notes, src.note)
                FROM public.receipts src
                WHERE target.id = src.id
                  AND src."tenantId" = %L;
            ', target_schema, t_rec.id);

            -- 4. UPDATE data receipt_items dari public.receipt_items
            EXECUTE format('
                UPDATE %I.receipt_items target
                SET 
                    "subCategory" = COALESCE(src."subCategory", target."subCategory", ''Umum'')
                FROM public.receipt_items src
                JOIN public.receipts r ON src."receiptId" = r.id
                WHERE target.id = src.id
                  AND r."tenantId" = %L;
            ', target_schema, t_rec.id);

            RAISE NOTICE 'Backfill completed successfully for schema: %', target_schema;
        ELSE
            RAISE WARNING 'Schema % not found for migrated tenant ID: %', target_schema, t_rec.id;
        END IF;
    END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- OPSI B: MANUAL BACKFILL PER-TENANT TERTENTU (Template Query)
-- Jika ingin mengeksekusi secara manual untuk 1 tenant tertentu saja:
-- Ganti 'tenant_00000000_0000_0000_0000_000000000001' dan UUID tenantId
-- di bawah ini dengan target skema dan tenantId yang ingin diperbaiki.
-- ---------------------------------------------------------------------

/*
-- 1. Tambah kolom jika belum ada
ALTER TABLE "tenant_00000000_0000_0000_0000_000000000001".receipts 
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'Lunas',
ADD COLUMN IF NOT EXISTS "staffName" TEXT DEFAULT 'Admin',
ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;

ALTER TABLE "tenant_00000000_0000_0000_0000_000000000001".receipt_items 
ADD COLUMN IF NOT EXISTS "subCategory" TEXT DEFAULT 'Umum';

-- 2. UPDATE baris yang sudah ada dari public.receipts
UPDATE "tenant_00000000_0000_0000_0000_000000000001".receipts target
SET 
    "paymentStatus" = COALESCE(src."paymentStatus", target."paymentStatus", 'Lunas'),
    "staffName" = COALESCE(src."staffName", target."staffName", 'Admin'),
    "createdByUsername" = COALESCE(src."createdByUsername", target."createdByUsername"),
    notes = COALESCE(target.notes, src.note)
FROM public.receipts src
WHERE target.id = src.id
  AND src."tenantId" = '00000000-0000-0000-0000-000000000001';

-- 3. UPDATE baris receipt_items yang sudah ada dari public.receipt_items
UPDATE "tenant_00000000_0000_0000_0000_000000000001".receipt_items target
SET 
    "subCategory" = COALESCE(src."subCategory", target."subCategory", 'Umum')
FROM public.receipt_items src
JOIN public.receipts r ON src."receiptId" = r.id
WHERE target.id = src.id
  AND r."tenantId" = '00000000-0000-0000-0000-000000000001';
*/

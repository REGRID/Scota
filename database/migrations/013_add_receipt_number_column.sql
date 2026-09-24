-- =====================================================================
-- Migration 013: Add Receipt Number (receiptNumber) Column
-- Menambahkan kolom nomor nota / struk / invoice fisik ke tabel receipts
-- baik di public schema maupun seluruh skema tenant terisolasi.
-- =====================================================================

-- 1. Tambah kolom receiptNumber pada public.receipts
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;

-- Buat indeks untuk mempercepat pencarian berdasarkan nomor nota
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts("receiptNumber");

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
            RAISE NOTICE 'Adding receiptNumber column to schema: %', target_schema;

            EXECUTE format('
                ALTER TABLE %I.receipts 
                ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
            ', target_schema);

            EXECUTE format('
                CREATE INDEX IF NOT EXISTS idx_%s_receipt_number ON %I.receipts("receiptNumber");
            ', clean_id, target_schema);
        END IF;
    END LOOP;
END $$;

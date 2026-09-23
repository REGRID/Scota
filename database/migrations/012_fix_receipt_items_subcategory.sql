-- =====================================================================
-- Migration 012: Ensure subCategory column in all receipt_items tables
-- =====================================================================

-- 1. Ensure subCategory exists in public.receipt_items
ALTER TABLE public.receipt_items 
ADD COLUMN IF NOT EXISTS "subCategory" TEXT DEFAULT 'Umum';

-- 2. Dynamically ensure subCategory exists in all tenant schemas
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format('
            ALTER TABLE %I.receipt_items 
            ADD COLUMN IF NOT EXISTS "subCategory" TEXT DEFAULT ''Umum'';
        ', schema_rec.schema_name);

        EXECUTE format('
            ALTER TABLE %I.receipts 
            ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT ''Lunas'',
            ADD COLUMN IF NOT EXISTS "staffName" TEXT DEFAULT ''Admin'',
            ADD COLUMN IF NOT EXISTS "createdByRole" TEXT DEFAULT ''ADMIN'',
            ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;
        ', schema_rec.schema_name);
    END LOOP;
END $$;

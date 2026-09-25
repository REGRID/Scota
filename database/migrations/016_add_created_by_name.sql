-- =====================================================================
-- Migration 016: Add createdByName and Ensure Uploader Attribution on receipts
-- 
-- Stores explicit creator/uploader name for each receipt transaction.
-- Works seamlessly across public.receipts and all isolated tenant_% schemas.
-- =====================================================================

-- 1. Update public.receipts table
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS "staffName" TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS "createdByRole" TEXT DEFAULT 'ADMIN';
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;

UPDATE public.receipts
SET "createdByName" = COALESCE("staffName", "createdByUsername", 'Admin')
WHERE "createdByName" IS NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_uploader_username ON public.receipts ("createdByUsername");
CREATE INDEX IF NOT EXISTS idx_receipts_uploader_role ON public.receipts ("createdByRole");

-- 2. Update all tenant_% schemas
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = schema_rec.schema_name AND table_name = 'receipts'
        ) THEN
            EXECUTE format('
                ALTER TABLE %I.receipts
                ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
                ADD COLUMN IF NOT EXISTS "staffName" TEXT,
                ADD COLUMN IF NOT EXISTS "createdByRole" TEXT DEFAULT ''ADMIN'',
                ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;

                UPDATE %I.receipts
                SET "createdByName" = COALESCE("staffName", "createdByUsername", ''Admin'')
                WHERE "createdByName" IS NULL;

                CREATE INDEX IF NOT EXISTS idx_tenant_receipts_uploader ON %I.receipts ("createdByUsername");
            ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);
        END IF;
    END LOOP;
END $$;

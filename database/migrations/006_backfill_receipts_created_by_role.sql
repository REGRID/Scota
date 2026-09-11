-- =====================================================================
-- Migration 006: Backfill receipts createdByRole
-- 
-- Ensures all existing receipts have an explicit createdByRole:
-- - 'KARYAWAN' for receipts tagged with staff/kasir indicators or talangan
-- - 'ADMIN' for default/business owner receipts
-- This enables clean role-based query scoping without ad-hoc string ILIKE heuristics.
-- =====================================================================

-- 1. Backfill public.receipts table
UPDATE public.receipts
SET "createdByRole" = CASE
    WHEN "paymentMethod" ILIKE '%Talangan%' 
      OR note ILIKE '%(karyawan)%' 
      OR note ILIKE '%(kasir)%' 
      OR "staffName" ILIKE ANY(ARRAY['%kasir%', '%staf%', '%staff%', '%karyawan%']) THEN 'KARYAWAN'
    ELSE 'ADMIN'
END
WHERE "createdByRole" IS NULL;

-- 2. Backfill isolated tenant schemas if any exist
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    -- Set session to superadmin to bypass RLS during maintenance
    PERFORM set_config('app.is_superadmin', 'true', true);

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
                ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT ''Lunas'',
                ADD COLUMN IF NOT EXISTS "staffName" TEXT DEFAULT ''Admin'',
                ADD COLUMN IF NOT EXISTS "createdByUsername" TEXT;
            ', schema_rec.schema_name);

            -- Determine if column is notes or note
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = schema_rec.schema_name AND table_name = 'receipts' AND column_name = 'notes'
            ) THEN
                EXECUTE format('
                    UPDATE %I.receipts
                    SET "createdByRole" = CASE
                        WHEN "paymentMethod" ILIKE ''%%Talangan%%'' 
                          OR notes ILIKE ''%%(karyawan)%%'' 
                          OR notes ILIKE ''%%(kasir)%%'' 
                          OR "staffName" ILIKE ANY(ARRAY[''%%kasir%%'', ''%%staf%%'', ''%%staff%%'', ''%%karyawan%%'']) THEN ''KARYAWAN''
                        ELSE ''ADMIN''
                    END
                    WHERE "createdByRole" IS NULL;
                ', schema_rec.schema_name);
            ELSE
                EXECUTE format('
                    UPDATE %I.receipts
                    SET "createdByRole" = CASE
                        WHEN "paymentMethod" ILIKE ''%%Talangan%%'' 
                          OR note ILIKE ''%%(karyawan)%%'' 
                          OR note ILIKE ''%%(kasir)%%'' 
                          OR "staffName" ILIKE ANY(ARRAY[''%%kasir%%'', ''%%staf%%'', ''%%staff%%'', ''%%karyawan%%'']) THEN ''KARYAWAN''
                        ELSE ''ADMIN''
                    END
                    WHERE "createdByRole" IS NULL;
                ', schema_rec.schema_name);
            END IF;
        END IF;
    END LOOP;
END $$;

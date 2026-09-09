-- =====================================================================
-- Migration 007: Sync Tenant Schemas with Public Tables (Parity Repair)
-- Ensures custom_categories, pending_approvals, notifications, and
-- push_subscriptions have matching column structures across all tenant schemas.
-- =====================================================================

DO $$
DECLARE
    schema_record RECORD;
    target_schema TEXT;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        target_schema := schema_record.schema_name;
        RAISE NOTICE 'Syncing columns for tenant schema: %', target_schema;

        -- 1. Table: custom_categories
        EXECUTE format('
            ALTER TABLE %I.custom_categories 
            ADD COLUMN IF NOT EXISTS "parentId" TEXT,
            ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''#10b981'',
            ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT ''Tag'',
            ADD COLUMN IF NOT EXISTS "monthlyBudget" DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
        ', target_schema);

        -- Remove strict unique constraint on name if it exists (so subcategories can share names)
        BEGIN
            EXECUTE format('ALTER TABLE %I.custom_categories DROP CONSTRAINT IF EXISTS custom_categories_name_key;', target_schema);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- 2. Table: pending_approvals
        EXECUTE format('
            ALTER TABLE %I.pending_approvals 
            ADD COLUMN IF NOT EXISTS "actionType" TEXT DEFAULT ''CREATE'',
            ADD COLUMN IF NOT EXISTS "requestedBy" TEXT DEFAULT ''Staff'',
            ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
            ADD COLUMN IF NOT EXISTS "payload" TEXT DEFAULT ''{}'',
            ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
        ', target_schema);

        -- 3. Table: notifications
        EXECUTE format('
            ALTER TABLE %I.notifications 
            ADD COLUMN IF NOT EXISTS recipient TEXT DEFAULT ''admin'',
            ADD COLUMN IF NOT EXISTS sender TEXT,
            ADD COLUMN IF NOT EXISTS "approvalId" UUID;
        ', target_schema);

        -- 4. Table: push_subscriptions
        EXECUTE format('
            ALTER TABLE %I.push_subscriptions 
            ADD COLUMN IF NOT EXISTS p256dh TEXT DEFAULT '''',
            ADD COLUMN IF NOT EXISTS auth TEXT DEFAULT '''',
            ADD COLUMN IF NOT EXISTS username TEXT,
            ADD COLUMN IF NOT EXISTS role TEXT DEFAULT ''ADMIN'';
        ', target_schema);

        -- If older column names exist in push_subscriptions, copy their data
        BEGIN
            EXECUTE format('
                UPDATE %I.push_subscriptions 
                SET p256dh = "p256dhKey" 
                WHERE (p256dh IS NULL OR p256dh = '''') AND "p256dhKey" IS NOT NULL;
            ', target_schema);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        BEGIN
            EXECUTE format('
                UPDATE %I.push_subscriptions 
                SET auth = "authKey" 
                WHERE (auth IS NULL OR auth = '''') AND "authKey" IS NOT NULL;
            ', target_schema);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        BEGIN
            EXECUTE format('
                UPDATE %I.push_subscriptions 
                SET role = "userRole" 
                WHERE role IS NULL AND "userRole" IS NOT NULL;
            ', target_schema);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

    END LOOP;
END $$;

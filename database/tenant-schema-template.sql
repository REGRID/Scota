-- =====================================================================
-- SCOTA AI - TENANT ISOLATED SCHEMA TEMPLATE (FASE 3: RLS ENABLED)
-- Schema template applied per tenant schema (e.g. tenant_00000000_...)
-- Contains tenant-isolated operational tables with search_path + RLS support
-- =====================================================================

-- 1. Table: receipts (Isolated to Tenant Schema)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "merchantName" TEXT NOT NULL DEFAULT 'Nota / Toko',
    date TEXT NOT NULL,
    "imageUrl" TEXT,
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT DEFAULT 'Cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Lunas',
    category TEXT DEFAULT 'Lain-lain',
    status TEXT NOT NULL DEFAULT 'completed',
    "staffName" TEXT DEFAULT 'Admin',
    "createdByName" TEXT DEFAULT 'Administrator',
    "createdByRole" TEXT DEFAULT 'ADMIN',
    "createdByUsername" TEXT,
    "confidenceScore" DOUBLE PRECISION DEFAULT 1.0,
    "processingTimeMs" INTEGER DEFAULT 0,
    "validationErrors" TEXT,
    notes TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "rawParsedText" TEXT,
    "posSynced" BOOLEAN NOT NULL DEFAULT false,
    "posSyncedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: receipt_items
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "receiptId" UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'Lain-lain',
    "subCategory" TEXT DEFAULT 'Umum',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: custom_categories
CREATE TABLE IF NOT EXISTS custom_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    "parentId" TEXT,
    color TEXT DEFAULT '#10b981',
    icon TEXT DEFAULT 'Tag',
    "monthlyBudget" DOUBLE PRECISION DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Table: pending_approvals
CREATE TABLE IF NOT EXISTS pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "receiptId" UUID REFERENCES receipts(id) ON DELETE SET NULL,
    "actionType" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    username TEXT,
    role TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    recipient TEXT NOT NULL,
    sender TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    "approvalId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for optimal per-tenant query speeds
CREATE INDEX IF NOT EXISTS idx_tenant_receipts_date ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_tenant_receipts_approval ON receipts("approvalStatus");
CREATE INDEX IF NOT EXISTS idx_tenant_receipt_items_rid ON receipt_items("receiptId");
CREATE INDEX IF NOT EXISTS idx_tenant_custom_cats_parent ON custom_categories("parentId");
CREATE INDEX IF NOT EXISTS idx_tenant_pending_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_tenant_notif_read ON notifications("isRead", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_notif_recipient ON notifications(recipient);

-- =====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Requires app.current_tenant_id OR app.is_superadmin = 'true'
-- =====================================================================

-- 1. receipts RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON receipts;
CREATE POLICY tenant_isolation ON receipts
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

-- 2. receipt_items RLS
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON receipt_items;
CREATE POLICY tenant_isolation ON receipt_items
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

-- 3. custom_categories RLS
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_categories;
CREATE POLICY tenant_isolation ON custom_categories
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

-- 4. pending_approvals RLS
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pending_approvals;
CREATE POLICY tenant_isolation ON pending_approvals
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

-- 5. push_subscriptions RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON push_subscriptions;
CREATE POLICY tenant_isolation ON push_subscriptions
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

-- 6. notifications RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );

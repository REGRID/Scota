-- =====================================================================
-- Migration 008: Add Pakasir Gateway columns to billing_transactions
-- 
-- Adds fields to support real-time third-party payment gateway tracking:
-- - orderId: Unique gateway order ID (e.g. SCOTA-20260909-XXXX)
-- - billingCycle: 'monthly' | 'yearly'
-- - pakasirFee: Gateway service fee
-- - totalPayment: Total amount to be paid (amount + fee)
-- - paymentNumber: QR string or Virtual Account number
-- - expiredAt: Expiration timestamp from gateway
-- - completedAt: Timestamp when payment completed
-- - checkoutUrl: URL for hosted checkout redirect
-- - webhookPayload: Raw webhook response payload for audit/debugging
-- =====================================================================

CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceNumber" TEXT UNIQUE NOT NULL,
    "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'starter',
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT DEFAULT 'Transfer Manual',
    "recordedBySuperadmin" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS "orderId" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "billingCycle" TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "pakasirFee" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPayment" NUMERIC,
  ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE billing_transactions
  ALTER COLUMN "recordedBySuperadmin" DROP NOT NULL;

ALTER TABLE billing_transactions
  ALTER COLUMN "recordedBySuperadmin" SET DEFAULT 'PAKASIR_GATEWAY';

CREATE INDEX IF NOT EXISTS idx_billing_order_id ON billing_transactions("orderId");
CREATE INDEX IF NOT EXISTS idx_billing_tenant_id ON billing_transactions("tenantId");
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_transactions(status);

-- =====================================================================
-- Migration 004: Create tenant_migration_log Table
-- Audit trail and progress tracker for Phase 4 tenant schema data migrations
-- =====================================================================

CREATE TABLE IF NOT EXISTS tenant_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "rowCounts" JSONB,
    status TEXT NOT NULL DEFAULT 'in_progress',
    "errorMessage" TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_tenant ON tenant_migration_log("tenantId", "startedAt" DESC);

COMMENT ON TABLE tenant_migration_log IS 'Records data copy progress, verified row counts, and status per tenant migration.';

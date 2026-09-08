-- =====================================================================
-- Migration 003: Add schemaMigrated Feature Flag to tenants Table
-- Default is false, guaranteeing 0 behavior change for existing tenants.
-- =====================================================================

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS "schemaMigrated" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants."schemaMigrated" IS 'Feature flag for Phase 2-4 schema-per-tenant isolation migration';

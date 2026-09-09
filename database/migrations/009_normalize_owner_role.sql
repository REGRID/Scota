-- ==============================================================================
-- Migration 009: Normalize Earliest Tenant Admin to OWNER
-- ==============================================================================
-- Purpose:
-- Fix legacy manual registration anomaly where the first account of a tenant
-- was assigned the 'ADMIN' role instead of 'OWNER'.
--
-- IMPORTANT:
-- DO NOT RUN THIS SCRIPT AUTOMATICALLY.
-- Run the Dry-Run SELECT query below first to inspect which records would be affected.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DRY-RUN INSPECTION QUERY (Run this first to audit affected rows)
-- ------------------------------------------------------------------------------
/*
SELECT 
    a.id, 
    a."tenantId", 
    t.name AS tenant_name, 
    a.username, 
    a.role AS current_role, 
    'OWNER' AS target_role, 
    a."createdAt"
FROM admin_accounts a
LEFT JOIN tenants t ON t.id = a."tenantId"
WHERE a.role = 'ADMIN'
  AND a.id = (
    SELECT b.id 
    FROM admin_accounts b 
    WHERE b."tenantId" = a."tenantId" 
    ORDER BY b."createdAt" ASC 
    LIMIT 1
  )
ORDER BY a."createdAt" ASC;
*/

-- ------------------------------------------------------------------------------
-- 2. SAFE UPDATE QUERY
-- ------------------------------------------------------------------------------
UPDATE admin_accounts a
SET role = 'OWNER',
    "updatedAt" = NOW()
WHERE a.role = 'ADMIN'
  AND a.id = (
    SELECT id 
    FROM admin_accounts b
    WHERE b."tenantId" = a."tenantId"
    ORDER BY b."createdAt" ASC
    LIMIT 1
  );

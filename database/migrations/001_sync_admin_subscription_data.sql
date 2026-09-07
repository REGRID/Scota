-- Migration: 001_sync_admin_subscription_data.sql
-- Purpose: Sinkronisasi data langganan antara tabel subscriptions dan admin_accounts (Fase 1 Hotfix)
-- Date: 2026-09-07

-- ==============================================================================
-- 1. DRY-RUN QUERY (Audit Data Sebelum Eksekusi):
-- Jalankan query SELECT ini terlebih dahulu untuk melihat berapa banyak akun yang
-- datanya tidak sinkron antara admin_accounts dan subscriptions.
-- ==============================================================================
/*
SELECT 
    a.username,
    a."tenantId",
    a.tier AS admin_tier,
    s.tier AS sub_tier,
    a."validUntil" AS admin_valid_until,
    s."validUntil" AS sub_valid_until,
    a."monthlyScanLimit" AS admin_scan_limit,
    s."monthlyScanLimit" AS sub_scan_limit,
    a."usedScansThisMonth" AS admin_used_scans,
    s."usedScansThisMonth" AS sub_used_scans
FROM admin_accounts a
JOIN subscriptions s ON a."tenantId" = s."tenantId"
WHERE a.tier IS DISTINCT FROM s.tier
   OR a."validUntil" IS DISTINCT FROM s."validUntil"
   OR a."monthlyScanLimit" IS DISTINCT FROM s."monthlyScanLimit"
   OR a."usedScansThisMonth" IS DISTINCT FROM s."usedScansThisMonth";
*/

-- ==============================================================================
-- 2. MIGRATION QUERY:
-- Menyelaraskan nilai tier, validUntil, monthlyScanLimit, dan usedScansThisMonth
-- pada admin_accounts agar 100% identik dengan tabel subscriptions (Single Source of Truth).
-- ==============================================================================
UPDATE admin_accounts a
SET tier = s.tier,
    "validUntil" = s."validUntil",
    "monthlyScanLimit" = s."monthlyScanLimit",
    "usedScansThisMonth" = s."usedScansThisMonth",
    "updatedAt" = NOW()
FROM subscriptions s
WHERE a."tenantId" = s."tenantId"
  AND (a.tier IS DISTINCT FROM s.tier
    OR a."validUntil" IS DISTINCT FROM s."validUntil"
    OR a."monthlyScanLimit" IS DISTINCT FROM s."monthlyScanLimit"
    OR a."usedScansThisMonth" IS DISTINCT FROM s."usedScansThisMonth");

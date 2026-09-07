-- Migration: 002_drop_subscription_columns_from_admin_accounts.sql
-- Purpose: Menghapus kolom redundan langganan dari tabel admin_accounts (Fase 2 - Single Source of Truth)
-- Target: Menjadikan tabel `subscriptions` sebagai satu-satunya sumber data status langganan tenant.
-- Date: 2026-09-07

-- ==============================================================================
-- 1. CATATAN KESELAMATAN SEBELUM EKSEKUSI:
-- Pastikan migrasi 001_sync_admin_subscription_data.sql sudah pernah dijalankan
-- dan database sudah dibackup sebelum menjalankan query DDL di bawah ini.
-- ==============================================================================

-- ==============================================================================
-- 2. DDL MIGRATION: Hapus kolom langganan dari admin_accounts
-- ==============================================================================
ALTER TABLE admin_accounts DROP COLUMN IF EXISTS tier;
ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "validUntil";
ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "monthlyScanLimit";
ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "usedScansThisMonth";

-- Migration 015: Account Personal CRM Identity & Business Identity Fields

-- 1. Personal Account Profile (CRM & Developer Marketing Identity)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "secondaryEmail" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "promoOptIn" BOOLEAN NOT NULL DEFAULT true;

-- 2. Tenant Business Profile (Store Branding, Legalities, & PDF Output)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "businessEmail" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.';

-- 3. Subscriptions mirror table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.';

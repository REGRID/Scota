-- =====================================================================
-- SCOTA AI / NOTA PHOTO - POSTGRESQL 16 DATABASE SCHEMA
-- Compatible with Standard PostgreSQL (Sumopod, Self-hosted VPS, Neon, Railway, Docker)
-- =====================================================================

-- Ensure pgcrypto extension is available for UUID generation (standard in Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table: receipts
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "merchantName" TEXT NOT NULL DEFAULT 'Nota / Toko',
    date TEXT NOT NULL,
    "imageUrl" TEXT,
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Lunas',
    note TEXT,
    "staffName" TEXT DEFAULT 'Admin',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: receipt_items
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "receiptId" UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Lain-lain',
    "subCategory" TEXT DEFAULT 'Umum',
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: scan_limits
CREATE TABLE IF NOT EXISTS scan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ipAddress" TEXT UNIQUE NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "resetAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Table: merchant_dictionaries
CREATE TABLE IF NOT EXISTS merchant_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rawPattern" TEXT UNIQUE NOT NULL,
    "cleanName" TEXT NOT NULL,
    "verifiedCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Table: product_dictionaries
CREATE TABLE IF NOT EXISTS product_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rawName" TEXT UNIQUE NOT NULL,
    "verifiedName" TEXT NOT NULL,
    category TEXT NOT NULL,
    "subCategory" TEXT DEFAULT 'Umum',
    "lastKnownPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verifiedCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Table: custom_categories
CREATE TABLE IF NOT EXISTS custom_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Table: pending_approvals
CREATE TABLE IF NOT EXISTS pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "receiptId" UUID REFERENCES receipts(id) ON DELETE CASCADE,
    "actionType" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payload TEXT NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Table: admin_accounts
CREATE TABLE IF NOT EXISTS admin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    "fullName" TEXT,
    "businessName" TEXT,
    phone TEXT,
    tier TEXT DEFAULT 'starter',
    "validUntil" TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
    "monthlyScanLimit" INTEGER DEFAULT 150,
    "usedScansThisMonth" INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Seed Accounts (1 Default Developer/Superadmin + 1 Default Admin + 1 Staff)
INSERT INTO admin_accounts (username, password, role, "fullName", "businessName")
VALUES 
    ('superadmin', 'superadmin2026!', 'SUPERADMIN', 'Developer / Superadmin', 'Scota Central Management'),
    ('admin', 'adminnota123', 'ADMIN', 'Administrator', 'Scota Business'),
    ('karyawan', 'StudioPhoto2026', 'KARYAWAN', 'Staff Kasir', 'Scota Business')
ON CONFLICT (username) DO NOTHING;

-- 9. Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier TEXT NOT NULL DEFAULT 'starter',
    "validUntil" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    "monthlyScanLimit" INTEGER NOT NULL DEFAULT 150,
    "usedScansThisMonth" INTEGER NOT NULL DEFAULT 0,
    "activeLicenseKey" TEXT,
    "studioName" TEXT NOT NULL DEFAULT 'Scota Business',
    tagline TEXT DEFAULT 'Digitalisasi Struk & Pengeluaran Usaha',
    address TEXT DEFAULT 'Jl. Bisnis No. 1, Jakarta',
    phone TEXT DEFAULT '0812-3456-7890',
    "logoUrl" TEXT,
    "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.',
    "taxNumber" TEXT,
    "approvalWorkflow" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Subscription Row
INSERT INTO subscriptions (tier, "studioName", "monthlyScanLimit", "usedScansThisMonth")
VALUES ('starter', 'Scota Business', 150, 0)
ON CONFLICT DO NOTHING;

-- 10. Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    username TEXT,
    role TEXT DEFAULT 'ALL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL DEFAULT 'all',
    sender TEXT,
    type TEXT NOT NULL DEFAULT 'INFO',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    "approvalId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items("receiptId");
CREATE INDEX IF NOT EXISTS idx_receipt_items_category ON receipt_items(category);
CREATE INDEX IF NOT EXISTS idx_scan_limits_ip ON scan_limits("ipAddress");
CREATE INDEX IF NOT EXISTS idx_merchant_dict_pattern ON merchant_dictionaries("rawPattern");
CREATE INDEX IF NOT EXISTS idx_product_dict_raw ON product_dictionaries("rawName");
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);

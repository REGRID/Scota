-- =====================================================================
-- SCOTA AI / NOTA PHOTO - POSTGRESQL 16 DATABASE SCHEMA
-- Compatible with Standard PostgreSQL (Sumopod, Self-hosted VPS, Neon, Railway, Docker)
-- Multi-Tenant Isolated Architecture
-- =====================================================================

-- Ensure pgcrypto extension is available for UUID generation (standard in Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Table: tenants (Multi-Tenant Business / Studio Entity)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessName" TEXT NOT NULL DEFAULT 'Scota Business',
    tagline TEXT DEFAULT 'Digitalisasi Struk & Pengeluaran Usaha',
    address TEXT DEFAULT 'Jl. Bisnis No. 1, Jakarta',
    phone TEXT DEFAULT '6285215973776',
    "logoUrl" TEXT,
    "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.',
    "taxNumber" TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Tenant Seed
INSERT INTO tenants (id, "businessName", tagline, address, phone, "invoiceFooter", status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Scota Business',
    'Digitalisasi Struk & Pengeluaran Usaha',
    'Jl. Bisnis No. 1, Jakarta',
    '6285215973776',
    'Terima kasih atas kerja sama Anda dengan usaha kami.',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- 1. Table: receipts
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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

-- 4. Table: merchant_dictionaries (Global OCR AI Knowledge)
CREATE TABLE IF NOT EXISTS merchant_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rawPattern" TEXT UNIQUE NOT NULL,
    "cleanName" TEXT NOT NULL,
    "verifiedCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Table: product_dictionaries (Global OCR AI Knowledge)
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
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Table: pending_approvals
CREATE TABLE IF NOT EXISTS pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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

-- Default Seed Accounts (Linked to default tenant)
INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, "tenantId")
VALUES 
    ('superadmin', '$2b$12$4ZzB5qjdn1Qp520cFqV3i.n5DwdT6WpORIkzT4iarhRKRLjkl.GTe', 'SUPERADMIN', 'Developer / Superadmin', 'Scota Central Management', '6285215973776', '00000000-0000-0000-0000-000000000001'),
    ('admin', '$2b$12$6ox9jnEHW.KPZwkeOPj2f.ze8K3prlzSYC3stGdL1uKzLbpuOdOgO', 'ADMIN', 'Administrator', 'Scota Business', '6285215973776', '00000000-0000-0000-0000-000000000001'),
    ('karyawan', '$2b$12$9D45oONPISU9wTC9xXNSZe0xsakBFUAatLasEQL.3fpYQWE6TP.J6', 'KARYAWAN', 'Staff Kasir', 'Scota Business', '6285215973776', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (username) DO NOTHING;

-- 9. Table: subscriptions (1 baris per tenant)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID UNIQUE REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
    tier TEXT NOT NULL DEFAULT 'starter',
    "validUntil" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    "monthlyScanLimit" INTEGER NOT NULL DEFAULT 150,
    "usedScansThisMonth" INTEGER NOT NULL DEFAULT 0,
    "activeLicenseKey" TEXT,
    "studioName" TEXT NOT NULL DEFAULT 'Scota Business',
    tagline TEXT DEFAULT 'Digitalisasi Struk & Pengeluaran Usaha',
    address TEXT DEFAULT 'Jl. Bisnis No. 1, Jakarta',
    phone TEXT DEFAULT '6285215973776',
    "logoUrl" TEXT,
    "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.',
    "taxNumber" TEXT,
    "approvalWorkflow" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Subscription Row for Default Tenant
INSERT INTO subscriptions ("tenantId", tier, "studioName", "monthlyScanLimit", "usedScansThisMonth")
VALUES ('00000000-0000-0000-0000-000000000001', 'starter', 'Scota Business', 150, 0)
ON CONFLICT ("tenantId") DO NOTHING;

-- 10. Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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
    "tenantId" UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
    recipient TEXT NOT NULL DEFAULT 'all',
    sender TEXT,
    type TEXT NOT NULL DEFAULT 'INFO',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    "approvalId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Table: password_resets (Untuk OTP Verifikasi WhatsApp & Reset Password)
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    phone TEXT,
    "otpCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Indexes for High Performance Queries & Tenant Scoping
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts("tenantId");
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items("receiptId");
CREATE INDEX IF NOT EXISTS idx_receipt_items_category ON receipt_items(category);
CREATE INDEX IF NOT EXISTS idx_scan_limits_ip ON scan_limits("ipAddress");
CREATE INDEX IF NOT EXISTS idx_merchant_dict_pattern ON merchant_dictionaries("rawPattern");
CREATE INDEX IF NOT EXISTS idx_product_dict_raw ON product_dictionaries("rawName");
CREATE INDEX IF NOT EXISTS idx_admin_accounts_tenant ON admin_accounts("tenantId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions("tenantId");
CREATE INDEX IF NOT EXISTS idx_custom_categories_tenant ON custom_categories("tenantId");
CREATE INDEX IF NOT EXISTS idx_pending_approvals_tenant ON pending_approvals("tenantId");
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications("tenantId");
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(username);
CREATE INDEX IF NOT EXISTS idx_password_resets_otp ON password_resets("otpCode");

-- Migration 004: Dynamic Roles, Granular Permissions, Multi-Tenant Grants & Tenant Features (Spec 4)

-- 1. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'SINGLE_TENANT', -- 'SINGLE_TENANT' | 'MULTI_TENANT'
  "requiresApproval" BOOLEAN NOT NULL DEFAULT FALSE,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role_scope CHECK (scope IN ('SINGLE_TENANT', 'MULTI_TENANT')),
  CONSTRAINT uq_tenant_role_name UNIQUE ("tenantId", name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles("tenantId");

-- 2. Permissions table (system-wide fixed dictionary)
CREATE TABLE IF NOT EXISTS permissions (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  "isOwnerOnly" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert standard permissions
INSERT INTO permissions (code, name, description, "isOwnerOnly")
VALUES
  ('scan_receipt', 'Scan Nota & Struk', 'Melakukan pemindaian OCR nota dan struk pengeluaran usaha.', FALSE),
  ('view_reports', 'Lihat Laporan Keuangan', 'Melihat ringkasan laporan kas dan pengeluaran.', FALSE),
  ('export_reports', 'Ekspor Laporan', 'Mengunduh rekap laporan dalam format Excel atau PDF.', FALSE),
  ('manage_staff', 'Kelola Staf', 'Membuat tautan undangan, melihat daftar anggota, dan mengelola staf.', FALSE),
  ('manage_pos_stock', 'Kelola POS & Stok', 'Sinkronisasi penjualan kasir dan pengaturan stok gudang.', FALSE),
  ('view_all_branches', 'Pantau Lintas Cabang', 'Melihat ringkasan kinerja dari beberapa cabang yang diotorisasi.', FALSE),
  ('delete_tenant', 'Hapus Toko / Cabang', 'Menghapus permanen profil toko atau cabang usaha.', TRUE),
  ('transfer_ownership', 'Transfer Kepemilikan', 'Memindahkan hak kepemilikan toko ke akun lain.', TRUE),
  ('manage_billing', 'Kelola Langganan & Tagihan', 'Mengubah paket langganan dan melakukan pembayaran lisensi.', TRUE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, "isOwnerOnly" = EXCLUDED."isOwnerOnly";

-- 3. Role Permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  "roleId" UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  "permissionCode" VARCHAR(50) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("roleId", "permissionCode")
);

-- 4. Multi-Tenant Access Grants table (Bab 3 & Bab 4.1)
CREATE TABLE IF NOT EXISTS tenant_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'PENDING_APPROVAL'
  "grantedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_grant_status CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL')),
  CONSTRAINT uq_tenant_user_grant UNIQUE ("tenantId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_grants_tenant ON tenant_access_grants("tenantId");
CREATE INDEX IF NOT EXISTS idx_grants_user ON tenant_access_grants("userId");

-- 5. Tenant Features table (Bab 12)
CREATE TABLE IF NOT EXISTS tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "featureKey" VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_feature UNIQUE ("tenantId", "featureKey")
);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features("tenantId");

-- 6. Alter memberships, membership_history, and invite_links to reference roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memberships' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE memberships ADD COLUMN "roleId" UUID REFERENCES roles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'membership_history' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE membership_history ADD COLUMN "roleId" UUID REFERENCES roles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'membership_history' AND column_name = 'sourceTable'
  ) THEN
    ALTER TABLE membership_history ADD COLUMN "sourceTable" VARCHAR(20) NOT NULL DEFAULT 'MEMBERSHIP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invite_links' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE invite_links ADD COLUMN "roleId" UUID REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END $$;

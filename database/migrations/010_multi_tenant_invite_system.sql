-- ==============================================================================
-- Migration 010: Multi-Tenant Invite Links & Staff Google Membership System
-- ==============================================================================

-- 1. Extend tenants table with ownerId
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "ownerId" UUID;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Create users table (Global User Identity)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clerkId" TEXT UNIQUE,
    "googleId" TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_clerk ON users("clerkId");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 3. Create memberships table (Strict Staff-to-Tenant Binding)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'KARYAWAN',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_memberships_user UNIQUE ("userId")
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships("tenantId");
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships("userId");

-- 4. Create invite_links table (Invitations to join a tenant with predetermined role)
CREATE TABLE IF NOT EXISTS invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'KARYAWAN',
    token TEXT UNIQUE NOT NULL,
    "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_tenant ON invite_links("tenantId");

-- 5. Create invite_usages table (Audit trail of who used which invite link)
CREATE TABLE IF NOT EXISTS invite_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "inviteLinkId" UUID NOT NULL REFERENCES invite_links(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "usedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_usages_link ON invite_usages("inviteLinkId");
CREATE INDEX IF NOT EXISTS idx_invite_usages_user ON invite_usages("userId");

-- 6. Add Foreign Key on tenants.ownerId -> users.id if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenants_owner'
    ) THEN
        ALTER TABLE tenants
        ADD CONSTRAINT fk_tenants_owner
        FOREIGN KEY ("ownerId") REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. Backfill existing Owner accounts from admin_accounts into users & tenants.ownerId
DO $$
DECLARE
    r RECORD;
    v_user_id UUID;
    v_email TEXT;
BEGIN
    FOR r IN 
        SELECT id, "tenantId", username, email, "fullName", "clerkId", "googleId"
        FROM admin_accounts
        WHERE role = 'OWNER' AND "tenantId" IS NOT NULL
        ORDER BY "createdAt" ASC
    LOOP
        v_email := COALESCE(r.email, r.username || '@scota.local');
        
        -- Upsert into users
        INSERT INTO users ("clerkId", "googleId", email, name, "createdAt", "updatedAt")
        VALUES (r."clerkId", r."googleId", v_email, COALESCE(r."fullName", r.username), NOW(), NOW())
        ON CONFLICT (email) DO UPDATE 
        SET "clerkId" = COALESCE(EXCLUDED."clerkId", users."clerkId"),
            "updatedAt" = NOW()
        RETURNING id INTO v_user_id;

        -- Update tenant ownerId if not already set
        UPDATE tenants 
        SET "ownerId" = v_user_id
        WHERE id = r."tenantId" AND "ownerId" IS NULL;
    END LOOP;
END $$;

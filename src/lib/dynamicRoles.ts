import { queryPg, withTransactionPg } from "@/lib/pgDb"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

export interface PermissionItem {
  code: string
  name: string
  description: string | null
  isOwnerOnly: boolean
}

export interface RoleWithPermissions {
  id: string
  tenantId: string
  name: string
  scope: "SINGLE_TENANT" | "MULTI_TENANT"
  requiresApproval: boolean
  isSystemDefault: boolean
  createdAt: string
  permissions: string[]
}

export interface TenantFeaturesMap {
  multi_tenant_roles: boolean
  custom_permissions: boolean
  custom_roles: boolean
  ownership_transfer: boolean
}

/**
 * Minimum tier required to enable each feature flag.
 * Source of truth: centralized in this map.
 */
export const FEATURE_MIN_TIER: Record<keyof TenantFeaturesMap, SubscriptionTier> = {
  multi_tenant_roles: "enterprise", // "Dukungan Multi-Cabang & Multi-Usaha"
  custom_permissions: "enterprise",
  custom_roles: "pro",              // Custom roles available starting from Pro tier
  ownership_transfer: "enterprise",
}

export const TIER_RANK: Record<SubscriptionTier, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
  developer: 99,
}

export function tierMeetsMinimum(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return (TIER_RANK[currentTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0)
}

/**
 * Fetch all available permissions in the system.
 */
export async function getAllPermissions(): Promise<PermissionItem[]> {
  const res = await queryPg<PermissionItem>(
    `SELECT code, name, description, "isOwnerOnly" FROM permissions ORDER BY "isOwnerOnly" ASC, code ASC`
  )
  return res.rows || []
}

/**
 * Fetch all roles belonging to a tenant, including assigned permission codes.
 */
export async function getTenantRoles(tenantId: string): Promise<RoleWithPermissions[]> {
  const rolesRes = await queryPg<{
    id: string
    tenantId: string
    name: string
    scope: "SINGLE_TENANT" | "MULTI_TENANT"
    requiresApproval: boolean
    isSystemDefault: boolean
    createdAt: string
  }>(
    `SELECT id, "tenantId", name, scope, "requiresApproval", "isSystemDefault", "createdAt"
     FROM roles
     WHERE "tenantId" = $1
     ORDER BY "isSystemDefault" DESC, "createdAt" ASC`,
    [tenantId]
  )

  const roles = rolesRes.rows || []
  if (roles.length === 0) return []

  const permsRes = await queryPg<{ roleId: string; permissionCode: string }>(
    `SELECT "roleId", "permissionCode"
     FROM role_permissions
     WHERE "roleId" = ANY($1::uuid[])`,
    [roles.map((r) => r.id)]
  )

  const permMap = new Map<string, string[]>()
  for (const p of permsRes.rows || []) {
    if (!permMap.has(p.roleId)) permMap.set(p.roleId, [])
    permMap.get(p.roleId)!.push(p.permissionCode)
  }

  return roles.map((r) => ({
    ...r,
    permissions: permMap.get(r.id) || [],
  }))
}

/**
 * Create a new custom role for a tenant.
 * Enforces Bab 11.6: Owner-only permissions can NEVER be granted to a custom role.
 */
export async function createTenantRole(
  tenantId: string,
  createdBy: string | null,
  data: {
    name: string
    scope?: "SINGLE_TENANT" | "MULTI_TENANT"
    requiresApproval?: boolean
    permissionCodes?: string[]
  }
): Promise<{ success: boolean; role?: RoleWithPermissions; error?: string }> {
  const name = (data.name || "").trim()
  const scope = data.scope || "SINGLE_TENANT"
  const requiresApproval = !!data.requiresApproval
  const permissionCodes = data.permissionCodes || []

  if (!name || name.length < 2) {
    return { success: false, error: "Nama peran wajib diisi minimal 2 karakter." }
  }

  // Bab 11.6: Reject any owner-only permissions
  const ownerOnlyCheck = await queryPg<{ code: string }>(
    `SELECT code FROM permissions WHERE code = ANY($1::text[]) AND "isOwnerOnly" = TRUE`,
    [permissionCodes]
  )
  if ((ownerOnlyCheck.rows || []).length > 0) {
    const forbidden = ownerOnlyCheck.rows.map((r) => r.code).join(", ")
    return {
      success: false,
      error: `Izin berikut hanya boleh dipegang oleh Pemilik Toko (Owner) dan tidak dapat diberikan ke peran staf: ${forbidden}.`,
    }
  }

  return withTransactionPg(async (client) => {
    // Check if role name already exists in this tenant
    const existing = await client.query(
      `SELECT id FROM roles WHERE "tenantId" = $1 AND LOWER(name) = LOWER($2)`,
      [tenantId, name]
    )
    if ((existing.rows || []).length > 0) {
      return { success: false, error: `Peran dengan nama '${name}' sudah ada di cabang ini.` }
    }

    // Insert role
    const insertRes = await client.query(
      `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, FALSE, $5, NOW(), NOW())
       RETURNING id, "tenantId", name, scope, "requiresApproval", "isSystemDefault", "createdAt"`,
      [tenantId, name, scope, requiresApproval, createdBy]
    )

    const createdRole = insertRes.rows[0] as {
      id: string
      tenantId: string
      name: string
      scope: "SINGLE_TENANT" | "MULTI_TENANT"
      requiresApproval: boolean
      isSystemDefault: boolean
      createdAt: string
    }

    // Insert permissions
    if (permissionCodes.length > 0) {
      for (const code of permissionCodes) {
        await client.query(
          `INSERT INTO role_permissions ("roleId", "permissionCode")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [createdRole.id, code]
        )
      }
    }

    return {
      success: true,
      role: {
        ...createdRole,
        permissions: permissionCodes,
      },
    }
  })
}

/**
 * Fetch feature flags for a tenant.
 */
export async function getTenantFeatures(tenantId: string): Promise<TenantFeaturesMap> {
  const res = await queryPg<{ featureKey: string; enabled: boolean }>(
    `SELECT "featureKey", enabled FROM tenant_features WHERE "tenantId" = $1`,
    [tenantId]
  )

  const defaults: TenantFeaturesMap = {
    multi_tenant_roles: false,
    custom_permissions: false,
    custom_roles: false,
    ownership_transfer: false,
  }

  for (const row of res.rows || []) {
    if (row.featureKey in defaults) {
      defaults[row.featureKey as keyof TenantFeaturesMap] = !!row.enabled
    }
  }

  return defaults
}

/**
 * Set feature flag for a tenant with tier requirement validation when enabling,
 * and data integrity validation when disabling (Bab 11.7).
 */
export async function setTenantFeature(
  tenantId: string,
  featureKey: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!(featureKey in FEATURE_MIN_TIER)) {
    return { success: false, error: "Nama fitur tidak dikenali." }
  }

  // 1. Validasi tier langganan sebelum mengizinkan fitur DIAKTIFKAN
  if (enabled) {
    const tenantRes = await queryPg<{ tier: SubscriptionTier }>(
      `SELECT s.tier FROM subscriptions s WHERE s."tenantId" = $1 LIMIT 1`,
      [tenantId]
    )
    const currentTier = tenantRes.rows?.[0]?.tier || "trial"
    const requiredTier = FEATURE_MIN_TIER[featureKey as keyof TenantFeaturesMap]

    if (!tierMeetsMinimum(currentTier, requiredTier)) {
      const requiredTierName = TIER_CONFIG[requiredTier]?.name || requiredTier
      const currentTierName = TIER_CONFIG[currentTier]?.name || currentTier
      return {
        success: false,
        error: `Fitur ini memerlukan paket ${requiredTierName} atau lebih tinggi. Paket Anda saat ini: ${currentTierName}. Silakan upgrade paket Anda untuk mengaktifkan fitur ini.`,
      }
    }
  }

  // 2. Bab 11.7: Validasi saat MENONAKTIFKAN fitur (selalu diizinkan tanpa cek tier)
  if (!enabled) {
    if (featureKey === "multi_tenant_roles") {
      const grantCheck = await queryPg<{ count: string }>(
        `SELECT COUNT(*) as count FROM tenant_access_grants WHERE "tenantId" = $1`,
        [tenantId]
      )
      const activeGrantsCount = parseInt(grantCheck.rows?.[0]?.count || "0", 10)
      if (activeGrantsCount > 0) {
        return {
          success: false,
          error: `Tidak dapat mematikan fitur peran multi-tenant: masih ada ${activeGrantsCount} staf aktif yang memegang peran lintas cabang. Harap hapus atau ubah peran mereka ke single-tenant terlebih dahulu.`,
        }
      }
    }
  }

  await queryPg(
    `INSERT INTO tenant_features ("tenantId", "featureKey", enabled, "updatedAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("tenantId", "featureKey") DO UPDATE SET enabled = $3, "updatedAt" = NOW()`,
    [tenantId, featureKey, enabled]
  )

  return { success: true }
}

/**
 * Fitur efektif yang BENAR-BENAR aktif untuk tenant -- mempertimbangkan baik flag di
 * tenant_features MAUPUN tier langganan saat ini.
 * Jika tier langganan turun (downgrade/expired), fitur otomatis nonaktif secara efektif.
 */
export async function getEffectiveTenantFeatures(tenantId: string): Promise<TenantFeaturesMap> {
  const [flags, tenantRes] = await Promise.all([
    getTenantFeatures(tenantId),
    queryPg<{ tier: SubscriptionTier }>(`SELECT tier FROM subscriptions WHERE "tenantId" = $1 LIMIT 1`, [tenantId]),
  ])

  const currentTier = tenantRes.rows?.[0]?.tier || "trial"

  if (currentTier === "developer") {
    return {
      multi_tenant_roles: true,
      custom_permissions: true,
      custom_roles: true,
      ownership_transfer: true,
    }
  }

  const effective: TenantFeaturesMap = { ...flags }
  for (const key of Object.keys(FEATURE_MIN_TIER) as (keyof TenantFeaturesMap)[]) {
    if (effective[key] && !tierMeetsMinimum(currentTier, FEATURE_MIN_TIER[key])) {
      effective[key] = false
    }
  }
  return effective
}

/**
 * Auto-seed default role templates for a newly created tenant.
 * Note: Seeds ONLY the role templates (Kasir, Karyawan, Admin) in the roles table.
 * DOES NOT CREATE DUMMY STAFF OR EMPLOYEES!
 */
export async function seedDefaultRolesForTenant(tenantId: string, client?: any): Promise<void> {
  const runner = client ? client.query.bind(client) : queryPg

  // 1. Kasir
  const kasir = await runner(
    `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
     VALUES ($1, 'Kasir', 'SINGLE_TENANT', FALSE, TRUE)
     ON CONFLICT ("tenantId", name) DO NOTHING
     RETURNING id`,
    [tenantId]
  )
  const kasirId = kasir.rows?.[0]?.id
  if (kasirId) {
    await runner(
      `INSERT INTO role_permissions ("roleId", "permissionCode")
       VALUES ($1, 'scan_receipt'), ($1, 'manage_pos_stock')
       ON CONFLICT DO NOTHING`,
      [kasirId]
    )
  }

  // 2. Karyawan
  const karyawan = await runner(
    `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
     VALUES ($1, 'Karyawan', 'SINGLE_TENANT', FALSE, TRUE)
     ON CONFLICT ("tenantId", name) DO NOTHING
     RETURNING id`,
    [tenantId]
  )
  const karyawanId = karyawan.rows?.[0]?.id
  if (karyawanId) {
    await runner(
      `INSERT INTO role_permissions ("roleId", "permissionCode")
       VALUES ($1, 'scan_receipt')
       ON CONFLICT DO NOTHING`,
      [karyawanId]
    )
  }

  // 3. Admin (Requires approval by default)
  const admin = await runner(
    `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
     VALUES ($1, 'Admin', 'SINGLE_TENANT', TRUE, TRUE)
     ON CONFLICT ("tenantId", name) DO NOTHING
     RETURNING id`,
    [tenantId]
  )
  const adminId = admin.rows?.[0]?.id
  if (adminId) {
    await runner(
      `INSERT INTO role_permissions ("roleId", "permissionCode")
       VALUES 
         ($1, 'scan_receipt'), 
         ($1, 'view_reports'), 
         ($1, 'export_reports'), 
         ($1, 'manage_staff'), 
         ($1, 'manage_pos_stock')
       ON CONFLICT DO NOTHING`,
      [adminId]
    )
  }

  // 4. Default features off
  const features = ["multi_tenant_roles", "custom_permissions", "custom_roles", "ownership_transfer"]
  for (const feat of features) {
    await runner(
      `INSERT INTO tenant_features ("tenantId", "featureKey", enabled)
       VALUES ($1, $2, FALSE)
       ON CONFLICT ("tenantId", "featureKey") DO NOTHING`,
      [tenantId, feat]
    )
  }
}

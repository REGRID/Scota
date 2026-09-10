import { queryPg } from "@/lib/pgDb"

export type RoleLockCheckResult = {
  allowed: boolean
  reason?: string
  currentRoleType?: "OWNER" | "SINGLE_TENANT_STAFF" | "MULTI_TENANT_GRANTEE" | "NONE"
}

/**
 * Centralized cross-role lock validation (Bab 4.1 & Bab 11.5)
 * Enforces mutual exclusivity between Owner, Single-Tenant Staff, and Multi-Tenant Grantee.
 *
 * @param userId - Target user ID to inspect
 * @param targetAction - What the user is trying to become:
 *                       - 'OWNER': Creating/registering a new tenant as Owner
 *                       - 'SINGLE_TENANT': Joining a tenant as single-tenant staff (memberships)
 *                       - 'MULTI_TENANT': Receiving a multi-tenant access grant (tenant_access_grants)
 * @param targetTenantId - Optional: The specific tenant ID being joined
 */
export async function cekBolehAmbilPeranBaru(
  userId: string,
  targetAction: "OWNER" | "SINGLE_TENANT" | "MULTI_TENANT",
  targetTenantId?: string
): Promise<RoleLockCheckResult> {
  if (!userId) {
    return { allowed: false, reason: "ID pengguna tidak valid.", currentRoleType: "NONE" }
  }

  // 1. Check if user is already an Owner
  const ownedRes = await queryPg<{ id: string; name: string }>(
    `SELECT id, "businessName" as name FROM tenants WHERE "ownerId" = $1 LIMIT 5`,
    [userId]
  )
  const isOwner = (ownedRes.rows || []).length > 0

  if (isOwner) {
    if (targetAction === "OWNER") {
      // Owner is allowed to own multiple branches (Prinsip #4)
      return { allowed: true, currentRoleType: "OWNER" }
    }
    return {
      allowed: false,
      reason: "Akun Anda saat ini terdaftar sebagai Pemilik Toko (Owner). Sesuai kebijakan sistem, Pemilik Toko tidak dapat merangkap sebagai staf di toko manapun.",
      currentRoleType: "OWNER",
    }
  }

  // 2. Check if user is already an active Single-Tenant staff
  const memRes = await queryPg<{ id: string; tenantId: string; role: string }>(
    `SELECT id, "tenantId", role FROM memberships WHERE "userId" = $1 LIMIT 1`,
    [userId]
  )
  const activeMembership = memRes.rows?.[0]

  if (activeMembership) {
    if (targetAction === "SINGLE_TENANT" && targetTenantId && activeMembership.tenantId === targetTenantId) {
      return {
        allowed: false,
        reason: "Anda sudah menjadi anggota staf aktif di cabang toko ini.",
        currentRoleType: "SINGLE_TENANT_STAFF",
      }
    }
    return {
      allowed: false,
      reason: "Akun Anda sudah terdaftar sebagai staf aktif di sebuah toko. Sesuai kebijakan Scota, satu akun staf hanya dapat terhubung ke satu toko dalam satu waktu.",
      currentRoleType: "SINGLE_TENANT_STAFF",
    }
  }

  // 3. Check if user already holds Multi-Tenant Access Grants
  const grantsRes = await queryPg<{ id: string; tenantId: string }>(
    `SELECT id, "tenantId" FROM tenant_access_grants WHERE "userId" = $1`,
    [userId]
  )
  const activeGrants = grantsRes.rows || []

  if (activeGrants.length > 0) {
    if (targetAction === "MULTI_TENANT") {
      // Check if already has grant in this specific tenant
      if (targetTenantId && activeGrants.some((g) => g.tenantId === targetTenantId)) {
        return {
          allowed: false,
          reason: "Anda sudah memiliki akses multi-tenant di cabang ini.",
          currentRoleType: "MULTI_TENANT_GRANTEE",
        }
      }
      // Allowed to hold grants across multiple different branches (Prinsip #7)
      return { allowed: true, currentRoleType: "MULTI_TENANT_GRANTEE" }
    }

    return {
      allowed: false,
      reason: "Akun Anda saat ini memegang peran Multi-Tenant (lintas-cabang). Anda tidak dapat menjadi Pemilik Toko atau staf single-tenant selama memegang peran ini.",
      currentRoleType: "MULTI_TENANT_GRANTEE",
    }
  }

  // 4. User has no active roles in the system - completely free
  return { allowed: true, currentRoleType: "NONE" }
}

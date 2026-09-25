import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export interface TenantUserSummary {
  userCount: number
  hasMultipleUsers: boolean
}

/**
 * Returns the total active users for a tenant (admin_accounts + memberships)
 * and whether the tenant has more than 1 user.
 */
export async function getTenantUserSummary(tenantId: string): Promise<TenantUserSummary> {
  if (!isDatabaseConfigured || !tenantId) {
    return { userCount: 1, hasMultipleUsers: false }
  }

  try {
    const res = await queryPg<{ total_users: string }>(
      `SELECT (
        (SELECT COUNT(DISTINCT username) FROM admin_accounts WHERE "tenantId" = $1 AND status != 'suspended')
        +
        (SELECT COUNT(DISTINCT "userId") FROM memberships WHERE "tenantId" = $1 AND status = 'ACTIVE')
      ) as total_users`,
      [tenantId]
    )

    const rawCount = parseInt(res.rows?.[0]?.total_users || "1", 10)
    const userCount = Math.max(1, isNaN(rawCount) ? 1 : rawCount)
    return {
      userCount,
      hasMultipleUsers: userCount > 1,
    }
  } catch (err) {
    console.warn("[getTenantUserSummary] Notice:", err)
    return { userCount: 1, hasMultipleUsers: false }
  }
}

import { queryPg, isDatabaseConfigured, withTransactionPg } from "@/lib/pgDb"
import { TIER_CONFIG, SubscriptionTier, ApprovalWorkflowConfig, DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"
import { getUserAccountDetails, updateAdminPassword } from "@/lib/adminAccounts"
import { hashPassword } from "@/lib/password"
import { DEFAULT_TENANT_ID } from "@/lib/session"

/**
 * Check whether a given username has Superadmin / Platform Owner / Developer privileges.
 * 100% dynamic: checks against environment variables and database role.
 */
export async function isSuperadminUser(username: string): Promise<boolean> {
  const clean = (username || "").trim().toLowerCase()
  if (!clean || clean.startsWith("demo_")) return false

  const envSuperadmins = [
    process.env.SUPERADMIN_USERNAME || "superadmin",
    process.env.DEVELOPER_USERNAME || "developer",
  ].map((u) => u.trim().toLowerCase())

  if (envSuperadmins.includes(clean)) return true

  try {
    const account = await getUserAccountDetails(clean)
    if (account && (account.role === "SUPERADMIN" || account.role === "DEVELOPER")) {
      return true
    }
  } catch (err) {
    console.warn("isSuperadminUser check notice:", err)
  }

  return false
}

export interface TenantSummary {
  id?: string
  tenantId?: string
  username: string
  fullName?: string
  businessName?: string
  phone?: string
  role: string
  tier: SubscriptionTier
  validUntil: string
  monthlyScanLimit: number
  usedScansThisMonth: number
  createdAt: string
  status: "active" | "expired" | "trial" | "suspended"
  totalReceiptsCount?: number
  totalReceiptsAmount?: number
  totalUsersCount?: number
  approvalWorkflow?: ApprovalWorkflowConfig
}

export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  totalReceipts: number
  totalSubscriptionRevenue: number
  monthlyRecurringRevenue: number
  paidTenantsCount: number
  tierBreakdown: {
    trial: number
    starter: number
    pro: number
    enterprise: number
    developer?: number
  }
  recentRegistrations: TenantSummary[]
  expiringSoonTenants: TenantSummary[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  superadmin: string
  action: string
  targetTenant: string
  detail: string
  ipAddress?: string
}

export interface BillingTransaction {
  id: string
  tenantUsername: string
  businessName: string
  tier: SubscriptionTier
  amount: number
  status: "lunas" | "pending" | "gagal"
  paymentMethod: string
  date: string
  invoiceNumber: string
}

/**
 * Fetch list of all registered business tenants
 */
export async function getAllTenants(): Promise<TenantSummary[]> {
  const tenantsMap = new Map<string, TenantSummary>()

  // 1. Primary Source of Truth: PostgreSQL Registered Tenants, Subscriptions, Admin Accounts, and Users
  if (isDatabaseConfigured) {
    try {
      const tenantsRes = await queryPg<any>(
        `SELECT t.id as "tenantId", t."businessName", t.phone as "tenantPhone", t.status as "tenantStatus", t."createdAt",
                s.tier as "subTier", s.status as "subStatus", s."validUntil" as "subValidUntil",
                s."monthlyScanLimit" as "subScanLimit", s."usedScansThisMonth" as "subUsedScans",
                s."approvalWorkflow",
                a.username as "adminUsername", a.email as "adminEmail", a."fullName" as "adminFullName", a.role as "adminRole", a.status as "adminStatus",
                u.email as "userEmail", u.name as "userName", u."clerkId", u.phone as "userPhone"
         FROM tenants t
         LEFT JOIN subscriptions s ON t.id = s."tenantId"
         LEFT JOIN admin_accounts a ON t.id = a."tenantId"
         LEFT JOIN users u ON t."ownerId" = u.id
         WHERE t."isDemo" = false OR t."isDemo" IS NULL
         ORDER BY t."createdAt" DESC`
      )

      if (tenantsRes.rows) {
        for (const row of tenantsRes.rows) {
          const tenantId = row.tenantId
          const email = (row.userEmail || row.adminEmail || "").toLowerCase().trim()
          const rawUser = email || row.adminUsername || `tenant_${tenantId.slice(0, 8)}`
          const usernameKey = rawUser.toLowerCase().trim()

          const masterEmail = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()
          const isSuperadminAccount =
            email === masterEmail ||
            row.adminRole === "SUPERADMIN" ||
            row.adminRole === "DEVELOPER" ||
            row.adminUsername === "superadmin" ||
            row.adminUsername === "developer" ||
            row.subTier === "developer"

          const tier = (isSuperadminAccount ? "developer" : (row.subTier || "trial")) as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
          const validDate = isSuperadminAccount
            ? new Date("2099-12-31T23:59:59.999Z")
            : new Date(row.subValidUntil || Date.now() + 14 * 24 * 60 * 60 * 1000)
          const isExpired = !isSuperadminAccount && validDate < new Date()

          const isSuspended =
            row.tenantStatus === "suspended" ||
            row.subStatus === "suspended" ||
            row.adminStatus === "suspended"

          let status: "active" | "expired" | "trial" | "suspended" = "active"
          if (isSuspended) {
            status = "suspended"
          } else if (isSuperadminAccount) {
            status = "active"
          } else if (isExpired) {
            status = "expired"
          } else if (tier === "trial") {
            status = "trial"
          } else {
            status = "active"
          }

          let workflow: ApprovalWorkflowConfig = { ...DEFAULT_APPROVAL_WORKFLOW }
          if (row.approvalWorkflow) {
            try {
              const parsed =
                typeof row.approvalWorkflow === "string"
                  ? JSON.parse(row.approvalWorkflow)
                  : row.approvalWorkflow
              workflow = { ...DEFAULT_APPROVAL_WORKFLOW, ...parsed }
            } catch (e) {}
          }

          const fullName = row.userName || row.adminFullName || row.businessName || usernameKey
          const businessName = row.businessName || `Bisnis ${fullName}`

          tenantsMap.set(tenantId, {
            id: tenantId,
            tenantId,
            username: usernameKey,
            fullName,
            businessName,
            phone: row.tenantPhone || row.userPhone || "",
            role: row.adminRole || "OWNER",
            tier,
            validUntil: row.subValidUntil
              ? new Date(row.subValidUntil).toISOString()
              : validDate.toISOString(),
            monthlyScanLimit: row.subScanLimit || tierCfg.monthlyScanLimit,
            usedScansThisMonth: row.subUsedScans || 0,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            status,
            approvalWorkflow: workflow,
          })
        }
      }

      // Also check standalone admin_accounts without tenant or legacy
      const accRes = await queryPg<any>(
        `SELECT a.id, a.username, a.role, a."fullName", a."businessName", a.phone, a.email, a.status, a."createdAt",
                a."tenantId",
                s.tier as "subTier",
                s.status as "subStatus",
                s."validUntil" as "subValidUntil",
                s."monthlyScanLimit" as "subScanLimit",
                s."usedScansThisMonth" as "subUsedScans"
         FROM admin_accounts a
         LEFT JOIN subscriptions s ON a."tenantId" = s."tenantId"
         ORDER BY a."createdAt" DESC`
      )

      if (accRes.rows) {
        for (const acc of accRes.rows) {
          const tenantId = acc.tenantId || acc.id
          if (tenantsMap.has(tenantId)) continue

          const email = (acc.email || "").toLowerCase().trim()
          const usernameKey = email || (acc.username || "").toLowerCase().trim()
          if (!usernameKey) continue

          const tier = (acc.subTier || acc.tier || "starter") as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
          const validDate = new Date(acc.subValidUntil || acc.validUntil || Date.now() + 14 * 24 * 60 * 60 * 1000)
          const isExpired = validDate < new Date()
          const isSuspended = acc.status === "suspended" || acc.subStatus === "suspended"

          let status: "active" | "expired" | "trial" | "suspended" = "active"
          if (isSuspended) status = "suspended"
          else if (isExpired) status = "expired"
          else if (tier === "trial") status = "trial"

          tenantsMap.set(tenantId, {
            id: tenantId,
            tenantId,
            username: usernameKey,
            fullName: acc.fullName || usernameKey,
            businessName: acc.businessName || "Scota Business",
            phone: acc.phone || "",
            role: acc.role || "ADMIN",
            tier,
            validUntil: validDate.toISOString(),
            monthlyScanLimit: acc.subScanLimit || tierCfg.monthlyScanLimit,
            usedScansThisMonth: acc.subUsedScans || 0,
            createdAt: acc.createdAt ? new Date(acc.createdAt).toISOString() : new Date().toISOString(),
            status,
            approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
          })
        }
      }
    } catch (err) {
      console.warn("PostgreSQL tenants fetch notice in superadmin:", err)
    }
  }

  // 2. Enrich / supplement with Clerk backend users (only enrich or add unprovisioned)
  const clerkSecret = process.env.CLERK_SECRET_KEY
  if (clerkSecret) {
    try {
      const clerkRes = await fetch("https://api.clerk.com/v1/users?limit=100&order_by=-created_at", {
        headers: {
          Authorization: `Bearer ${clerkSecret}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (clerkRes.ok) {
        const clerkUsers = await clerkRes.json()
        if (Array.isArray(clerkUsers)) {
          for (const u of clerkUsers) {
            const primaryEmailObj = u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id) || u.email_addresses?.[0]
            const email = (primaryEmailObj?.email_address || "").toLowerCase().trim()
            const firstName = u.first_name || ""
            const lastName = u.last_name || ""
            const fullName = `${firstName} ${lastName}`.trim() || u.username || email.split("@")[0] || "Pelanggan Google"
            const usernameKey = email || (u.username ? u.username.toLowerCase() : `clerk_${u.id.slice(-8)}`)

            // Check if already in tenantsMap by email or username
            let existingEntry: TenantSummary | undefined
            for (const t of tenantsMap.values()) {
              if (t.username.toLowerCase() === usernameKey || (email && t.username.toLowerCase() === email)) {
                existingEntry = t
                break
              }
            }

            if (existingEntry) {
              if (fullName && (!existingEntry.fullName || existingEntry.fullName === existingEntry.username)) {
                existingEntry.fullName = fullName
              }
              if (u.phone_numbers?.[0]?.phone_number && !existingEntry.phone) {
                existingEntry.phone = u.phone_numbers[0].phone_number
              }
              if (u.banned) {
                existingEntry.status = "suspended"
              }
            } else {
              const isSuperadminEmail = email === (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()
              const role = isSuperadminEmail ? "SUPERADMIN" : "OWNER"
              const tier: SubscriptionTier = isSuperadminEmail ? "developer" : "trial"
              const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
              const createdAt = u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
              const validDate = isSuperadminEmail
                ? new Date("2099-12-31T23:59:59.999Z")
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

              tenantsMap.set(u.id, {
                id: u.id,
                tenantId: u.id,
                username: usernameKey,
                fullName,
                businessName: `Bisnis ${fullName}`,
                phone: u.phone_numbers?.[0]?.phone_number || "",
                role,
                tier,
                validUntil: validDate.toISOString(),
                monthlyScanLimit: isSuperadminEmail ? 999999 : tierCfg.monthlyScanLimit,
                usedScansThisMonth: 0,
                createdAt,
                status: u.banned ? "suspended" : (isSuperadminEmail ? "active" : "trial"),
                approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
              })
            }
          }
        }
      }
    } catch (clerkErr) {
      console.warn("Clerk users fetch notice in superadmin:", clerkErr)
    }
  }

  const masterSuperadminEmail = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()
  const masterSuperadminUser = (process.env.SUPERADMIN_USERNAME || "superadmin").toLowerCase().trim()

  return Array.from(tenantsMap.values()).filter((t) => {
    const u = t.username.toLowerCase().trim()
    const r = (t.role || "").toUpperCase()
    if (u === masterSuperadminUser || u === "superadmin" || u === "developer") return false
    if (u === masterSuperadminEmail) return false
    if (t.tenantId === DEFAULT_TENANT_ID || t.id === DEFAULT_TENANT_ID) return false
    return true
  })
}

/**
 * Fetch aggregated platform statistics for Superadmin Dashboard
 */
export async function getSuperadminPlatformStats(): Promise<PlatformStats> {
  const tenants = await getAllTenants()
  const now = new Date()

  let totalReceipts = 0

  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ count: string }>(`SELECT count(*) as count FROM receipts`)
      if (res.rows && res.rows[0]) {
        totalReceipts = parseInt(res.rows[0].count, 10) || 0
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  const tierBreakdown = {
    trial: 0,
    starter: 0,
    pro: 0,
    enterprise: 0,
    developer: 0,
  }

  let activeTenants = 0
  let paidTenantsCount = 0
  let totalSubscriptionRevenue = 0
  let monthlyRecurringRevenue = 0
  const expiringSoonTenants: TenantSummary[] = []

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  for (const t of tenants) {
    const tTier = t.tier || "starter"
    if (tierBreakdown[tTier] !== undefined) {
      tierBreakdown[tTier]++
    } else {
      tierBreakdown.starter++
    }

    const validDate = new Date(t.validUntil)
    const isActive = validDate >= now && t.status !== "suspended"
    if (isActive) {
      activeTenants++
    }

    if (validDate >= now && validDate <= sevenDaysFromNow) {
      expiringSoonTenants.push(t)
    }

    if (tTier !== "trial") {
      paidTenantsCount++
      const cfg = TIER_CONFIG[tTier]
      if (cfg) {
        monthlyRecurringRevenue += cfg.priceMonthly
        totalSubscriptionRevenue += cfg.priceMonthly
      }
    }
  }

  return {
    totalTenants: tenants.length,
    activeTenants,
    totalReceipts,
    totalSubscriptionRevenue,
    monthlyRecurringRevenue,
    paidTenantsCount,
    tierBreakdown,
    recentRegistrations: tenants.slice(0, 10),
    expiringSoonTenants,
  }
}

/**
 * Helper to resolve the exact tenant entity across PostgreSQL and Clerk.
 */
export interface ResolvedTenantTarget {
  tenantId: string
  adminUsernames: string[]
  emails: string[]
  clerkIds: string[]
  ownerUserId?: string
}

export async function resolveTenantEntity(
  identifier: string,
  explicitTenantId?: string
): Promise<ResolvedTenantTarget | null> {
  const cleanId = (identifier || "").trim().toLowerCase()
  const cleanExplicit = (explicitTenantId || "").trim()

  if (!cleanId && !cleanExplicit) return null

  // 1. If explicit tenantId is provided and valid
  if (cleanExplicit) {
    const tRes = await queryPg<{ id: string; ownerId?: string }>(
      `SELECT id, "ownerId" FROM tenants WHERE id = $1 LIMIT 1`,
      [cleanExplicit]
    )
    if (tRes.rows?.[0]) {
      const tenantId = tRes.rows[0].id
      const accRes = await queryPg<{ username: string; email?: string; clerkId?: string }>(
        `SELECT username, email, "clerkId" FROM admin_accounts WHERE "tenantId" = $1`,
        [tenantId]
      )
      const uRes = await queryPg<{ email?: string; clerkId?: string }>(
        `SELECT email, "clerkId" FROM users WHERE id = $1`,
        [tRes.rows[0].ownerId]
      )
      const adminUsernames = accRes.rows.map((r) => r.username.toLowerCase()).filter(Boolean)
      const emails = [
        ...accRes.rows.map((r) => r.email?.toLowerCase()).filter(Boolean),
        ...uRes.rows.map((r) => r.email?.toLowerCase()).filter(Boolean),
        cleanId.includes("@") ? cleanId : null,
      ].filter(Boolean) as string[]
      const clerkIds = [
        ...accRes.rows.map((r) => r.clerkId).filter(Boolean),
        ...uRes.rows.map((r) => r.clerkId).filter(Boolean),
        cleanId.startsWith("user_") ? cleanId : null,
      ].filter(Boolean) as string[]

      return {
        tenantId,
        adminUsernames: Array.from(new Set(adminUsernames)),
        emails: Array.from(new Set(emails)),
        clerkIds: Array.from(new Set(clerkIds)),
        ownerUserId: tRes.rows[0].ownerId,
      }
    }
  }

  // 2. Try match cleanId as tenant UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)
  if (isUuid) {
    const tRes = await queryPg<{ id: string; ownerId?: string }>(
      `SELECT id, "ownerId" FROM tenants WHERE id = $1 LIMIT 1`,
      [cleanId]
    )
    if (tRes.rows?.[0]) {
      return resolveTenantEntity(cleanId, tRes.rows[0].id)
    }
  }

  // 2b. Try match cleanId with prefix "tenant_" (e.g. tenant_00000000 or tenant_c53954a8)
  if (cleanId.startsWith("tenant_")) {
    const prefix = cleanId.replace("tenant_", "")
    if (prefix) {
      const tRes = await queryPg<{ id: string; ownerId?: string }>(
        `SELECT id, "ownerId" FROM tenants WHERE id::text LIKE $1 LIMIT 1`,
        [prefix + "%"]
      )
      if (tRes.rows?.[0]) {
        return resolveTenantEntity(cleanId, tRes.rows[0].id)
      }
    }
  }

  // 3. Try match cleanId in admin_accounts (by username, email, clerkId)
  const accRes = await queryPg<{ tenantId: string; username: string; email?: string; clerkId?: string }>(
    `SELECT "tenantId", username, email, "clerkId" FROM admin_accounts 
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR "clerkId" = $1 LIMIT 1`,
    [cleanId]
  )
  if (accRes.rows?.[0]?.tenantId) {
    return resolveTenantEntity(cleanId, accRes.rows[0].tenantId)
  }

  // 4. Try match cleanId in users table (by email or clerkId)
  const uRes = await queryPg<{ id: string; clerkId?: string; email?: string }>(
    `SELECT id, "clerkId", email FROM users 
     WHERE LOWER(email) = LOWER($1) OR "clerkId" = $1 LIMIT 1`,
    [cleanId]
  )
  if (uRes.rows?.[0]) {
    const userId = uRes.rows[0].id
    const tRes = await queryPg<{ id: string }>(
      `SELECT id FROM tenants WHERE "ownerId" = $1 LIMIT 1`,
      [userId]
    )
    if (tRes.rows?.[0]?.id) {
      return resolveTenantEntity(cleanId, tRes.rows[0].id)
    }
    const mRes = await queryPg<{ tenantId: string }>(
      `SELECT "tenantId" FROM memberships WHERE "userId" = $1 LIMIT 1`,
      [userId]
    )
    if (mRes.rows?.[0]?.tenantId) {
      return resolveTenantEntity(cleanId, mRes.rows[0].tenantId)
    }
  }

  // 5. Try match cleanId in subscriptions table (only if valid UUID)
  if (isUuid) {
    const subRes = await queryPg<{ tenantId: string }>(
      `SELECT "tenantId" FROM subscriptions WHERE "tenantId" = $1 LIMIT 1`,
      [cleanId]
    )
    if (subRes.rows?.[0]?.tenantId) {
      return resolveTenantEntity(cleanId, subRes.rows[0].tenantId)
    }
  }

  return null
}

/**
 * Superadmin update of a tenant's subscription tier & validity
 */
export async function updateTenantSubscription(
  username: string,
  params: {
    tier: SubscriptionTier
    durationDays?: number
    customValidUntil?: string
    customScanLimit?: number
    tenantId?: string
  },
  actorUsername: string = "Superadmin"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()
    const resolved = await resolveTenantEntity(cleanUser, params.tenantId)

    if (!resolved || !resolved.tenantId) {
      return { success: false, message: `Tenant tidak ditemukan untuk identitas: ${username}` }
    }

    const { tenantId, adminUsernames, emails } = resolved
    const tierConfig = TIER_CONFIG[params.tier] || TIER_CONFIG.trial
    const days = params.durationDays || 30

    const isDevTier = params.tier === "developer"
    let validUntilIso = params.customValidUntil
    if (!validUntilIso) {
      if (isDevTier || (params.durationDays && params.durationDays >= 36500)) {
        validUntilIso = "2099-12-31T23:59:59.999Z"
      } else {
        const date = new Date()
        date.setDate(date.getDate() + days)
        validUntilIso = date.toISOString()
      }
    }

    const monthlyScanLimit = isDevTier ? 999999 : (params.customScanLimit || tierConfig.monthlyScanLimit)

    if (isDatabaseConfigured) {
      await withTransactionPg(async (client) => {
        // Update or Insert status langganan di tabel subscriptions (SSOT)
        await client.query(
          `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "updatedAt")
           VALUES ($1, $2, 'active', $3, $4, NOW())
           ON CONFLICT ("tenantId") DO UPDATE SET
             tier = EXCLUDED.tier,
             status = CASE 
               WHEN subscriptions.status = 'suspended' THEN 'suspended'
               WHEN EXCLUDED."validUntil" < NOW() THEN 'expired' 
               ELSE 'active' 
             END,
             "validUntil" = EXCLUDED."validUntil",
             "monthlyScanLimit" = EXCLUDED."monthlyScanLimit",
             "updatedAt" = NOW()`,
          [tenantId, params.tier, validUntilIso, monthlyScanLimit]
        )

        // Update admin_accounts
        await client.query(
          `UPDATE admin_accounts
           SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, "updatedAt" = NOW()
           WHERE "tenantId" = $4 OR LOWER(email) = ANY($5) OR LOWER(username) = ANY($6)`,
          [params.tier, validUntilIso, monthlyScanLimit, tenantId, emails, adminUsernames]
        )
      })
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: "UPDATE_SUBSCRIPTION",
      targetTenant: cleanUser,
      detail: `Paket tenant (ID: ${tenantId}) diubah ke ${tierConfig.name} (Valid s/d ${new Date(validUntilIso).toLocaleDateString("id-ID")})`,
    })

    return {
      success: true,
      message: `Paket ${cleanUser} berhasil diupdate ke ${tierConfig.name} hingga ${new Date(validUntilIso).toLocaleDateString("id-ID")}`,
    }
  } catch (error: any) {
    console.error("updateTenantSubscription error:", error)
    return { success: false, message: error.message || "Gagal update langganan tenant" }
  }
}

/**
 * Superadmin update of a tenant's approval workflow configuration
 */
export async function updateTenantApprovalConfig(
  username: string,
  workflow: Partial<ApprovalWorkflowConfig>,
  actorUsername: string = "Superadmin"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()
    const tenants = await getAllTenants()
    const tenant = tenants.find((t) => t.username === cleanUser)

    const updatedWorkflow: ApprovalWorkflowConfig = {
      ...(tenant?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW),
      ...workflow,
    }

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `UPDATE admin_accounts SET "approvalWorkflow" = $1, "updatedAt" = NOW() WHERE LOWER(username) = LOWER($2)`,
          [JSON.stringify(updatedWorkflow), cleanUser]
        )
      } catch (err) {
        console.warn("updateTenantApprovalConfig PostgreSQL notice:", err)
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: "UPDATE_APPROVAL_WORKFLOW",
      targetTenant: cleanUser,
      detail: `Alur verifikasi diubah: ${updatedWorkflow.enableApproval ? 'Aktif (Dual-Approval)' : 'Nonaktif (Auto-Approve)'}, Target: ${updatedWorkflow.approvalTargetRole}`,
    })

    return {
      success: true,
      message: `Konfigurasi alur approval untuk ${cleanUser} berhasil diperbarui.`,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal memperbarui konfigurasi approval" }
  }
}

/**
 * Superadmin toggle tenant suspension (Active <-> Suspended)
 */
export async function toggleTenantStatus(
  username: string,
  newStatus: "active" | "suspended",
  actorUsername: string = "Superadmin",
  explicitTenantId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()
    const resolved = await resolveTenantEntity(cleanUser, explicitTenantId)

    if (!resolved || !resolved.tenantId) {
      return { success: false, message: `Tenant tidak ditemukan untuk identitas: ${username}` }
    }

    const { tenantId, adminUsernames, emails, clerkIds } = resolved

    if (isDatabaseConfigured) {
      await withTransactionPg(async (client) => {
        // 1. Update tenants table
        await client.query(
          `UPDATE tenants SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
          [newStatus, tenantId]
        )

        // 2. Update subscriptions table
        await client.query(
          `UPDATE subscriptions SET status = $1, "updatedAt" = NOW() WHERE "tenantId" = $2`,
          [newStatus, tenantId]
        )

        // 3. Update admin_accounts table
        await client.query(
          `UPDATE admin_accounts SET status = $1, "updatedAt" = NOW() 
           WHERE "tenantId" = $2 
              OR LOWER(email) = ANY($3) 
              OR LOWER(username) = ANY($4)`,
          [newStatus, tenantId, emails, adminUsernames]
        )

        // 4. Update memberships table
        const memStatus = newStatus === "suspended" ? "SUSPENDED" : "ACTIVE"
        await client.query(
          `UPDATE memberships SET status = $1, "updatedAt" = NOW() WHERE "tenantId" = $2`,
          [memStatus, tenantId]
        )
      })
    }

    // 5. Sync to Clerk API if Clerk User (Ban/Unban)
    const clerkSecret = process.env.CLERK_SECRET_KEY
    if (clerkSecret && clerkIds.length > 0) {
      for (const cid of clerkIds) {
        if (!cid.startsWith("user_")) continue
        try {
          const actionEndpoint = newStatus === "suspended" ? "ban" : "unban"
          await fetch(`https://api.clerk.com/v1/users/${cid}/${actionEndpoint}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${clerkSecret}`,
              "Content-Type": "application/json",
            },
          })
        } catch (clerkErr) {
          console.warn(`Clerk ${newStatus} sync notice for ${cid}:`, clerkErr)
        }
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: newStatus === "suspended" ? "SUSPEND_TENANT" : "ACTIVATE_TENANT",
      targetTenant: cleanUser,
      detail: `Status tenant (ID: ${tenantId}) berhasil diubah menjadi ${newStatus.toUpperCase()}`,
    })

    const actionText = newStatus === "suspended" ? "ditangguhkan (suspended)" : "diaktifkan kembali (open)"
    return {
      success: true,
      message: `Tenant ${cleanUser} berhasil ${actionText}.`,
    }
  } catch (error: any) {
    console.error("toggleTenantStatus error:", error)
    return { success: false, message: error.message || "Gagal mengubah status tenant" }
  }
}

/**
 * Superadmin permanently delete tenant and all its data
 */
export async function deleteTenant(
  username: string,
  actorUsername: string = "Superadmin",
  explicitTenantId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()
    const resolved = await resolveTenantEntity(cleanUser, explicitTenantId)

    if (!resolved || !resolved.tenantId) {
      return { success: false, message: `Tenant tidak ditemukan untuk identitas: ${username}` }
    }

    const { tenantId, clerkIds, ownerUserId } = resolved

    if (isDatabaseConfigured) {
      // Safety guard: tenant must be suspended before deletion to prevent accidental clicks
      const statusRes = await queryPg<{ status: string }>(
        `SELECT status FROM tenants WHERE id = $1 LIMIT 1`,
        [tenantId]
      )
      if (statusRes.rows?.[0] && statusRes.rows[0].status !== "suspended") {
        return {
          success: false,
          message: "Tenant harus disuspend terlebih dahulu sebelum dapat dihapus permanen untuk mencegah kesalahan penghapusan data.",
        }
      }

      await withTransactionPg(async (client) => {
        // 1. Hapus receipt_items dan receipts jika ada
        const checkReceiptItems = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipt_items'`
        )
        const checkReceipts = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipts'`
        )
        if (checkReceiptItems.rows.length > 0 && checkReceipts.rows.length > 0) {
          await client.query(
            `DELETE FROM receipt_items WHERE "receiptId" IN (SELECT id FROM receipts WHERE "tenantId" = $1)`,
            [tenantId]
          )
          await client.query(`DELETE FROM receipts WHERE "tenantId" = $1`, [tenantId])
        }

        // 2. Hapus referensi tenant di seluruh tabel anak yang benar-benar memiliki kolom tenantId / tenant_id
        const colsRes = await client.query(
          `SELECT table_name, column_name 
           FROM information_schema.columns 
           WHERE table_schema = 'public' 
             AND column_name IN ('tenantId', 'tenant_id')
             AND table_name != 'tenants'`
        )

        for (const row of colsRes.rows) {
          const colName = row.column_name === "tenantId" ? '"tenantId"' : 'tenant_id'
          await client.query(`DELETE FROM "${row.table_name}" WHERE ${colName} = $1`, [tenantId])
        }

        // 3. Hapus entitas tenant utama
        await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId])

        // 4. Hapus user di users jika tidak punya tenant lain
        if (ownerUserId) {
          const otherTenants = await client.query(
            `SELECT id FROM tenants WHERE "ownerId" = $1 LIMIT 1`,
            [ownerUserId]
          )
          if (otherTenants.rows.length === 0) {
            await client.query(`DELETE FROM users WHERE id = $1`, [ownerUserId])
          }
        }
      })
    }

    // 5. Hapus user dari Clerk jika terhubung
    const clerkSecret = process.env.CLERK_SECRET_KEY
    if (clerkSecret && clerkIds.length > 0) {
      for (const cid of clerkIds) {
        if (!cid.startsWith("user_")) continue
        try {
          await fetch(`https://api.clerk.com/v1/users/${cid}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${clerkSecret}`,
            },
          })
        } catch (clerkErr) {
          console.warn(`Clerk delete notice for ${cid}:`, clerkErr)
        }
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: "DELETE_TENANT",
      targetTenant: cleanUser,
      detail: `Tenant ${cleanUser} (ID: ${tenantId}) dan seluruh datanya telah dihapus permanen.`,
    })

    return {
      success: true,
      message: `Tenant ${cleanUser} berhasil dihapus permanen dari sistem.`,
    }
  } catch (error: any) {
    console.error("deleteTenant error:", error)
    return { success: false, message: error.message || "Gagal menghapus tenant" }
  }
}

/**
 * Create a new tenant manually by Superadmin
 */
export async function createTenantManual(
  payload: {
    username: string
    password: string
    fullName: string
    businessName: string
    phone?: string
    tier: SubscriptionTier
    durationDays?: number
    role?: string
  },
  actorUsername: string = "Superadmin"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = payload.username.trim().toLowerCase()
    if (!cleanUser || !payload.password) {
      return { success: false, message: "Username dan Password wajib diisi" }
    }

    const tier = payload.tier || "starter"
    const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.starter
    const durationDays = payload.durationDays || 30
    const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    const role = payload.role || "ADMIN"
    const businessName = payload.businessName || payload.fullName || cleanUser

    // 1. Hash password with bcrypt
    const hashedPass = await hashPassword(payload.password)

    let createdTenantId = `tenant-${Date.now()}`

    // 2. Insert into database
    if (isDatabaseConfigured) {
      try {
        await withTransactionPg(async (client) => {
          // Create Tenant in tenants table
          const tenantRes = await client.query(
            `INSERT INTO tenants ("businessName", phone, status, "createdAt", "updatedAt")
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [businessName, payload.phone || ""]
          )
          if (tenantRes.rows?.[0]?.id) {
            createdTenantId = tenantRes.rows[0].id
          }

          // Create subscription in subscriptions table
          await client.query(
            `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", phone, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 0, $5, $6, NOW(), NOW())
             ON CONFLICT ("tenantId") DO UPDATE 
             SET tier = EXCLUDED.tier, "validUntil" = EXCLUDED."validUntil", "monthlyScanLimit" = EXCLUDED."monthlyScanLimit"`,
            [
              createdTenantId,
              tier,
              validUntil,
              tierCfg.monthlyScanLimit,
              businessName,
              payload.phone || "",
            ]
          )

          // Insert into admin_accounts (Account Identity only)
          await client.query(
            `INSERT INTO admin_accounts (username, password, role, "tenantId", "fullName", "businessName", phone, status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
             ON CONFLICT (username) DO UPDATE SET 
               password = EXCLUDED.password,
               "tenantId" = EXCLUDED."tenantId",
               "fullName" = EXCLUDED."fullName",
               "businessName" = EXCLUDED."businessName",
               role = EXCLUDED.role,
               status = 'active',
               "updatedAt" = NOW()`,
            [
              cleanUser,
              hashedPass,
              role,
              createdTenantId,
              payload.fullName || cleanUser,
              businessName,
              payload.phone || "",
            ]
          )
        })
      } catch (err) {
        console.error("createTenantManual PostgreSQL transaction error:", err)
        throw err
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: "CREATE_TENANT",
      targetTenant: cleanUser,
      detail: `Pendaftaran manual tenant ${payload.businessName} (Role: ${role}, Paket: ${tierCfg.name})`,
    })

    return { success: true, message: `Tenant ${cleanUser} berhasil didaftarkan.` }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal membuat tenant manual" }
  }
}

/**
 * Get comprehensive detail of a specific tenant
 */
export async function getTenantDetail(username: string) {
  const cleanUser = username.trim().toLowerCase()
  const tenants = await getAllTenants()
  const tenant = tenants.find((t) => t.username === cleanUser)
  if (!tenant) {
    return null
  }

  let receiptsCount = 0
  let totalOmset = 0
  let recentReceipts: any[] = []

  if (isDatabaseConfigured) {
    try {
      const tenantId = tenant.tenantId || DEFAULT_TENANT_ID
      const res = await queryPg<any>(
        `SELECT id, "merchantName", date, "totalAmount", "createdAt" 
         FROM receipts 
         WHERE "tenantId" = $1 OR "tenantId" IS NULL
         ORDER BY "createdAt" DESC LIMIT 10`,
        [tenantId]
      )
      if (res.rows) {
        recentReceipts = res.rows
      }

      const countRes = await queryPg<any>(
        `SELECT count(*) as count, COALESCE(sum("totalAmount"), 0) as total 
         FROM receipts 
         WHERE "tenantId" = $1 OR "tenantId" IS NULL`,
        [tenantId]
      )
      if (countRes.rows && countRes.rows[0]) {
        receiptsCount = parseInt(countRes.rows[0].count || "0", 10)
        totalOmset = Number(countRes.rows[0].total || 0)
      }
    } catch (err) {}
  }

  const allLogs = await getAuditLogs()
  const tenantLogs = allLogs.filter(
    (l) => l.targetTenant.toLowerCase().includes(cleanUser) || l.detail.toLowerCase().includes(cleanUser)
  )

  return {
    tenant,
    stats: {
      totalReceipts: receiptsCount,
      totalOmset: totalOmset,
      storageUsedMb: 0,
      storageLimitMb: 500,
      scanUsage: {
        used: tenant.usedScansThisMonth || 0,
        limit: tenant.monthlyScanLimit || 500,
      },
    },
    staffList: [],
    invoices: [],
    recentReceipts,
    auditLogs: tenantLogs,
  }
}

/**
 * Record an audit log entry to PostgreSQL database
 */
export async function recordAuditLog(payload: {
  superadmin: string
  action: string
  targetTenantId?: string
  targetTenant?: string
  targetTenantLabel?: string
  detail: string
  ipAddress?: string
}): Promise<void> {
  try {
    const label = payload.targetTenantLabel || payload.targetTenant || "General"
    if (isDatabaseConfigured) {
      await queryPg(
        `INSERT INTO audit_logs (superadmin, action, "targetTenantId", "targetTenantLabel", detail, "ipAddress", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          payload.superadmin || "Superadmin",
          payload.action,
          payload.targetTenantId || null,
          label,
          payload.detail || "",
          payload.ipAddress || "127.0.0.1",
        ]
      )
    }
  } catch (err) {
    console.error("recordAuditLog PostgreSQL notice:", err)
  }
}

/**
 * Get all audit log entries from PostgreSQL database
 */
export async function getAuditLogs(limit = 500): Promise<AuditLogEntry[]> {
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{
        id: string
        superadmin: string
        action: string
        targetTenantId: string | null
        targetTenantLabel: string | null
        detail: string | null
        ipAddress: string | null
        createdAt: string
      }>(
        `SELECT id, superadmin, action, "targetTenantId", "targetTenantLabel", detail, "ipAddress", "createdAt"
         FROM audit_logs
         ORDER BY "createdAt" DESC
         LIMIT $1`,
        [limit]
      )

      if (res.rows && res.rows.length > 0) {
        return res.rows.map((row) => ({
          id: row.id,
          timestamp: new Date(row.createdAt).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          superadmin: row.superadmin,
          action: row.action,
          targetTenant: row.targetTenantLabel || row.targetTenantId || "General",
          detail: row.detail || "",
          ipAddress: row.ipAddress || "127.0.0.1",
        }))
      }
    } catch (err) {
      console.warn("getAuditLogs PostgreSQL query notice:", err)
    }
  }

  return []
}

/**
 * Get all billing transactions from PostgreSQL database
 */
export async function getAllBillingTransactions(): Promise<BillingTransaction[]> {
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{
        id: string
        invoiceNumber: string
        tenantId: string
        businessName: string | null
        username: string | null
        tier: string
        amount: string | number
        status: "lunas" | "pending" | "gagal"
        paymentMethod: string | null
        createdAt: string
      }>(
        `SELECT bt.id,
                bt."invoiceNumber",
                bt."tenantId",
                COALESCE(t."businessName", 'Bisnis') as "businessName",
                COALESCE(a.username, 'admin') as username,
                bt.tier,
                bt.amount,
                bt.status,
                bt."paymentMethod",
                bt."createdAt"
         FROM billing_transactions bt
         LEFT JOIN tenants t ON bt."tenantId" = t.id
         LEFT JOIN admin_accounts a ON a."tenantId" = t.id
         ORDER BY bt."createdAt" DESC`
      )

      if (res.rows) {
        return res.rows.map((row) => ({
          id: row.id,
          tenantUsername: row.username || "admin",
          businessName: row.businessName || "Bisnis",
          tier: (row.tier || "pro") as SubscriptionTier,
          amount: Number(row.amount) || 0,
          status: row.status || "lunas",
          paymentMethod: row.paymentMethod || "Transfer Manual",
          date: row.createdAt,
          invoiceNumber: row.invoiceNumber,
        }))
      }
    } catch (err) {
      console.warn("getAllBillingTransactions PostgreSQL query notice:", err)
    }
  }

  return []
}

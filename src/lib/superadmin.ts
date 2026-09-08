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

  // 1. Fetch Real Registered Users from Clerk Backend API (Google OAuth & Email Registrations)
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
            
            const isSuperadminEmail = email === (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()
            const role = isSuperadminEmail ? "SUPERADMIN" : "OWNER"
            const tier: SubscriptionTier = isSuperadminEmail ? "enterprise" : "trial"
            const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial

            const createdAt = u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
            const validDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

            tenantsMap.set(usernameKey, {
              tenantId: u.id,
              username: usernameKey,
              fullName,
              businessName: `Bisnis ${fullName}`,
              phone: u.phone_numbers?.[0]?.phone_number || "",
              role,
              tier,
              validUntil: validDate.toISOString(),
              monthlyScanLimit: isSuperadminEmail ? 99999 : tierCfg.monthlyScanLimit,
              usedScansThisMonth: 0,
              createdAt,
              status: "active",
              approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
            })
          }
        }
      }
    } catch (clerkErr) {
      console.warn("Clerk users fetch notice in superadmin:", clerkErr)
    }
  }

  // 2. Fetch PostgreSQL Registered Tenants & Admin Accounts
  if (isDatabaseConfigured) {
    try {
      // 2A. Query Registered Tenants (where not demo or demo count is 0)
      const tenantsRes = await queryPg<any>(
        `SELECT t.id, t."businessName", t.phone, t.status, t."createdAt", t."isDemo", t."demoEmail",
                s.tier as "subTier",
                s."validUntil" as "subValidUntil",
                s."monthlyScanLimit" as "subScanLimit",
                s."usedScansThisMonth" as "subUsedScans",
                s."approvalWorkflow",
                a.username,
                a.email,
                a."fullName",
                a.role
         FROM tenants t
         LEFT JOIN subscriptions s ON t.id = s."tenantId"
         LEFT JOIN admin_accounts a ON t.id = a."tenantId"
         WHERE t."isDemo" = false OR t."isDemo" IS NULL
         ORDER BY t."createdAt" DESC`
      )

      if (tenantsRes.rows) {
        for (const row of tenantsRes.rows) {
          const tenantId = row.id
          const rawUser = row.username || row.email || row.demoEmail || `tenant_${tenantId.slice(0, 8)}`
          const cleanUser = rawUser.trim().toLowerCase()
          
          const tier = (row.subTier || "trial") as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
          const validDate = new Date(row.subValidUntil || Date.now() + 14 * 24 * 60 * 60 * 1000)
          const isExpired = validDate < new Date()

          let workflow: ApprovalWorkflowConfig = { ...DEFAULT_APPROVAL_WORKFLOW }
          if (row.approvalWorkflow) {
            try {
              const parsed = typeof row.approvalWorkflow === "string" ? JSON.parse(row.approvalWorkflow) : row.approvalWorkflow
              workflow = { ...DEFAULT_APPROVAL_WORKFLOW, ...parsed }
            } catch (e) {}
          }

          // If already added by Clerk, enrich with PostgreSQL details
          const existing = tenantsMap.get(cleanUser) || (row.email ? tenantsMap.get(row.email.toLowerCase().trim()) : undefined)
          const finalKey = existing ? existing.username : cleanUser

          tenantsMap.set(finalKey, {
            tenantId,
            username: finalKey,
            fullName: row.fullName || existing?.fullName || row.businessName || finalKey,
            businessName: row.businessName || existing?.businessName || "Scota Business",
            phone: row.phone || existing?.phone || "",
            role: row.role || existing?.role || "OWNER",
            tier: (row.subTier as SubscriptionTier) || existing?.tier || tier,
            validUntil: row.subValidUntil ? new Date(row.subValidUntil).toISOString() : (existing?.validUntil || validDate.toISOString()),
            monthlyScanLimit: row.subScanLimit || existing?.monthlyScanLimit || tierCfg.monthlyScanLimit,
            usedScansThisMonth: row.subUsedScans || existing?.usedScansThisMonth || 0,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : (existing?.createdAt || new Date().toISOString()),
            status: row.status === "suspended" ? "suspended" : (isExpired ? "expired" : "active"),
            approvalWorkflow: workflow,
          })
        }
      }

      // 2B. Query admin_accounts
      const accRes = await queryPg<any>(
        `SELECT a.id, a.username, a.role, a."fullName", a."businessName", a.phone, a.email, a.status, a."createdAt", a."approvalWorkflow",
                a."tenantId",
                s.tier as "subTier",
                s."validUntil" as "subValidUntil",
                s."monthlyScanLimit" as "subScanLimit",
                s."usedScansThisMonth" as "subUsedScans"
         FROM admin_accounts a
         LEFT JOIN subscriptions s ON a."tenantId" = s."tenantId"
         ORDER BY a."createdAt" DESC`
      )

      if (accRes.rows) {
        for (const acc of accRes.rows) {
          const cleanUser = (acc.username || acc.email || "").trim().toLowerCase()
          if (!cleanUser) continue
          
          if (!tenantsMap.has(cleanUser)) {
            const tier = (acc.subTier || "starter") as SubscriptionTier
            const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
            const validDate = new Date(acc.subValidUntil || Date.now() + 14 * 24 * 60 * 60 * 1000)
            const isExpired = validDate < new Date()

            tenantsMap.set(cleanUser, {
              tenantId: acc.tenantId || DEFAULT_TENANT_ID,
              username: cleanUser,
              fullName: acc.fullName || cleanUser,
              businessName: acc.businessName || "Scota Business",
              phone: acc.phone || "",
              role: acc.role || "ADMIN",
              tier,
              validUntil: validDate.toISOString(),
              monthlyScanLimit: acc.subScanLimit || tierCfg.monthlyScanLimit,
              usedScansThisMonth: acc.subUsedScans || 0,
              createdAt: acc.createdAt ? new Date(acc.createdAt).toISOString() : new Date().toISOString(),
              status: acc.status === "suspended" ? "suspended" : (isExpired ? "expired" : "active"),
              approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
            })
          }
        }
      }
    } catch (err) {
      console.warn("PostgreSQL tenants fetch notice in superadmin:", err)
    }
  }

  return Array.from(tenantsMap.values())
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
 * Superadmin update of a tenant's subscription tier & validity
 */
export async function updateTenantSubscription(
  username: string,
  params: {
    tier: SubscriptionTier
    durationDays?: number
    customValidUntil?: string
    customScanLimit?: number
  },
  actorUsername: string = "Superadmin"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()
    const tierConfig = TIER_CONFIG[params.tier] || TIER_CONFIG.trial
    const days = params.durationDays || 30

    let validUntilIso = params.customValidUntil
    if (!validUntilIso) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      validUntilIso = date.toISOString()
    }

    const monthlyScanLimit = params.customScanLimit || tierConfig.monthlyScanLimit

    if (isDatabaseConfigured) {
      try {
        const userAcc = await getUserAccountDetails(cleanUser)
        const targetTenantId = userAcc?.tenantId || DEFAULT_TENANT_ID

        await withTransactionPg(async (client) => {
          // Update status langganan di tabel subscriptions (SSOT)
          await client.query(
            `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "updatedAt")
             VALUES ($1, $2, 'active', $3, $4, NOW())
             ON CONFLICT ("tenantId") DO UPDATE SET
               tier = EXCLUDED.tier,
               status = CASE WHEN EXCLUDED."validUntil" < NOW() THEN 'expired' ELSE 'active' END,
               "validUntil" = EXCLUDED."validUntil",
               "monthlyScanLimit" = EXCLUDED."monthlyScanLimit",
               "updatedAt" = NOW()`,
            [targetTenantId, params.tier, validUntilIso, monthlyScanLimit]
          )

          // Aktifkan akun admin jika status sebelumnya suspended
          await client.query(
            `UPDATE admin_accounts
             SET status = 'active', "updatedAt" = NOW()
             WHERE LOWER(username) = LOWER($1) AND status = 'suspended'`,
            [cleanUser]
          )
        })
      } catch (err) {
        console.warn("updateTenantSubscription PostgreSQL error:", err)
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: "UPDATE_SUBSCRIPTION",
      targetTenant: cleanUser,
      detail: `Paket diubah ke ${tierConfig.name} (Valid s/d ${new Date(validUntilIso).toLocaleDateString("id-ID")})`,
    })

    return {
      success: true,
      message: `Paket ${cleanUser} berhasil diupdate ke ${tierConfig.name} hingga ${new Date(validUntilIso).toLocaleDateString("id-ID")}`,
    }
  } catch (error: any) {
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
 * Superadmin toggle tenant suspension
 */
export async function toggleTenantStatus(
  username: string,
  newStatus: "active" | "suspended",
  actorUsername: string = "Superadmin"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `UPDATE admin_accounts SET status = $1, "updatedAt" = NOW() WHERE LOWER(username) = LOWER($2)`,
          [newStatus, cleanUser]
        )
      } catch (err) {
        console.warn("toggleTenantStatus PostgreSQL notice:", err)
      }
    }

    await recordAuditLog({
      superadmin: actorUsername,
      action: newStatus === "suspended" ? "SUSPEND_TENANT" : "ACTIVATE_TENANT",
      targetTenant: cleanUser,
      detail: `Status tenant diubah menjadi ${newStatus.toUpperCase()}`,
    })

    return {
      success: true,
      message: `Tenant ${cleanUser} berhasil diubah statusnya menjadi ${newStatus}.`,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal mengubah status tenant" }
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

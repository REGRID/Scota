import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
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
  if (!clean) return false

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

  if (isDatabaseConfigured) {
    try {
      let dbAccounts: any[] = []
      try {
        const res = await queryPg<any>(
          `SELECT a.*, 
                  t.id as "resolvedTenantId", 
                  COALESCE(t."businessName", a."businessName") as "tenantBusinessName",
                  COALESCE(t.phone, a.phone) as "tenantPhone",
                  s.tier as "subTier",
                  s."validUntil" as "subValidUntil",
                  s."monthlyScanLimit" as "subScanLimit",
                  s."usedScansThisMonth" as "subUsedScans"
           FROM admin_accounts a
           LEFT JOIN tenants t ON a."tenantId" = t.id
           LEFT JOIN subscriptions s ON a."tenantId" = s."tenantId"
           ORDER BY a."createdAt" DESC`
        )
        dbAccounts = res.rows || []
      } catch (joinErr) {
        const fallbackRes = await queryPg<any>(
          `SELECT * FROM admin_accounts ORDER BY "createdAt" DESC`
        )
        dbAccounts = fallbackRes.rows || []
      }

      if (dbAccounts) {
        for (const acc of dbAccounts) {
          const cleanUser = (acc.username || "").trim().toLowerCase()
          if (!cleanUser) continue
          const tenantId = acc.resolvedTenantId || acc.tenantId || DEFAULT_TENANT_ID
          const tier = (acc.subTier || acc.tier || "starter") as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.starter
          const validDate = new Date(acc.subValidUntil || acc.validUntil || Date.now() + 30 * 24 * 60 * 60 * 1000)
          const isExpired = validDate < new Date()

          let workflow: ApprovalWorkflowConfig = { ...DEFAULT_APPROVAL_WORKFLOW }
          if (acc.approvalWorkflow) {
            try {
              const parsed = typeof acc.approvalWorkflow === "string" ? JSON.parse(acc.approvalWorkflow) : acc.approvalWorkflow
              workflow = { ...DEFAULT_APPROVAL_WORKFLOW, ...parsed }
            } catch (e) {}
          }

          tenantsMap.set(cleanUser, {
            tenantId,
            username: cleanUser,
            fullName: acc.fullName || cleanUser,
            businessName: acc.tenantBusinessName || acc.businessName || acc.fullName || "Scota Business",
            phone: acc.tenantPhone || acc.phone || "",
            role: acc.role || "ADMIN",
            tier,
            validUntil: validDate.toISOString(),
            monthlyScanLimit: acc.subScanLimit || acc.monthlyScanLimit || tierCfg.monthlyScanLimit,
            usedScansThisMonth: acc.subUsedScans || acc.usedScansThisMonth || 0,
            createdAt: acc.createdAt || new Date().toISOString(),
            status: acc.status === "suspended" ? "suspended" : (isExpired ? "expired" : (tier === "trial" ? "trial" : "active")),
            approvalWorkflow: workflow,
          })
        }
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  // Fallback default admin jika tenantsMap kosong
  if (tenantsMap.size === 0) {
    const defaultUsers = ["admin", "superadmin", "karyawan"]
    for (const u of defaultUsers) {
      if (!tenantsMap.has(u)) {
        tenantsMap.set(u, {
          tenantId: DEFAULT_TENANT_ID,
          username: u,
          fullName: u === "superadmin" ? "Developer / Superadmin" : (u === "admin" ? "Administrator" : "Staff Kasir"),
          businessName: "Scota Business",
          phone: "6285215973776",
          role: u === "superadmin" ? "SUPERADMIN" : (u === "admin" ? "ADMIN" : "KARYAWAN"),
          tier: "starter",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          monthlyScanLimit: 150,
          usedScansThisMonth: 0,
          createdAt: new Date().toISOString(),
          status: "active",
          approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
        })
      }
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
        await queryPg(
          `UPDATE admin_accounts
           SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, "updatedAt" = NOW()
           WHERE LOWER(username) = LOWER($4)`,
          [params.tier, validUntilIso, monthlyScanLimit, cleanUser]
        )

        // Sync to subscriptions table
        const userAcc = await getUserAccountDetails(cleanUser)
        if (userAcc?.tenantId) {
          await queryPg(
            `UPDATE subscriptions
             SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, "updatedAt" = NOW()
             WHERE "tenantId" = $4`,
            [params.tier, validUntilIso, monthlyScanLimit, userAcc.tenantId]
          )
        }
      } catch (err) {
        console.warn("updateTenantSubscription PostgreSQL notice:", err)
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
        // Create Tenant in tenants table
        const tenantRes = await queryPg<{ id: string }>(
          `INSERT INTO tenants ("businessName", phone, status, "createdAt", "updatedAt")
           VALUES ($1, $2, 'active', NOW(), NOW())
           RETURNING id`,
          [businessName, payload.phone || ""]
        )
        if (tenantRes.rows?.[0]?.id) {
          createdTenantId = tenantRes.rows[0].id
        }

        // Create subscription in subscriptions table
        await queryPg(
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

        // Insert into admin_accounts
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "tenantId", "fullName", "businessName", phone, tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'active', NOW(), NOW())
           ON CONFLICT (username) DO UPDATE SET 
             password = EXCLUDED.password,
             "tenantId" = EXCLUDED."tenantId",
             "fullName" = EXCLUDED."fullName",
             "businessName" = EXCLUDED."businessName",
             role = EXCLUDED.role,
             tier = EXCLUDED.tier,
             "validUntil" = EXCLUDED."validUntil",
             "monthlyScanLimit" = EXCLUDED."monthlyScanLimit",
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
            tier,
            validUntil,
            tierCfg.monthlyScanLimit,
          ]
        )
      } catch (err) {
        console.warn("createTenantManual PostgreSQL insert notice:", err)
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

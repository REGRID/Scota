import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { TIER_CONFIG, SubscriptionTier, ApprovalWorkflowConfig, DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"
import { getUserAccountDetails, updateAdminPassword } from "@/lib/adminAccounts"
import fs from "fs"
import path from "path"

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

const AUDIT_LOG_FILE = path.join(process.cwd(), "superadmin_audit_logs.json")
const BILLING_FILE = path.join(process.cwd(), "superadmin_billing.json")

/**
 * Fetch list of all registered business tenants
 */
export async function getAllTenants(): Promise<TenantSummary[]> {
  const tenantsMap = new Map<string, TenantSummary>()

  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<any>(
        `SELECT * FROM admin_accounts ORDER BY "createdAt" DESC`
      )
      const dbAccounts = res.rows

      if (dbAccounts) {
        for (const acc of dbAccounts) {
          const cleanUser = (acc.username || "").trim().toLowerCase()
          if (!cleanUser) continue
          const tier = (acc.tier || "starter") as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.starter
          const validDate = new Date(acc.validUntil || Date.now() + 30 * 24 * 60 * 60 * 1000)
          const isExpired = validDate < new Date()

          let workflow: ApprovalWorkflowConfig = { ...DEFAULT_APPROVAL_WORKFLOW }
          if (acc.approvalWorkflow) {
            try {
              const parsed = typeof acc.approvalWorkflow === "string" ? JSON.parse(acc.approvalWorkflow) : acc.approvalWorkflow
              workflow = { ...DEFAULT_APPROVAL_WORKFLOW, ...parsed }
            } catch (e) {}
          }

          tenantsMap.set(cleanUser, {
            username: cleanUser,
            fullName: acc.fullName || cleanUser,
            businessName: acc.businessName || acc.fullName || "Scota Business",
            phone: acc.phone || "",
            role: acc.role || "ADMIN",
            tier,
            validUntil: validDate.toISOString(),
            monthlyScanLimit: acc.monthlyScanLimit || tierCfg.monthlyScanLimit,
            usedScansThisMonth: acc.usedScansThisMonth || 0,
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

  // Fallback from local passwords store if empty
  try {
    const localPassFile = path.join(process.cwd(), "admin_passwords.json")
    if (fs.existsSync(localPassFile)) {
      const data = JSON.parse(fs.readFileSync(localPassFile, "utf-8"))
      for (const userKey of Object.keys(data)) {
        const cleanUser = userKey.trim().toLowerCase()
        if (!tenantsMap.has(cleanUser)) {
          tenantsMap.set(cleanUser, {
            username: cleanUser,
            fullName: cleanUser,
            businessName: `${cleanUser.toUpperCase()} Business`,
            phone: "",
            role: "ADMIN",
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
  } catch (err) {
    console.warn("getAllTenants local store notice:", err)
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

    // 1. Save password
    await updateAdminPassword(cleanUser, payload.password)

    // 2. Insert into database
    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'active', NOW(), NOW())
           ON CONFLICT (username) DO UPDATE SET 
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
            payload.password,
            role,
            payload.fullName || cleanUser,
            payload.businessName || payload.fullName || cleanUser,
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
      const res = await queryPg<any>(
        `SELECT id, "merchantName", date, "totalAmount", "createdAt" FROM receipts ORDER BY "createdAt" DESC LIMIT 10`
      )
      if (res.rows) {
        receiptsCount = res.rows.length
        recentReceipts = res.rows
        totalOmset = res.rows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0)
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
 * Record an audit log entry
 */
export async function recordAuditLog(payload: {
  superadmin: string
  action: string
  targetTenant: string
  detail: string
  ipAddress?: string
}): Promise<void> {
  try {
    const entry: AuditLogEntry = {
      id: `LOG-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      superadmin: payload.superadmin || "Superadmin",
      action: payload.action,
      targetTenant: payload.targetTenant,
      detail: payload.detail,
      ipAddress: payload.ipAddress || "127.0.0.1",
    }

    let logs: AuditLogEntry[] = []
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, "utf-8"))
      } catch (e) {}
    }

    logs.unshift(entry)
    if (logs.length > 500) logs = logs.slice(0, 500)
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2))
  } catch (err) {
    console.warn("recordAuditLog notice:", err)
  }
}

/**
 * Get all audit log entries
 */
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const fileLogs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, "utf-8"))
      if (Array.isArray(fileLogs) && fileLogs.length > 0) {
        return fileLogs
      }
    }
  } catch (e) {}

  return []
}

/**
 * Get all billing transactions
 */
export async function getAllBillingTransactions(): Promise<BillingTransaction[]> {
  try {
    if (fs.existsSync(BILLING_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(BILLING_FILE, "utf-8"))
      if (Array.isArray(fileData) && fileData.length > 0) {
        return fileData
      }
    }
  } catch (e) {}

  return []
}

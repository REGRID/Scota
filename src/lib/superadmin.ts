import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { getUserAccountDetails, updateAdminPassword } from "@/lib/adminAccounts"
import fs from "fs"
import path from "path"

export const SUPERADMIN_USERNAMES = ["rama", "refo", "admin1", "admin2", "developer", "superadmin"]

/**
 * Check whether a given username has Superadmin / Platform Owner privileges
 */
export async function isSuperadminUser(username: string): Promise<boolean> {
  const clean = (username || "").trim().toLowerCase()
  if (!clean) return false

  if (SUPERADMIN_USERNAMES.includes(clean)) return true

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

  // 1. Load from Supabase `admin_accounts` if configured
  if (isSupabaseConfigured) {
    try {
      const { data: dbAccounts } = await supabase
        .from("admin_accounts")
        .select("*")
        .order("createdAt", { ascending: false })

      if (dbAccounts) {
        for (const acc of dbAccounts) {
          const cleanUser = acc.username.trim().toLowerCase()
          const tier = (acc.tier || "trial") as SubscriptionTier
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.trial
          const validDate = new Date(acc.validUntil || Date.now() + 14 * 24 * 60 * 60 * 1000)
          const isExpired = validDate < new Date()

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
          })
        }
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  // 2. Load from local passwords store as fallback / complement
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
            tier: "trial",
            validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            monthlyScanLimit: 30,
            usedScansThisMonth: 0,
            createdAt: new Date().toISOString(),
            status: "trial",
          })
        }
      }
    }
  } catch (err) {
    console.warn("getAllTenants local store notice:", err)
  }

  // Ensure default superadmin account is present if list is empty
  if (!tenantsMap.has("rama")) {
    tenantsMap.set("rama", {
      username: "rama",
      fullName: "Superadmin Rama",
      businessName: "Scota Platform",
      phone: "",
      role: "SUPERADMIN",
      tier: "enterprise",
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      monthlyScanLimit: 99999,
      usedScansThisMonth: 0,
      createdAt: new Date().toISOString(),
      status: "active",
    })
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

  // 1. Calculate receipts count from Supabase
  try {
    const { data: receipts } = await supabase
      .from("receipts")
      .select("id")
    
    if (receipts && receipts.length > 0) {
      totalReceipts = receipts.length
    }
  } catch (err) {
    // Graceful fallback
  }

  // 2. Count tier breakdown & calculate actual SaaS subscription earnings (Revenue & MRR)
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
    const tTier = t.tier || "trial"
    if (tierBreakdown[tTier] !== undefined) {
      tierBreakdown[tTier]++
    } else {
      tierBreakdown.trial++
    }

    const validDate = new Date(t.validUntil)
    const isActive = validDate >= now && t.status !== "suspended"
    if (isActive) {
      activeTenants++
    }

    if (validDate >= now && validDate <= sevenDaysFromNow) {
      expiringSoonTenants.push(t)
    }

    // Calculate revenue from paid tiers
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
  }
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

    // 1. Update in Supabase
    try {
      await supabase
        .from("admin_accounts")
        .update({
          tier: params.tier,
          validUntil: validUntilIso,
          monthlyScanLimit,
          updatedAt: new Date().toISOString(),
        })
        .eq("username", cleanUser)
    } catch (err) {
      console.warn("updateTenantSubscription Supabase notice:", err)
    }

    await recordAuditLog({
      superadmin: "Superadmin",
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
 * Superadmin toggle tenant suspension
 */
export async function toggleTenantStatus(
  username: string,
  newStatus: "active" | "suspended"
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = username.trim().toLowerCase()

    try {
      await supabase
        .from("admin_accounts")
        .update({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        })
        .eq("username", cleanUser)
    } catch (err) {
      console.warn("toggleTenantStatus Supabase notice:", err)
    }

    await recordAuditLog({
      superadmin: "Superadmin",
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
export async function createTenantManual(payload: {
  username: string
  password: string
  fullName: string
  businessName: string
  phone?: string
  tier: SubscriptionTier
  durationDays?: number
}): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUser = payload.username.trim().toLowerCase()
    if (!cleanUser || !payload.password) {
      return { success: false, message: "Username dan Password wajib diisi" }
    }

    const tier = payload.tier || "pro"
    const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.pro
    const durationDays = payload.durationDays || 30
    const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    // 1. Save password
    await updateAdminPassword(cleanUser, payload.password)

    // 2. Insert into Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from("admin_accounts").insert({
          username: cleanUser,
          fullName: payload.fullName || cleanUser,
          businessName: payload.businessName || payload.fullName || cleanUser,
          phone: payload.phone || "",
          role: "ADMIN",
          tier,
          validUntil,
          monthlyScanLimit: tierCfg.monthlyScanLimit,
          usedScansThisMonth: 0,
          createdAt: new Date().toISOString(),
          status: "active",
        })
      } catch (err) {
        console.warn("createTenantManual Supabase insert notice:", err)
      }
    }

    await recordAuditLog({
      superadmin: "Superadmin",
      action: "CREATE_TENANT",
      targetTenant: cleanUser,
      detail: `Pendaftaran manual tenant ${payload.businessName} paket ${tierCfg.name}`,
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
  const tenant = tenants.find((t) => t.username === cleanUser) || {
    username: cleanUser,
    fullName: cleanUser,
    businessName: `${cleanUser.toUpperCase()} Business`,
    phone: "",
    role: "ADMIN",
    tier: "trial" as SubscriptionTier,
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    monthlyScanLimit: 30,
    usedScansThisMonth: 0,
    createdAt: new Date().toISOString(),
    status: "trial" as const,
  }

  // Get tenant receipts
  let receiptsCount = 0
  let totalOmset = 0
  let recentReceipts: any[] = []

  try {
    const { data: dbReceipts } = await supabase
      .from("receipts")
      .select("*")
      .order("tanggal", { ascending: false })
      .limit(10)

    if (dbReceipts) {
      receiptsCount = dbReceipts.length
      recentReceipts = dbReceipts
      totalOmset = dbReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
    }
  } catch (err) {}

  // Get staff list
  const staffList: any[] = []

  // Invoices list
  const invoices: any[] = []

  // Audit logs for this tenant
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
    staffList,
    invoices,
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
    if (logs.length > 500) logs = logs.slice(0, 500) // keep latest 500
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

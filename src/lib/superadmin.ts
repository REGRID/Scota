import { supabase } from "@/lib/supabase"
import { getSubscriptionInfo, TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { getUserAccountDetails } from "@/lib/adminAccounts"
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
  status: "active" | "expired" | "trial"
  totalReceiptsCount?: number
  totalReceiptsAmount?: number
}

export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  totalReceipts: number
  totalTransactionVolume: number
  tierBreakdown: {
    trial: number
    starter: number
    pro: number
    enterprise: number
  }
  recentRegistrations: TenantSummary[]
}

/**
 * Fetch aggregated platform statistics for Superadmin Dashboard
 */
export async function getSuperadminPlatformStats(): Promise<PlatformStats> {
  const tenants = await getAllTenants()
  const now = new Date()

  let totalReceipts = 0
  let totalTransactionVolume = 0

  // 1. Calculate receipts stats from Supabase
  try {
    const { data: receipts } = await supabase
      .from("receipts")
      .select("totalAmount")
    
    if (receipts && receipts.length > 0) {
      totalReceipts = receipts.length
      totalTransactionVolume = receipts.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0)
    }
  } catch (err) {
    console.warn("Superadmin receipts query notice:", err)
  }

  // 2. Count tier breakdown
  const tierBreakdown = {
    trial: 0,
    starter: 0,
    pro: 0,
    enterprise: 0,
  }

  let activeTenants = 0

  for (const t of tenants) {
    const tTier = t.tier || "trial"
    if (tierBreakdown[tTier] !== undefined) {
      tierBreakdown[tTier]++
    } else {
      tierBreakdown.trial++
    }

    if (new Date(t.validUntil) >= now) {
      activeTenants++
    }
  }

  return {
    totalTenants: tenants.length,
    activeTenants: activeTenants || tenants.length,
    totalReceipts,
    totalTransactionVolume,
    tierBreakdown,
    recentRegistrations: tenants.slice(0, 10),
  }
}

/**
 * Fetch list of all registered business tenants
 */
export async function getAllTenants(): Promise<TenantSummary[]> {
  const tenantsMap = new Map<string, TenantSummary>()

  // 1. Load from Supabase `admin_accounts`
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

        tenantsMap.set(cleanUser, {
          username: cleanUser,
          fullName: acc.fullName || cleanUser,
          businessName: acc.businessName || acc.fullName || "Scota Business",
          phone: acc.phone || "",
          role: acc.role || "ADMIN",
          tier,
          validUntil: acc.validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          monthlyScanLimit: acc.monthlyScanLimit || tierCfg.monthlyScanLimit,
          usedScansThisMonth: acc.usedScansThisMonth || 0,
          createdAt: acc.createdAt || new Date().toISOString(),
          status: new Date(acc.validUntil || Date.now() + 14 * 24 * 60 * 60 * 1000) < new Date() ? "expired" : (tier === "trial" ? "trial" : "active"),
        })
      }
    }
  } catch (err) {
    console.warn("getAllTenants Supabase query notice:", err)
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

  return Array.from(tenantsMap.values())
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

    return {
      success: true,
      message: `Paket ${cleanUser} berhasil diupdate ke ${tierConfig.name} hingga ${new Date(validUntilIso).toLocaleDateString("id-ID")}`,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal update langganan tenant" }
  }
}

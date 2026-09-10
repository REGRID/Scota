import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import {
  SubscriptionInfo,
  SubscriptionTier,
  StudioProfile,
  ApprovalWorkflowConfig,
  TIER_CONFIG,
  DEFAULT_STUDIO_PROFILE,
  DEFAULT_APPROVAL_WORKFLOW,
} from "@/lib/subscription"
import { DEFAULT_TENANT_ID } from "@/lib/session"

// In-memory fallback per tenant
const inMemoryTenantSubscriptions = new Map<string, SubscriptionInfo>()

function getFallbackSubscription(tenantId: string): SubscriptionInfo {
  if (!inMemoryTenantSubscriptions.has(tenantId)) {
    inMemoryTenantSubscriptions.set(tenantId, {
      tier: "trial",
      status: "trial",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      monthlyScanLimit: 30,
      usedScansThisMonth: 0,
      studioProfile: { ...DEFAULT_STUDIO_PROFILE },
      approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
    })
  }
  return inMemoryTenantSubscriptions.get(tenantId)!
}

/**
 * Get active subscription status, studio profile, and approval workflow configuration
 * Scoped strictly to the specified tenantId.
 */
export async function getSubscriptionInfo(tenantId: string = DEFAULT_TENANT_ID): Promise<SubscriptionInfo> {
  const targetTenant = tenantId || DEFAULT_TENANT_ID
  const masterEmail = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()

  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<any>(
        `SELECT s.*, t."businessName", t.tagline as "tenantTagline", t.status as "tenantStatus",
                EXISTS (
                  SELECT 1 FROM admin_accounts a 
                  WHERE a."tenantId" = s."tenantId" 
                    AND (a.role = 'SUPERADMIN' OR a.role = 'DEVELOPER' OR LOWER(a.username) IN ('superadmin', 'developer') OR LOWER(a.email) = LOWER($2))
                ) as "isSuperadminTenant",
                EXISTS (
                  SELECT 1 FROM tenants t2 
                  JOIN users u ON u.id = t2."ownerId" 
                  WHERE t2.id = s."tenantId" 
                    AND LOWER(u.email) = LOWER($2)
                ) as "isSuperadminOwner"
         FROM subscriptions s 
         LEFT JOIN tenants t ON t.id = s."tenantId" 
         WHERE s."tenantId" = $1 LIMIT 1`,
        [targetTenant, masterEmail]
      )
      const data = res.rows?.[0]

      if (data) {
        const isSuperadminAccount =
          targetTenant === DEFAULT_TENANT_ID ||
          data.tier === "developer" ||
          Boolean(data.isSuperadminTenant) ||
          Boolean(data.isSuperadminOwner)

        const validUntil = isSuperadminAccount
          ? new Date("2099-12-31T23:59:59.999Z")
          : new Date(data.validUntil || Date.now() + 14 * 86400000)
        const now = new Date()
        const isExpired = !isSuperadminAccount && validUntil < now
        const isExpiring = !isSuperadminAccount && !isExpired && validUntil.getTime() - now.getTime() < 5 * 24 * 60 * 60 * 1000

        let status: SubscriptionInfo["status"] = "active"
        if (data.status === "suspended" || data.tenantStatus === "suspended") {
          status = "suspended"
        } else if (isSuperadminAccount) {
          status = "active"
        } else if (data.tier === "trial") {
          status = isExpired ? "expired" : "trial"
        } else if (isExpired) {
          status = "expired"
        } else if (isExpiring) {
          status = "expiring"
        }

        const resolvedStudioName =
          (data.studioName && data.studioName !== "Scota Business" ? data.studioName : data.businessName) ||
          data.studioName ||
          data.businessName ||
          DEFAULT_STUDIO_PROFILE.studioName

        const resolvedTagline =
          (data.tagline && data.tagline !== "Digitalisasi Struk & Pengeluaran Usaha" ? data.tagline : data.tenantTagline) ||
          data.tagline ||
          data.tenantTagline ||
          DEFAULT_STUDIO_PROFILE.tagline

        const profile: StudioProfile = {
          studioName: resolvedStudioName,
          tagline: resolvedTagline,
          address: data.address || DEFAULT_STUDIO_PROFILE.address,
          phone: data.phone || DEFAULT_STUDIO_PROFILE.phone,
          logoUrl: data.logoUrl || undefined,
          invoiceFooter: data.invoiceFooter || DEFAULT_STUDIO_PROFILE.invoiceFooter,
          taxNumber: data.taxNumber || undefined,
        }

        let workflow: ApprovalWorkflowConfig = { ...DEFAULT_APPROVAL_WORKFLOW }
        if (data.approvalWorkflow) {
          try {
            const parsed = typeof data.approvalWorkflow === "string" ? JSON.parse(data.approvalWorkflow) : data.approvalWorkflow
            workflow = { ...DEFAULT_APPROVAL_WORKFLOW, ...parsed }
          } catch (e) {}
        }

        const resolvedTier: SubscriptionTier = isSuperadminAccount
          ? "developer"
          : (data.tier as SubscriptionTier) || "trial"

        const resolvedMonthlyScanLimit = isSuperadminAccount
          ? 999999
          : (data.monthlyScanLimit || TIER_CONFIG[resolvedTier]?.monthlyScanLimit || 30)

        const result: SubscriptionInfo = {
          tier: resolvedTier,
          status,
          validUntil: isSuperadminAccount ? "2099-12-31T23:59:59.999Z" : (data.validUntil || validUntil.toISOString()),
          monthlyScanLimit: resolvedMonthlyScanLimit,
          usedScansThisMonth: isSuperadminAccount ? 0 : (data.usedScansThisMonth || 0),
          studioProfile: profile,
          activeLicenseKey: data.activeLicenseKey,
          approvalWorkflow: workflow,
        }

        inMemoryTenantSubscriptions.set(targetTenant, result)
        return result
      }
    } catch (e) {
      console.warn("Could not query PostgreSQL subscriptions table for tenant, using local cache:", e)
    }
  }

  // Fallback to in-memory state for this tenant
  if (targetTenant === DEFAULT_TENANT_ID) {
    return {
      tier: "developer",
      status: "active",
      validUntil: "2099-12-31T23:59:59.999Z",
      monthlyScanLimit: 999999,
      usedScansThisMonth: 0,
      studioProfile: { ...DEFAULT_STUDIO_PROFILE },
      approvalWorkflow: { ...DEFAULT_APPROVAL_WORKFLOW },
    }
  }

  // Fallback to in-memory state for this tenant
  const fallback = getFallbackSubscription(targetTenant)
  const validUntil = new Date(fallback.validUntil)
  const now = new Date()
  if (validUntil < now) {
    fallback.status = "expired"
  }

  return { ...fallback }
}

/**
 * Update Approval Workflow settings for tenant
 */
export async function updateApprovalWorkflow(
  workflow: Partial<ApprovalWorkflowConfig>,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<ApprovalWorkflowConfig> {
  const targetTenant = tenantId || DEFAULT_TENANT_ID
  const current = await getSubscriptionInfo(targetTenant)
  const updatedWorkflow: ApprovalWorkflowConfig = {
    ...(current.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW),
    ...workflow,
  }

  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO subscriptions ("tenantId", tier, "studioName", "approvalWorkflow", "createdAt", "updatedAt")
         VALUES ($1, 'trial', $2, $3, NOW(), NOW())
         ON CONFLICT ("tenantId") 
         DO UPDATE SET "approvalWorkflow" = EXCLUDED."approvalWorkflow", "updatedAt" = NOW()`,
        [targetTenant, current.studioProfile.studioName || "Bisnis", JSON.stringify(updatedWorkflow)]
      )
    } catch (err) {
      console.warn("Could not persist approval workflow to PostgreSQL database:", err)
    }
  }

  const currentMem = getFallbackSubscription(targetTenant)
  currentMem.approvalWorkflow = updatedWorkflow
  return updatedWorkflow
}

/**
 * Activate or upgrade subscription with a License Voucher Key for a specific tenant
 */
export async function activateLicenseKey(
  licenseKey: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<{ success: boolean; message: string; sub?: SubscriptionInfo }> {
  const targetTenant = tenantId || DEFAULT_TENANT_ID
  const cleanKey = licenseKey.trim().toUpperCase()

  if (!cleanKey) {
    return { success: false, message: "Kunci lisensi tidak boleh kosong" }
  }

  let tier: SubscriptionTier = "pro"
  let durationDays = 30

  if (cleanKey.startsWith("NP-STARTER-1Y") || cleanKey.startsWith("STARTER-1Y")) {
    tier = "starter"
    durationDays = 365
  } else if (cleanKey.startsWith("NP-STARTER") || cleanKey.startsWith("STARTER")) {
    tier = "starter"
    durationDays = 30
  } else if (cleanKey.startsWith("NP-ENT-1Y") || cleanKey.startsWith("ENT-1Y") || cleanKey.startsWith("ENTERPRISE")) {
    tier = "enterprise"
    durationDays = 365
  } else if (cleanKey.startsWith("NP-PRO-1Y") || cleanKey.startsWith("PRO-1Y")) {
    tier = "pro"
    durationDays = 365
  } else if (cleanKey.startsWith("NP-PRO") || cleanKey.startsWith("PRO") || cleanKey.length >= 10) {
    tier = "pro"
    durationDays = 30
  } else {
    return { success: false, message: "Format kunci lisensi tidak valid. Hubungi tim sales/billing." }
  }

  const currentInfo = await getSubscriptionInfo(targetTenant)
  const currentExpiry = new Date(currentInfo.validUntil)
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date()
  const newValidUntil = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  const monthlyScanLimit = TIER_CONFIG[tier].monthlyScanLimit

  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "activeLicenseKey", "studioName", tagline, address, phone, "invoiceFooter", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT ("tenantId")
         DO UPDATE SET tier = EXCLUDED.tier, "validUntil" = EXCLUDED."validUntil", "monthlyScanLimit" = EXCLUDED."monthlyScanLimit", "activeLicenseKey" = EXCLUDED."activeLicenseKey", "updatedAt" = NOW()`,
        [
          targetTenant,
          tier,
          newValidUntil,
          monthlyScanLimit,
          cleanKey,
          currentInfo.studioProfile.studioName,
          currentInfo.studioProfile.tagline,
          currentInfo.studioProfile.address,
          currentInfo.studioProfile.phone,
          currentInfo.studioProfile.invoiceFooter,
        ]
      )
    } catch (err) {
      console.warn("Could not save to PostgreSQL subscriptions table:", err)
    }
  }

  const updatedSub: SubscriptionInfo = {
    ...currentInfo,
    tier,
    status: "active",
    validUntil: newValidUntil,
    monthlyScanLimit,
    activeLicenseKey: cleanKey,
  }

  inMemoryTenantSubscriptions.set(targetTenant, updatedSub)

  return {
    success: true,
    message: `Lisensi ${TIER_CONFIG[tier].name} berhasil diaktifkan hingga ${new Date(newValidUntil).toLocaleDateString("id-ID", { dateStyle: "long" })}!`,
    sub: updatedSub,
  }
}

/**
 * Update Studio Profile details for tenant
 */
export async function updateStudioProfile(
  profile: Partial<StudioProfile>,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<StudioProfile> {
  const targetTenant = tenantId || DEFAULT_TENANT_ID
  const current = await getSubscriptionInfo(targetTenant)
  const updatedProfile: StudioProfile = {
    ...current.studioProfile,
    ...profile,
  }

  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT ("tenantId")
         DO UPDATE SET "studioName" = EXCLUDED."studioName", tagline = EXCLUDED.tagline, address = EXCLUDED.address, phone = EXCLUDED.phone, "logoUrl" = EXCLUDED."logoUrl", "invoiceFooter" = EXCLUDED."invoiceFooter", "taxNumber" = EXCLUDED."taxNumber", "updatedAt" = NOW()`,
        [
          targetTenant,
          current.tier,
          current.validUntil,
          current.monthlyScanLimit,
          current.usedScansThisMonth,
          updatedProfile.studioName,
          updatedProfile.tagline,
          updatedProfile.address,
          updatedProfile.phone,
          updatedProfile.logoUrl || null,
          updatedProfile.invoiceFooter,
          updatedProfile.taxNumber || null,
        ]
      )

      // Also update tenants table
      await queryPg(
        `UPDATE tenants 
         SET "businessName" = $1, tagline = $2, address = $3, phone = $4, "logoUrl" = $5, "invoiceFooter" = $6, "taxNumber" = $7, "updatedAt" = NOW()
         WHERE id = $8`,
        [
          updatedProfile.studioName,
          updatedProfile.tagline,
          updatedProfile.address,
          updatedProfile.phone,
          updatedProfile.logoUrl || null,
          updatedProfile.invoiceFooter,
          updatedProfile.taxNumber || null,
          targetTenant,
        ]
      ).catch(() => {})
    } catch (err) {
      console.warn("Could not persist studio profile to PostgreSQL database:", err)
    }
  }

  const currentMem = getFallbackSubscription(targetTenant)
  currentMem.studioProfile = updatedProfile
  return updatedProfile
}

/**
 * Save / Update Full Subscription Info for tenant
 */
export async function saveSubscriptionInfo(
  info: SubscriptionInfo,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<SubscriptionInfo> {
  const targetTenant = tenantId || DEFAULT_TENANT_ID
  inMemoryTenantSubscriptions.set(targetTenant, { ...info })

  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber", "activeLicenseKey", "approvalWorkflow", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
         ON CONFLICT ("tenantId")
         DO UPDATE SET 
           tier = EXCLUDED.tier, 
           "validUntil" = EXCLUDED."validUntil", 
           "monthlyScanLimit" = EXCLUDED."monthlyScanLimit", 
           "usedScansThisMonth" = EXCLUDED."usedScansThisMonth", 
           "studioName" = EXCLUDED."studioName", 
           tagline = EXCLUDED.tagline, 
           address = EXCLUDED.address, 
           phone = EXCLUDED.phone, 
           "logoUrl" = EXCLUDED."logoUrl", 
           "invoiceFooter" = EXCLUDED."invoiceFooter", 
           "taxNumber" = EXCLUDED."taxNumber", 
           "activeLicenseKey" = EXCLUDED."activeLicenseKey", 
           "approvalWorkflow" = EXCLUDED."approvalWorkflow", 
           "updatedAt" = NOW()`,
        [
          targetTenant,
          info.tier,
          info.validUntil,
          info.monthlyScanLimit,
          info.usedScansThisMonth,
          info.studioProfile.studioName,
          info.studioProfile.tagline,
          info.studioProfile.address,
          info.studioProfile.phone,
          info.studioProfile.logoUrl || null,
          info.studioProfile.invoiceFooter,
          info.studioProfile.taxNumber || null,
          info.activeLicenseKey || null,
          info.approvalWorkflow ? JSON.stringify(info.approvalWorkflow) : null,
        ]
      )
    } catch (err) {
      console.warn("Could not save full subscription info to PostgreSQL database:", err)
    }
  }

  return inMemoryTenantSubscriptions.get(targetTenant)!
}

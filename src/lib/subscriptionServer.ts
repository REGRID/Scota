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
  const masterEmail = (process.env.SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()

  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<any>(
        `SELECT s.*, t."businessName", t.tagline as "tenantTagline", t.status as "tenantStatus",
                t."createdAt" as "tenantCreatedAt", t."expiresAt" as "tenantExpiresAt",
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
                ) as "isSuperadminOwner",
                EXISTS (
                  SELECT 1 FROM billing_transactions b
                  WHERE b."tenantId" = s."tenantId"
                    AND (b.status = 'lunas' OR b.status = 'completed')
                ) as "hasPaidTransaction"
         FROM subscriptions s 
         LEFT JOIN tenants t ON t.id = s."tenantId" 
         WHERE s."tenantId" = $1 LIMIT 1`,
        [targetTenant, masterEmail]
      )
      let data = res.rows?.[0]

      // If subscription row not found for this tenant, look up tenant and recent transactions
      if (!data) {
        const tenantLookup = await queryPg<any>(
          `SELECT t.*, u.email as "ownerEmail",
                  EXISTS (
                    SELECT 1 FROM admin_accounts a 
                    WHERE a."tenantId" = t.id 
                      AND (a.role = 'SUPERADMIN' OR a.role = 'DEVELOPER' OR LOWER(a.username) IN ('superadmin', 'developer') OR LOWER(a.email) = LOWER($2))
                  ) as "isSuperadminTenant",
                  (LOWER(u.email) = LOWER($2)) as "isSuperadminOwner",
                  EXISTS (
                    SELECT 1 FROM billing_transactions b
                    WHERE b."tenantId" = t.id
                      AND (b.status = 'lunas' OR b.status = 'completed')
                  ) as "hasPaidTransaction"
           FROM tenants t 
           LEFT JOIN users u ON u.id = t."ownerId" 
           WHERE t.id = $1 LIMIT 1`,
          [targetTenant, masterEmail]
        )
        const tenantRow = tenantLookup.rows?.[0]

        if (tenantRow) {
          // Check if there is any completed billing transaction
          const trxLookup = await queryPg<any>(
            `SELECT tier, "billingCycle", "completedAt"
             FROM billing_transactions
             WHERE "tenantId" = $1 AND (status = 'lunas' OR status = 'completed')
             ORDER BY "completedAt" DESC, "createdAt" DESC LIMIT 1`,
            [targetTenant]
          )
          const latestTrx = trxLookup.rows?.[0]

          const assignedTier: SubscriptionTier = latestTrx?.tier || "trial"
          const scanLimit = TIER_CONFIG[assignedTier]?.monthlyScanLimit || 30
          const durationDays = latestTrx?.billingCycle === "yearly" ? 365 : 30
          const baseExpiry = latestTrx?.completedAt 
            ? new Date(new Date(latestTrx.completedAt).getTime() + durationDays * 86400000)
            : tenantRow.expiresAt
            ? new Date(tenantRow.expiresAt)
            : new Date(Date.now() + 14 * 86400000)

          try {
            await queryPg(
              `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, 0, $6, NOW(), NOW())
               ON CONFLICT ("tenantId") DO NOTHING`,
              [
                targetTenant,
                assignedTier,
                assignedTier === "trial" ? "trial" : "active",
                baseExpiry.toISOString(),
                scanLimit,
                tenantRow.businessName || "Bisnis Scota",
              ]
            )
          } catch (seedErr) {
            console.warn("Could not auto-seed missing subscription row:", seedErr)
          }

          data = {
            tenantId: targetTenant,
            tier: assignedTier,
            status: assignedTier === "trial" ? "trial" : "active",
            validUntil: baseExpiry.toISOString(),
            monthlyScanLimit: scanLimit,
            usedScansThisMonth: 0,
            businessName: tenantRow.businessName,
            tenantTagline: tenantRow.tagline,
            tenantStatus: tenantRow.status,
            isSuperadminTenant: tenantRow.isSuperadminTenant,
            isSuperadminOwner: tenantRow.isSuperadminOwner,
            hasPaidTransaction: Boolean(latestTrx),
          }
        }
      }

      if (data) {
        const isDeveloperTier =
          data.isSuperadminTenant ||
          data.isSuperadminOwner ||
          (data.tier === "developer" && (data.hasPaidTransaction || data.activeLicenseKey))

        // Strict business rule: Every new/unpaid non-superadmin tenant MUST remain "trial"
        const isPaidOrAuthorized =
          isDeveloperTier ||
          data.hasPaidTransaction ||
          Boolean(data.activeLicenseKey)

        if (!isPaidOrAuthorized && data.tier !== "trial") {
          console.warn(`[SubscriptionServer] Tenant ${targetTenant} is non-trial (${data.tier}) without payment or license. Reverting to trial.`);
          data.tier = "trial";
          data.status = "trial";
          data.monthlyScanLimit = 30;
          try {
            await queryPg(
              `UPDATE subscriptions 
               SET tier = 'trial', status = 'trial', "monthlyScanLimit" = 30, "updatedAt" = NOW()
               WHERE "tenantId" = $1`,
              [targetTenant]
            );
          } catch {}
        }

        const rawValidUntil = data.validUntil || (data as any).validuntil || data.tenantExpiresAt
        const validUntil = isDeveloperTier
          ? new Date("2099-12-31T23:59:59.999Z")
          : rawValidUntil
          ? new Date(rawValidUntil)
          : new Date(Date.now() + 14 * 86400000)

        const now = new Date()
        const isExpired = !isDeveloperTier && validUntil < now
        const isExpiring = !isDeveloperTier && !isExpired && validUntil.getTime() - now.getTime() < 5 * 24 * 60 * 60 * 1000

        let status: SubscriptionInfo["status"] = "active"
        if (data.status === "suspended" || data.tenantStatus === "suspended") {
          status = "suspended"
        } else if (isDeveloperTier) {
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

        const resolvedTier: SubscriptionTier =
          (data.tier as SubscriptionTier) ||
          (isDeveloperTier ? "developer" : "trial")

        const resolvedMonthlyScanLimit = isDeveloperTier
          ? 999999
          : (data.monthlyScanLimit || (data as any).monthlyscanlimit || TIER_CONFIG[resolvedTier]?.monthlyScanLimit || 30)

        const result: SubscriptionInfo = {
          tier: resolvedTier,
          status,
          validUntil: isDeveloperTier ? "2099-12-31T23:59:59.999Z" : validUntil.toISOString(),
          monthlyScanLimit: resolvedMonthlyScanLimit,
          usedScansThisMonth: isDeveloperTier ? 0 : (data.usedScansThisMonth || (data as any).usedscansthismonth || 0),
          studioProfile: profile,
          activeLicenseKey: data.activeLicenseKey || (data as any).activelicensekey,
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
      tier: "trial",
      status: "trial",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      monthlyScanLimit: 30,
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

  if (cleanKey.includes("DEV") || cleanKey.includes("DEVELOPER") || cleanKey.includes("MASTER")) {
    tier = "developer"
    durationDays = 36500
  } else if (cleanKey.includes("STARTER") && (cleanKey.includes("1Y") || cleanKey.includes("YEAR") || cleanKey.includes("TAHUN"))) {
    tier = "starter"
    durationDays = 365
  } else if (cleanKey.includes("STARTER")) {
    tier = "starter"
    durationDays = 30
  } else if ((cleanKey.includes("ENT") || cleanKey.includes("ENTERPRISE")) && (cleanKey.includes("1Y") || cleanKey.includes("YEAR") || cleanKey.includes("TAHUN"))) {
    tier = "enterprise"
    durationDays = 365
  } else if (cleanKey.includes("ENT") || cleanKey.includes("ENTERPRISE")) {
    tier = "enterprise"
    durationDays = 30
  } else if (cleanKey.includes("PRO") && (cleanKey.includes("1Y") || cleanKey.includes("YEAR") || cleanKey.includes("TAHUN"))) {
    tier = "pro"
    durationDays = 365
  } else if (cleanKey.includes("PRO")) {
    tier = "pro"
    durationDays = 30
  } else if (cleanKey.includes("TRIAL")) {
    tier = "trial"
    durationDays = 14
  } else {
    return { success: false, message: "Format kunci lisensi tidak valid. Hubungi tim sales/billing." }
  }

  const currentInfo = await getSubscriptionInfo(targetTenant)
  const currentExpiry = new Date(currentInfo.validUntil)
  const baseDate = currentExpiry > new Date() && currentInfo.tier === tier ? currentExpiry : new Date()
  const newValidUntil = tier === "developer" 
    ? "2099-12-31T23:59:59.999Z" 
    : new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  const monthlyScanLimit = TIER_CONFIG[tier].monthlyScanLimit

  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "activeLicenseKey", "studioName", tagline, address, phone, "invoiceFooter", "createdAt", "updatedAt")
         VALUES ($1, $2, 'active', $3, $4, 0, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT ("tenantId")
         DO UPDATE SET tier = EXCLUDED.tier, status = 'active', "validUntil" = EXCLUDED."validUntil", "monthlyScanLimit" = EXCLUDED."monthlyScanLimit", "activeLicenseKey" = EXCLUDED."activeLicenseKey", "updatedAt" = NOW()`,
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

      await queryPg(
        `UPDATE tenants
         SET status = 'active',
             "expiresAt" = $1,
             "updatedAt" = NOW()
         WHERE id = $2`,
        [newValidUntil, targetTenant]
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

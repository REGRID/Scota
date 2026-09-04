import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import {
  SubscriptionInfo,
  SubscriptionTier,
  StudioProfile,
  TIER_CONFIG,
  DEFAULT_STUDIO_PROFILE,
} from "@/lib/subscription"

// In-memory fallback if database table not yet configured
let inMemorySubscription: SubscriptionInfo = {
  tier: "starter",
  status: "active",
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  monthlyScanLimit: 150,
  usedScansThisMonth: 0,
  studioProfile: { ...DEFAULT_STUDIO_PROFILE },
}

/**
 * Get active subscription status and studio profile
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<any>(
        `SELECT * FROM subscriptions ORDER BY "createdAt" ASC LIMIT 1`
      )
      const data = res.rows?.[0]

      if (data) {
        const validUntil = new Date(data.validUntil || Date.now() + 30 * 86400000)
        const now = new Date()
        const isExpired = validUntil < now
        const isExpiring = !isExpired && validUntil.getTime() - now.getTime() < 5 * 24 * 60 * 60 * 1000

        let status: SubscriptionInfo["status"] = "active"
        if (data.tier === "trial") status = isExpired ? "expired" : "trial"
        else if (isExpired) status = "expired"
        else if (isExpiring) status = "expiring"

        const profile: StudioProfile = {
          studioName: data.studioName || DEFAULT_STUDIO_PROFILE.studioName,
          tagline: data.tagline || DEFAULT_STUDIO_PROFILE.tagline,
          address: data.address || DEFAULT_STUDIO_PROFILE.address,
          phone: data.phone || DEFAULT_STUDIO_PROFILE.phone,
          logoUrl: data.logoUrl || undefined,
          invoiceFooter: data.invoiceFooter || DEFAULT_STUDIO_PROFILE.invoiceFooter,
          taxNumber: data.taxNumber || undefined,
        }

        return {
          tier: (data.tier as SubscriptionTier) || "starter",
          status,
          validUntil: data.validUntil || validUntil.toISOString(),
          monthlyScanLimit: data.monthlyScanLimit || TIER_CONFIG[(data.tier as SubscriptionTier) || "starter"]?.monthlyScanLimit || 150,
          usedScansThisMonth: data.usedScansThisMonth || 0,
          studioProfile: profile,
          activeLicenseKey: data.activeLicenseKey,
        }
      }
    } catch (e) {
      console.warn("Could not query PostgreSQL subscriptions table, using local cache:", e)
    }
  }

  // Fallback to in-memory state
  const validUntil = new Date(inMemorySubscription.validUntil)
  const now = new Date()
  const isExpired = validUntil < now
  if (isExpired) {
    inMemorySubscription.status = "expired"
  }

  return { ...inMemorySubscription }
}

/**
 * Activate or upgrade subscription with a License Voucher Key
 */
export async function activateLicenseKey(licenseKey: string): Promise<{ success: boolean; message: string; sub?: SubscriptionInfo }> {
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

  const currentInfo = await getSubscriptionInfo()
  const currentExpiry = new Date(currentInfo.validUntil)
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date()
  const newValidUntil = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  const monthlyScanLimit = TIER_CONFIG[tier].monthlyScanLimit

  if (isDatabaseConfigured) {
    try {
      const existingRes = await queryPg(`SELECT id FROM subscriptions LIMIT 1`)
      const existing = existingRes.rows?.[0]

      if (existing) {
        await queryPg(
          `UPDATE subscriptions 
           SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, "activeLicenseKey" = $4, "updatedAt" = NOW()
           WHERE id = $5`,
          [tier, newValidUntil, monthlyScanLimit, cleanKey, existing.id]
        )
      } else {
        await queryPg(
          `INSERT INTO subscriptions (tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "activeLicenseKey", "studioName", tagline, address, phone, "invoiceFooter", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
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
      }
    } catch (err) {
      console.warn("Could not save to PostgreSQL subscriptions table:", err)
    }
  }

  inMemorySubscription = {
    ...currentInfo,
    tier,
    status: "active",
    validUntil: newValidUntil,
    monthlyScanLimit,
    activeLicenseKey: cleanKey,
  }

  return {
    success: true,
    message: `Lisensi ${TIER_CONFIG[tier].name} berhasil diaktifkan hingga ${new Date(newValidUntil).toLocaleDateString("id-ID", { dateStyle: "long" })}!`,
    sub: inMemorySubscription,
  }
}

/**
 * Update Studio Profile details
 */
export async function updateStudioProfile(profile: Partial<StudioProfile>): Promise<StudioProfile> {
  const current = await getSubscriptionInfo()
  const updatedProfile: StudioProfile = {
    ...current.studioProfile,
    ...profile,
  }

  if (isDatabaseConfigured) {
    try {
      const existingRes = await queryPg(`SELECT id FROM subscriptions LIMIT 1`)
      const existing = existingRes.rows?.[0]

      if (existing) {
        await queryPg(
          `UPDATE subscriptions
           SET "studioName" = $1, tagline = $2, address = $3, phone = $4, "logoUrl" = $5, "invoiceFooter" = $6, "taxNumber" = $7, "updatedAt" = NOW()
           WHERE id = $8`,
          [
            updatedProfile.studioName,
            updatedProfile.tagline,
            updatedProfile.address,
            updatedProfile.phone,
            updatedProfile.logoUrl || null,
            updatedProfile.invoiceFooter,
            updatedProfile.taxNumber || null,
            existing.id,
          ]
        )
      } else {
        await queryPg(
          `INSERT INTO subscriptions (tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          [
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
      }
    } catch (err) {
      console.warn("Could not persist studio profile to PostgreSQL database:", err)
    }
  }

  inMemorySubscription.studioProfile = updatedProfile
  return updatedProfile
}

/**
 * Save / Update Full Subscription Info
 */
export async function saveSubscriptionInfo(info: SubscriptionInfo): Promise<SubscriptionInfo> {
  inMemorySubscription = { ...info }

  if (isDatabaseConfigured) {
    try {
      const existingRes = await queryPg(`SELECT id FROM subscriptions LIMIT 1`)
      const existing = existingRes.rows?.[0]

      if (existing) {
        await queryPg(
          `UPDATE subscriptions
           SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, "usedScansThisMonth" = $4, "studioName" = $5, tagline = $6, address = $7, phone = $8, "logoUrl" = $9, "invoiceFooter" = $10, "taxNumber" = $11, "activeLicenseKey" = $12, "updatedAt" = NOW()
           WHERE id = $13`,
          [
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
            existing.id,
          ]
        )
      } else {
        await queryPg(
          `INSERT INTO subscriptions (tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber", "activeLicenseKey", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [
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
          ]
        )
      }
    } catch (err) {
      console.warn("Could not save full subscription info to PostgreSQL database:", err)
    }
  }

  return inMemorySubscription
}

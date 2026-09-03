import { supabase } from "@/lib/supabase"

export type SubscriptionTier = "trial" | "starter" | "pro" | "enterprise"

export interface StudioProfile {
  studioName: string
  tagline: string
  address: string
  phone: string
  logoUrl?: string
  invoiceFooter: string
  taxNumber?: string
}

export interface SubscriptionInfo {
  tier: SubscriptionTier
  status: "active" | "expiring" | "expired" | "trial"
  validUntil: string // ISO string
  monthlyScanLimit: number
  usedScansThisMonth: number
  studioProfile: StudioProfile
  activeLicenseKey?: string
}

export interface TierConfig {
  name: string
  monthlyScanLimit: number
  priceMonthly: number
  priceYearly: number
  maxUsers: number
  features: string[]
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  trial: {
    name: "Trial / Percobaan",
    monthlyScanLimit: 30,
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 2,
    features: [
      "30 Scan Nota AI / bulan",
      "Katalog Kategori Otomatis",
      "Verifikasi & Persetujuan Admin",
      "Format PDF Standar",
    ],
  },
  starter: {
    name: "Starter Bisnis",
    monthlyScanLimit: 150,
    priceMonthly: 79000,
    priceYearly: 790000,
    maxUsers: 3,
    features: [
      "150 Scan Nota AI / bulan",
      "Kustomisasi Nama & Logo Usaha",
      "Ekspor Laporan PDF & Excel Resmi",
      "Multi-Akun (Admin 1, Admin 2, Karyawan)",
      "PWA Notifikasi Kasir & Admin",
    ],
  },
  pro: {
    name: "Pro Usaha",
    monthlyScanLimit: 600,
    priceMonthly: 199000,
    priceYearly: 1990000,
    maxUsers: 10,
    features: [
      "600 Scan Nota AI / bulan",
      "AI Vision Multi-Foto & Faktur Panjang",
      "Custom Watermark Resmi Usaha di PDF",
      "Self-Learning AI Memory (Auto-Katalog)",
      "Pencadangan Otomatis & Export Akuntansi",
      "Dukungan WhatsApp Prioritas",
    ],
  },
  enterprise: {
    name: "Enterprise Multi-Cabang",
    monthlyScanLimit: 99999,
    priceMonthly: 499000,
    priceYearly: 4990000,
    maxUsers: 99,
    features: [
      "Unlimited Scan Nota AI",
      "Dukungan Multi-Cabang & Multi-Usaha",
      "Custom POS Sync / Webhook API",
      "Dedicated Database & SLA 99.9%",
      "Onboarding & Training Tim Khusus",
    ],
  },
}

export const DEFAULT_STUDIO_PROFILE: StudioProfile = {
  studioName: "Scota Business",
  tagline: "Digitalisasi Struk & Pengeluaran Usaha",
  address: "Jl. Bisnis No. 1, Jakarta",
  phone: "0812-3456-7890",
  invoiceFooter: "Terima kasih atas kerja sama Anda dengan usaha kami.",
}

// In-memory fallback if database table not yet migrated
let inMemorySubscription: SubscriptionInfo = {
  tier: "trial",
  status: "trial",
  validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days default trial
  monthlyScanLimit: 30,
  usedScansThisMonth: 0,
  studioProfile: { ...DEFAULT_STUDIO_PROFILE },
}

/**
 * Get active subscription status and studio profile
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .limit(1)
      .maybeSingle()

    if (data && !error) {
      const validUntil = new Date(data.validUntil)
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
        tier: data.tier || "trial",
        status,
        validUntil: data.validUntil,
        monthlyScanLimit: data.monthlyScanLimit || TIER_CONFIG[data.tier as SubscriptionTier]?.monthlyScanLimit || 30,
        usedScansThisMonth: data.usedScansThisMonth || 0,
        studioProfile: profile,
        activeLicenseKey: data.activeLicenseKey,
      }
    }
  } catch (e) {
    console.warn("Could not query subscriptions table, using local cache:", e)
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
 * Supported License Key Formats:
 * - NP-PRO-30D-XXXX (Pro 30 Days)
 * - NP-PRO-1Y-XXXX (Pro 1 Year)
 * - NP-ENT-1Y-XXXX (Enterprise 1 Year)
 * - NP-STARTER-30D-XXXX (Starter 30 Days)
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

  try {
    const { data: existing } = await supabase.from("subscriptions").select("id").limit(1).maybeSingle()

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          tier,
          validUntil: newValidUntil,
          monthlyScanLimit,
          activeLicenseKey: cleanKey,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("subscriptions").insert({
        tier,
        validUntil: newValidUntil,
        monthlyScanLimit,
        usedScansThisMonth: 0,
        activeLicenseKey: cleanKey,
        studioName: currentInfo.studioProfile.studioName,
        tagline: currentInfo.studioProfile.tagline,
        address: currentInfo.studioProfile.address,
        phone: currentInfo.studioProfile.phone,
        invoiceFooter: currentInfo.studioProfile.invoiceFooter,
      })
    }
  } catch (err) {
    console.warn("Could not save to Supabase subscriptions table:", err)
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

  try {
    const { data: existing } = await supabase.from("subscriptions").select("id").limit(1).maybeSingle()
    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          studioName: updatedProfile.studioName,
          tagline: updatedProfile.tagline,
          address: updatedProfile.address,
          phone: updatedProfile.phone,
          logoUrl: updatedProfile.logoUrl,
          invoiceFooter: updatedProfile.invoiceFooter,
          taxNumber: updatedProfile.taxNumber,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("subscriptions").insert({
        tier: current.tier,
        validUntil: current.validUntil,
        monthlyScanLimit: current.monthlyScanLimit,
        usedScansThisMonth: current.usedScansThisMonth,
        studioName: updatedProfile.studioName,
        tagline: updatedProfile.tagline,
        address: updatedProfile.address,
        phone: updatedProfile.phone,
        logoUrl: updatedProfile.logoUrl,
        invoiceFooter: updatedProfile.invoiceFooter,
        taxNumber: updatedProfile.taxNumber,
      })
    }
  } catch (err) {
    console.warn("Could not persist studio profile to database:", err)
  }

  inMemorySubscription.studioProfile = updatedProfile
  return updatedProfile
}

/**
 * Save / Update Full Subscription Info
 */
export async function saveSubscriptionInfo(info: SubscriptionInfo): Promise<SubscriptionInfo> {
  inMemorySubscription = { ...info }

  try {
    const { data: existing } = await supabase.from("subscriptions").select("id").limit(1).maybeSingle()
    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          tier: info.tier,
          validUntil: info.validUntil,
          monthlyScanLimit: info.monthlyScanLimit,
          usedScansThisMonth: info.usedScansThisMonth,
          studioName: info.studioProfile.studioName,
          tagline: info.studioProfile.tagline,
          address: info.studioProfile.address,
          phone: info.studioProfile.phone,
          logoUrl: info.studioProfile.logoUrl,
          invoiceFooter: info.studioProfile.invoiceFooter,
          taxNumber: info.studioProfile.taxNumber,
          activeLicenseKey: info.activeLicenseKey,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("subscriptions").insert({
        tier: info.tier,
        validUntil: info.validUntil,
        monthlyScanLimit: info.monthlyScanLimit,
        usedScansThisMonth: info.usedScansThisMonth,
        studioName: info.studioProfile.studioName,
        tagline: info.studioProfile.tagline,
        address: info.studioProfile.address,
        phone: info.studioProfile.phone,
        logoUrl: info.studioProfile.logoUrl,
        invoiceFooter: info.studioProfile.invoiceFooter,
        taxNumber: info.studioProfile.taxNumber,
        activeLicenseKey: info.activeLicenseKey,
      })
    }
  } catch (err) {
    console.warn("Could not save full subscription info to database:", err)
  }

  return inMemorySubscription
}


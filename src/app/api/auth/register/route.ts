import { NextRequest, NextResponse } from "next/server"
import { registerAdminAccount } from "@/lib/adminAccounts"
import { verifyEmailOtp } from "@/lib/emailSender"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { saveSubscriptionInfo, getSubscriptionInfo } from "@/lib/subscriptionServer"
import { createSessionToken } from "@/lib/session"
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"
import { queryPg } from "@/lib/pgDb"
import { normalizeIp } from "@/lib/rateLimiter"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip")?.trim() || 
               "127.0.0.1"

    // Rate Limiting Protection (Anti-Spam Tenant/Account: max 3 attempts per 60 minutes)
    const rateCheck = await checkAuthRateLimit(ip, "register")
    if (!rateCheck.allowed && rateCheck.lockedUntil) {
      return NextResponse.json(
        { error: formatLockoutMessage(rateCheck.lockedUntil) },
        { status: 429 }
      )
    }

    const { username, password, fullName, businessName, phone, email, selectedTier, interestedTier, googleId, otpCode, otp, claimReceiptId } = await req.json()

    const rawEmail = (email || (username && username.includes("@") ? username : "")).trim().toLowerCase()
    const cleanPassword = (password || "").trim()
    const cleanFullName = (fullName || "").trim()
    const cleanBusinessName = (businessName || "").trim()
    const cleanPhone = (phone || "").trim()
    const cleanGoogleId = (googleId || "").trim()
    const cleanOtp = (otpCode || otp || "").trim()

    // 1. Validasi Format Email Ketat
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return NextResponse.json({ error: "Alamat email wajib diisi dengan format yang valid (contoh: nama@bisnis.com)" }, { status: 400 })
    }
    const cleanEmail = rawEmail
    const cleanUsername = cleanEmail // Akun didaftarkan dengan ID berbasis email

    // 2. Verifikasi OTP Email untuk pendaftaran manual (non-Google)
    if (!cleanGoogleId) {
      if (!cleanOtp) {
        return NextResponse.json({ error: "Kode verifikasi OTP email wajib diisi" }, { status: 400 })
      }

      const verifyRes = await verifyEmailOtp(cleanEmail, cleanOtp)
      if (!verifyRes.valid) {
        return NextResponse.json({ error: verifyRes.error || "Kode verifikasi email salah atau kedaluwarsa" }, { status: 400 })
      }

      if (!cleanPassword) {
        return NextResponse.json({ error: "Password harus diisi" }, { status: 400 })
      }

      if (cleanPassword.length < 8) {
        return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
      }
    }

    // SECURITY ENFORCEMENT:
    // Pendaftaran mandiri (self-service) HANYA dan SELALU mendapatkan paket "trial".
    const activeTier: SubscriptionTier = "trial"
    const leadInterestedTier = (interestedTier || selectedTier || "trial").toLowerCase().trim()

    // Register as ADMIN role with strictly "trial" tier
    const regResult = await registerAdminAccount({
      username: cleanUsername,
      password: cleanPassword,
      fullName: cleanFullName,
      businessName: cleanBusinessName,
      phone: cleanPhone,
      email: cleanEmail,
      tier: activeTier,
      googleId: cleanGoogleId || undefined,
    })

    // Record registration attempt for this IP (success resets counter, failure increments)
    await recordAuthAttempt(ip, "register", regResult.success)

    if (!regResult.success) {
      const isConflict = regResult.error?.includes("sudah terdaftar") || regResult.error?.includes("sudah terhubung")
      return NextResponse.json(
        { error: regResult.error || "Gagal membuat akun Admin" }, 
        { status: isConflict ? 409 : 400 }
      )
    }

    // Initialize business subscription profile strictly as "trial" (14 days validity, 50 scan quota)
    try {
      const currentSub = await getSubscriptionInfo(regResult.tenantId)
      const tierConfig = TIER_CONFIG.trial
      const validityDays = 14

      const validUntilDate = new Date()
      validUntilDate.setDate(validUntilDate.getDate() + validityDays)

      await saveSubscriptionInfo({
        ...currentSub,
        tier: activeTier,
        status: "trial",
        monthlyScanLimit: tierConfig.monthlyScanLimit,
        usedScansThisMonth: 0,
        validUntil: validUntilDate.toISOString(),
        studioProfile: {
          ...currentSub.studioProfile,
          studioName: cleanBusinessName || cleanFullName || "Scota Business",
          phone: cleanPhone || currentSub.studioProfile.phone,
        },
      }, regResult.tenantId)
    } catch (subErr) {
      console.warn("Could not save initial subscription profile:", subErr)
    }

    // Generate secure signed JWT session token (HS256)
    const token = await createSessionToken({
      username: cleanUsername,
      role: "ADMIN",
      tenantId: regResult.tenantId,
      name: cleanFullName || cleanUsername,
    })

    // Transfer claimed demo receipt to the new business tenant if requested & verified by demo IP
    let claimedReceiptId: string | undefined = undefined
    if (claimReceiptId && regResult.tenantId) {
      try {
        const cleanIp = normalizeIp(ip)
        const claimRes = await queryPg<{ id: string }>(
          `UPDATE receipts 
           SET "tenantId" = $1, "updatedAt" = NOW()
           WHERE id = $2
             AND "tenantId" IN (
               SELECT id FROM tenants 
               WHERE "isDemo" = true AND "demoIpAddress" = $3
             )
           RETURNING id`,
          [regResult.tenantId, claimReceiptId, cleanIp]
        )

        if (claimRes.rows?.[0]?.id) {
          claimedReceiptId = claimRes.rows[0].id
          invalidateReceiptsListCache()
          console.log(`[Register] Successfully claimed demo receipt ${claimedReceiptId} for tenant ${regResult.tenantId}`)
        }
      } catch (claimErr) {
        console.warn("[Register] Could not claim demo receipt:", claimErr)
      }
    }

    const response = NextResponse.json({
      success: true,
      message: `Pendaftaran Admin (${cleanUsername}) berhasil!`,
      user: {
        username: cleanUsername,
        role: "ADMIN",
        tenantId: regResult.tenantId,
        fullName: cleanFullName,
        businessName: cleanBusinessName,
        tier: activeTier,
        interestedTier: leadInterestedTier,
        claimedReceiptId,
      },
    })

    response.cookies.set({
      name: "nota_admin_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: any) {
    console.error("Register API error:", error)
    return NextResponse.json({ error: error.message || "Terjadi kesalahan server saat pendaftaran" }, { status: 500 })
  }
}

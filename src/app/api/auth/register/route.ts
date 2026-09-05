import { NextRequest, NextResponse } from "next/server"
import { registerAdminAccount } from "@/lib/adminAccounts"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { saveSubscriptionInfo, getSubscriptionInfo } from "@/lib/subscriptionServer"
import { createSessionToken } from "@/lib/session"
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

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

    const { username, password, fullName, businessName, phone, selectedTier, interestedTier } = await req.json()

    const cleanUsername = (username || "").trim().toLowerCase()
    const cleanPassword = (password || "").trim()
    const cleanFullName = (fullName || "").trim()
    const cleanBusinessName = (businessName || "").trim()
    const cleanPhone = (phone || "").trim()

    // SECURITY ENFORCEMENT:
    // Pendaftaran mandiri (self-service) HANYA dan SELALU mendapatkan paket "trial".
    // Input `selectedTier` dari client tidak boleh dipercaya untuk menentukan hak akses/kuota aktif.
    const activeTier: SubscriptionTier = "trial"
    const leadInterestedTier = (interestedTier || selectedTier || "trial").toLowerCase().trim()

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: "ID Pengguna / Email dan Password harus diisi" }, { status: 400 })
    }

    if (cleanPassword.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
    }

    // Register as ADMIN role with strictly "trial" tier
    const regResult = await registerAdminAccount({
      username: cleanUsername,
      password: cleanPassword,
      fullName: cleanFullName,
      businessName: cleanBusinessName,
      phone: cleanPhone,
      tier: activeTier,
    })

    // Record registration attempt for this IP (success resets counter, failure increments)
    await recordAuthAttempt(ip, "register", regResult.success)

    if (!regResult.success) {
      return NextResponse.json({ error: regResult.error || "Gagal membuat akun Admin" }, { status: 400 })
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

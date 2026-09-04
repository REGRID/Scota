import { NextRequest, NextResponse } from "next/server"
import { registerAdminAccount } from "@/lib/adminAccounts"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { saveSubscriptionInfo, getSubscriptionInfo } from "@/lib/subscriptionServer"
import { createSessionToken } from "@/lib/session"

export async function POST(req: NextRequest) {
  try {
    const { username, password, fullName, businessName, phone, selectedTier } = await req.json()

    const cleanUsername = (username || "").trim().toLowerCase()
    const cleanPassword = (password || "").trim()
    const cleanFullName = (fullName || "").trim()
    const cleanBusinessName = (businessName || "").trim()
    const cleanPhone = (phone || "").trim()
    const tier = (selectedTier || "trial").toLowerCase() as SubscriptionTier

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: "ID Pengguna / Email dan Password harus diisi" }, { status: 400 })
    }

    if (cleanPassword.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
    }

    // Register as ADMIN role
    const regResult = await registerAdminAccount({
      username: cleanUsername,
      password: cleanPassword,
      fullName: cleanFullName,
      businessName: cleanBusinessName,
      phone: cleanPhone,
      tier,
    })

    if (!regResult.success) {
      return NextResponse.json({ error: regResult.error || "Gagal membuat akun Admin" }, { status: 400 })
    }

    // Initialize business subscription profile
    try {
      const currentSub = await getSubscriptionInfo()
      const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.trial
      const validityDays = tier === "trial" ? 14 : 30

      const validUntilDate = new Date()
      validUntilDate.setDate(validUntilDate.getDate() + validityDays)

      await saveSubscriptionInfo({
        ...currentSub,
        tier,
        status: tier === "trial" ? "trial" : "active",
        monthlyScanLimit: tierConfig.monthlyScanLimit,
        usedScansThisMonth: 0,
        validUntil: validUntilDate.toISOString(),
        studioProfile: {
          ...currentSub.studioProfile,
          studioName: cleanBusinessName || cleanFullName || "Scota Business",
          phone: cleanPhone || currentSub.studioProfile.phone,
        },
      })
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
        tier,
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

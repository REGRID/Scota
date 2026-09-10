import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { validateInviteToken, acceptInvite } from "@/lib/inviteSystem"
import { createSessionToken } from "@/lib/session"
import { checkAuthRateLimit, recordAuthAttempt } from "@/lib/authRateLimiter"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1"
    const rateCheck = await checkAuthRateLimit(ip, "invite_check")
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { valid: false, reason: "Terlalu banyak permintaan pemeriksaan undangan dari perangkat/IP ini. Silakan coba beberapa saat lagi." },
        { status: 429 }
      )
    }

    const { token } = await context.params
    if (!token) {
      return NextResponse.json({ valid: false, reason: "Token undangan tidak ditemukan." }, { status: 400 })
    }

    const check = await validateInviteToken(token)
    if (!check.valid) {
      await recordAuthAttempt(ip, "invite_check", false)
    }

    return NextResponse.json(check)
  } catch (error: any) {
    console.error("GET /api/invites/[token] error:", error)
    return NextResponse.json({ valid: false, reason: "Terjadi kesalahan saat memeriksa tautan undangan." }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    if (!token) {
      return NextResponse.json({ error: "Token undangan tidak valid." }, { status: 400 })
    }

    // 1. Get authenticated user from Clerk
    let user = null
    try {
      user = await currentUser()
    } catch (e) {
      console.warn("Clerk currentUser resolution error in invite acceptance:", e)
    }

    if (!user) {
      return NextResponse.json(
        { error: "Silakan login menggunakan Akun Google Anda terlebih dahulu untuk menerima undangan." },
        { status: 401 }
      )
    }

    const email = user.emailAddresses?.[0]?.emailAddress || ""
    if (!email) {
      return NextResponse.json(
        { error: "Akun Anda tidak memiliki alamat email yang valid." },
        { status: 400 }
      )
    }

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Staf Baru"
    const avatarUrl = user.imageUrl || undefined

    // 2. Accept invite & execute anti-overlap validation
    const result = await acceptInvite({
      token,
      clerkUser: {
        clerkId: user.id,
        email,
        name: fullName,
        avatarUrl,
      },
    })

    if (!result.success || !result.tenantId) {
      return NextResponse.json(
        { error: result.error || "Gagal menerima undangan.", code: result.code },
        { status: 400 }
      )
    }

    // 3. Issue session token if active, or route to pending approval for sensitive roles (Bab 9)
    const isPending = result.status === "PENDING_APPROVAL"
    const redirectUrl = isPending ? "/pending-approval" : "/dashboard"
    const message = isPending
      ? `Permintaan bergabung Anda sebagai ${result.role} di ${result.businessName} telah terkirim dan sedang menunggu persetujuan dari pemilik toko.`
      : `Selamat datang di ${result.businessName}! Anda sekarang terdaftar sebagai ${result.role}.`

    const response = NextResponse.json({
      success: true,
      message,
      tenantId: result.tenantId,
      role: result.role,
      status: result.status,
      businessName: result.businessName,
      redirectUrl,
    })

    if (!isPending) {
      const sessionToken = await createSessionToken({
        username: `staff_${user.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`,
        role: (result.role || "KARYAWAN") as any,
        tenantId: result.tenantId,
        staffName: fullName,
        fullName,
        businessName: result.businessName || "Bisnis Scota",
      })

      response.cookies.set({
        name: "nota_admin_session",
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return response
  } catch (error: any) {
    console.error("POST /api/invites/[token] error:", error)
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan server saat menerima undangan." },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getUserAccountDetails } from "@/lib/adminAccounts"
import { verifyPassword } from "@/lib/password"
import { createSessionToken } from "@/lib/session"
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

export async function POST(req: NextRequest) {
  try {
    const { username, password, staffName } = await req.json()

    const cleanUsername = (username || "").trim().toLowerCase()
    const cleanPassword = (password || "").trim()
    const cleanStaffName = (staffName || "").trim()

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: "ID Pengguna dan Password harus diisi" }, { status: 400 })
    }

    // Rate Limiting Protection (Brute-force lockout: max 5 attempts per 15 minutes)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip")?.trim() || 
               "127.0.0.1"
    const identifier = `${ip}:${cleanUsername}`

    const rateCheck = await checkAuthRateLimit(identifier, "login")
    if (!rateCheck.allowed && rateCheck.lockedUntil) {
      return NextResponse.json(
        { error: formatLockoutMessage(rateCheck.lockedUntil) },
        { status: 429 }
      )
    }

    const account = await getUserAccountDetails(cleanUsername)
    const isMatch = account?.password ? await verifyPassword(cleanPassword, account.password) : false

    // Record attempt result: resets counter on success, increments/locks on failure
    await recordAuthAttempt(identifier, "login", isMatch)

    if (!account || !isMatch) {
      return NextResponse.json({ error: "ID Pengguna atau Password salah. Akses ditolak." }, { status: 401 })
    }

    const authenticatedUser = cleanUsername
    const userRole = account.role || "ADMIN"
    const finalStaffName = cleanStaffName || ""

    const userTenantId = account.tenantId || "00000000-0000-0000-0000-000000000001"

    // Create cryptographically signed JWT session token (without password)
    const sessionToken = await createSessionToken({
      username: authenticatedUser,
      role: userRole,
      tenantId: userTenantId,
      staffName: finalStaffName || undefined,
    })

    const response = NextResponse.json({
      success: true,
      message: `Login Pengguna (${authenticatedUser}) berhasil`,
      user: {
        username: authenticatedUser,
        role: userRole,
        tenantId: userTenantId,
        staffName: finalStaffName,
      },
    })

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: "nota_admin_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    if (finalStaffName) {
      response.cookies.set({
        name: "nota_staff_name",
        value: finalStaffName,
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    return response
  } catch (error: any) {
    console.error("Login API Error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server saat login" }, { status: 500 })
  }
}

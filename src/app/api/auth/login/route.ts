import { NextRequest, NextResponse } from "next/server"
import { getUserAccountDetails } from "@/lib/adminAccounts"
import { createSessionToken } from "@/lib/session"

export async function POST(req: NextRequest) {
  try {
    const { username, password, staffName } = await req.json()

    const cleanUsername = (username || "").trim().toLowerCase()
    const cleanPassword = (password || "").trim()
    const cleanStaffName = (staffName || "").trim()

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: "ID Pengguna dan Password harus diisi" }, { status: 400 })
    }

    const account = await getUserAccountDetails(cleanUsername)

    if (!account || account.password !== cleanPassword) {
      return NextResponse.json({ error: "ID Pengguna atau Password salah. Akses ditolak." }, { status: 401 })
    }

    const authenticatedUser = cleanUsername
    const userRole = account.role || "ADMIN"
    const finalStaffName = cleanStaffName || ""

    // Create cryptographically signed JWT session token (without password)
    const sessionToken = await createSessionToken({
      username: authenticatedUser,
      role: userRole,
      staffName: finalStaffName || undefined,
    })

    const response = NextResponse.json({
      success: true,
      message: `Login Pengguna (${authenticatedUser}) berhasil`,
      user: {
        username: authenticatedUser,
        role: userRole,
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

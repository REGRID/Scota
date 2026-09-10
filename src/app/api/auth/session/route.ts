import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { createSessionToken } from "@/lib/session"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)

    if (!session || !session.username) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const sessionToken = await createSessionToken({
      username: session.username,
      role: session.role || "ADMIN",
      tenantId: session.tenantId,
      staffName: session.staffName || session.fullName || "",
      fullName: session.fullName || session.name || session.username,
      businessName: session.businessName,
    })

    const response = NextResponse.json({
      authenticated: true,
      token: sessionToken,
      user: {
        username: session.username,
        role: session.role || "ADMIN",
        staffName: session.staffName || session.fullName || "",
        fullName: session.fullName || session.name || session.username,
        tenantId: session.tenantId,
        businessName: session.businessName || "Bisnis Saya",
      },
    })

    // Issue/refresh first-party session cookie so Safari ITP / Clerk dev mode never drops the session
    response.cookies.set({
      name: "nota_admin_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

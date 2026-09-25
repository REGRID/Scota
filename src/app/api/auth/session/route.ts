import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { createSessionToken } from "@/lib/session"
import { getTenantUserSummary } from "@/lib/tenantUsers"

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
      email: session.email,
      onboardingCompleted: session.onboardingCompleted ?? false,
    })

    const userSummary = await getTenantUserSummary(session.tenantId || "")

    const response = NextResponse.json({
      authenticated: true,
      user: {
        username: session.fullName || session.staffName || session.username,
        displayUsername: session.username,
        role: session.role || "ADMIN",
        staffName: session.staffName || session.fullName || "",
        fullName: session.fullName || session.name || session.username,
        tenantId: session.tenantId,
        businessName: session.businessName || "Bisnis Saya",
        email: session.email,
        onboardingCompleted: session.onboardingCompleted ?? false,
        hasMultipleUsers: userSummary.hasMultipleUsers,
        userCount: userSummary.userCount,
      },
    })

    // Issue/refresh first-party session cookie
    response.cookies.set({
      name: "nota_admin_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.role === "DEMO" ? 60 * 60 * 24 : 60 * 60 * 24 * 30, // 1 day for demo, 30 days for real
    })

    return response
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getOrCreateDemoTenant, issueDemoSession, DEMO_SCAN_LIMIT } from "@/lib/demoTenant"

export async function POST(req: NextRequest) {
  try {
    let email = ""
    let name = "Pengguna Demo"
    let googleId = ""

    // 1. Coba baca sesi resmi dari Auth.js (handshake Google)
    try {
      const authSession = await auth()
      if (authSession?.user?.email) {
        email = authSession.user.email
        name = authSession.user.name || "Pengguna Demo"
        googleId = (authSession.user as any).id || authSession.user.email
      }
    } catch (authErr) {
      console.warn("Auth.js auth() handshake check notice:", authErr)
    }

    // 2. Fallback untuk mock / internal test call jika payload JSON dikirimkan
    if (!email) {
      try {
        const body = await req.json()
        if (body?.email && body?.googleId) {
          email = body.email
          googleId = body.googleId
          name = body.name || "Pengguna Demo"
        }
      } catch {}
    }

    if (!email || !googleId) {
      return NextResponse.json(
        { error: "Login Google gagal atau dibatalkan. Silakan coba masuk kembali." },
        { status: 401 }
      )
    }

    // 3. Cari atau buat tenant demo terisolasi
    const tenant = await getOrCreateDemoTenant(googleId, email, name)

    // 4. Terbitkan sesi Scota (bukan sesi Auth.js)
    const scotaToken = await issueDemoSession(tenant.id, email)

    const response = NextResponse.json({
      success: true,
      tenantId: tenant.id,
      scanUsed: tenant.demoScanCount || 0,
      scanLimit: DEMO_SCAN_LIMIT,
      email,
      name,
    })

    // Pasang cookie nota_admin_session
    response.cookies.set({
      name: "nota_admin_session",
      value: scotaToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 hari
    })

    return response
  } catch (error: any) {
    console.error("demo-login POST error:", error)
    return NextResponse.json(
      { error: error?.message || "Gagal memproses login akun demo" },
      { status: 500 }
    )
  }
}

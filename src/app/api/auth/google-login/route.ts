import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { findAdminAccountByGoogleId, findAdminAccountByEmail } from "@/lib/adminAccounts"
import { createSessionToken } from "@/lib/session"

export async function POST(req: NextRequest) {
  try {
    let email = ""
    let name = ""
    let googleId = ""
    let image = ""

    // 1. Coba baca sesi resmi dari Auth.js
    try {
      const authSession = await auth()
      if (authSession?.user?.email) {
        email = authSession.user.email
        name = authSession.user.name || ""
        image = authSession.user.image || ""
        googleId = (authSession.user as any).id || (authSession.user as any).sub || authSession.user.email
      }
    } catch (authErr) {
      console.warn("Auth.js auth() check notice in google-login:", authErr)
    }

    // 2. Fallback untuk mock / internal direct call jika payload JSON dikirimkan
    if (!googleId || !email) {
      try {
        const body = await req.json()
        if (body?.email && body?.googleId) {
          email = body.email
          googleId = body.googleId
          name = body.name || name
          image = body.image || image
        }
      } catch {}
    }

    if (!googleId || !email) {
      return NextResponse.json(
        { error: "Sesi Google tidak ditemukan atau dibatalkan. Silakan login kembali dengan Google." },
        { status: 401 }
      )
    }

    // 3. Cari akun bisnis terdaftar berdasarkan googleId
    const existingAccount = await findAdminAccountByGoogleId(googleId)
    if (existingAccount) {
      // Akun terdaftar -> Terbitkan Scota JWT session
      const scotaToken = await createSessionToken({
        username: existingAccount.username,
        role: existingAccount.role,
        tenantId: existingAccount.tenantId,
        name: existingAccount.fullName || existingAccount.username,
      })

      const response = NextResponse.json({
        success: true,
        redirect: "/dashboard",
        user: {
          username: existingAccount.username,
          role: existingAccount.role,
          tenantId: existingAccount.tenantId,
          fullName: existingAccount.fullName,
          businessName: existingAccount.businessName,
        },
      })

      response.cookies.set({
        name: "nota_admin_session",
        value: scotaToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 hari
      })

      return response
    }

    // 4. Jika googleId belum terdaftar, cek apakah email sudah terdaftar dengan password
    const emailAccount = await findAdminAccountByEmail(email)
    if (emailAccount) {
      return NextResponse.json(
        {
          error: "Email ini sudah terdaftar dengan password. Silakan masuk menggunakan password Anda.",
          needsRegister: false,
          emailExists: true,
        },
        { status: 409 }
      )
    }

    // 5. Jika belum pernah terdaftar sama sekali -> Arahkan ke pendaftaran akun bisnis
    return NextResponse.json(
      {
        error: "Akun Google ini belum terdaftar. Silakan lengkapi data usaha Anda untuk mulai menggunakan Scota.",
        needsRegister: true,
        profile: {
          googleId,
          email,
          name,
          image,
        },
      },
      { status: 404 }
    )
  } catch (error: any) {
    console.error("google-login POST error:", error)
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat memproses login Google" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}

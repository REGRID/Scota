import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { queryPg, withTransactionPg } from "@/lib/pgDb"
import { createSessionToken } from "@/lib/session"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const tenantId = session.tenantId
    let tenantData: any = null
    let userData: any = null

    if (tenantId) {
      const tRes = await queryPg(
        `SELECT id, "businessName", phone, "businessType", "estimatedDailyTransactions", "logoUrl", "onboardingCompleted"
         FROM tenants
         WHERE id = $1
         LIMIT 1`,
        [tenantId]
      )
      tenantData = tRes.rows?.[0] || null
    }

    // Lookup user data by email or username
    if (session.email) {
      const uRes = await queryPg(
        `SELECT id, name, email, phone, "onboardingCompleted"
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [session.email]
      )
      userData = uRes.rows?.[0] || null
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role || "OWNER",
      tenantId: session.tenantId,
      onboardingCompleted: Boolean(tenantData?.onboardingCompleted || userData?.onboardingCompleted),
      businessName: tenantData?.businessName || session.businessName || "",
      ownerName: userData?.name || session.fullName || session.staffName || "",
      phone: userData?.phone || tenantData?.phone || "",
      businessType: tenantData?.businessType || "Toko & Ritel",
      estimatedDailyTransactions: tenantData?.estimatedDailyTransactions || "20-100",
      logoUrl: tenantData?.logoUrl || null,
    })
  } catch (error: any) {
    console.error("[API Onboarding GET] Error:", error)
    return NextResponse.json({ error: "Gagal memuat status onboarding" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 })
    }

    const body = await req.json()
    const {
      businessName,
      ownerName,
      phone,
      businessType = "Toko & Ritel",
      estimatedDailyTransactions = "20-100",
      logoUrl = null,
    } = body

    if (!businessName || !businessName.trim()) {
      return NextResponse.json({ error: "Nama usaha/organisasi wajib diisi." }, { status: 400 })
    }
    if (!ownerName || !ownerName.trim()) {
      return NextResponse.json({ error: "Nama pemilik/penanggung jawab wajib diisi." }, { status: 400 })
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Nomor WhatsApp/telepon bisnis wajib diisi." }, { status: 400 })
    }

    const cleanBusinessName = businessName.trim()
    const cleanOwnerName = ownerName.trim()
    const cleanPhone = phone.trim()
    const cleanBusinessType = businessType.trim()
    const cleanEstimated = (estimatedDailyTransactions || "").trim()

    const tenantId = session.tenantId

    await withTransactionPg(async (client) => {
      // 1. Update tenant info
      if (tenantId) {
        await client.query(
          `UPDATE tenants
           SET "businessName" = $1,
               phone = $2,
               "businessType" = $3,
               "estimatedDailyTransactions" = $4,
               "logoUrl" = COALESCE($5, "logoUrl"),
               "onboardingCompleted" = true,
               "updatedAt" = NOW()
           WHERE id = $6`,
          [cleanBusinessName, cleanPhone, cleanBusinessType, cleanEstimated, logoUrl, tenantId]
        )
      }

      // 2. Update user info if email exists
      if (session.email) {
        await client.query(
          `UPDATE users
           SET name = $1,
               phone = $2,
               "onboardingCompleted" = true,
               "updatedAt" = NOW()
           WHERE email = $3`,
          [cleanOwnerName, cleanPhone, session.email]
        )
      }

      // 3. Update admin_accounts
      if (tenantId) {
        await client.query(
          `UPDATE admin_accounts
           SET "businessName" = $1,
               "fullName" = $2,
               phone = $3,
               "updatedAt" = NOW()
           WHERE "tenantId" = $4 OR username = $5`,
          [cleanBusinessName, cleanOwnerName, cleanPhone, tenantId, session.username]
        )
      }
    })

    // Create refreshed session token
    const newSessionToken = await createSessionToken({
      username: session.username,
      role: session.role || "OWNER",
      tenantId: session.tenantId,
      staffName: cleanOwnerName,
      fullName: cleanOwnerName,
      businessName: cleanBusinessName,
      email: session.email,
    })

    const response = NextResponse.json({
      success: true,
      message: "Profil organisasi dan usaha berhasil disiapkan!",
      redirectUrl: "/dashboard",
      user: {
        username: session.username,
        role: session.role || "OWNER",
        fullName: cleanOwnerName,
        businessName: cleanBusinessName,
        email: session.email,
        phone: cleanPhone,
        businessType: cleanBusinessType,
      },
    })

    // Set refreshed session cookie
    response.cookies.set({
      name: "nota_admin_session",
      value: newSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: any) {
    console.error("[API Onboarding POST] Error:", error)
    return NextResponse.json({ error: error.message || "Gagal menyimpan data organisasi" }, { status: 500 })
  }
}

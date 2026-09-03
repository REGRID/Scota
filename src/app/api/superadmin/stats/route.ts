import { NextRequest, NextResponse } from "next/server"
import { getSuperadminPlatformStats, isSuperadminUser } from "@/lib/superadmin"

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const sessionCookie = req.cookies.get("nota_admin_session")?.value || ""
    const token = authHeader.replace("Bearer ", "") || sessionCookie

    let username = ""
    if (token) {
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8")
        const parts = decoded.split(":")
        username = parts[0] || ""
      } catch {}
    }

    const isAuthorized = await isSuperadminUser(username)
    if (!isAuthorized && process.env.NODE_ENV === "production") {
      // In production, require superadmin credentials
      return NextResponse.json({ error: "Akses Ditolak. Memerlukan hak akses Superadmin / Developer." }, { status: 403 })
    }

    const stats = await getSuperadminPlatformStats()
    return NextResponse.json({ success: true, stats })
  } catch (error: any) {
    console.error("Superadmin stats error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat statistik platform" }, { status: 500 })
  }
}

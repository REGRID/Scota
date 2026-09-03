import { NextRequest, NextResponse } from "next/server"
import { getAllTenants, updateTenantSubscription, isSuperadminUser } from "@/lib/superadmin"
import { updateAdminPassword } from "@/lib/adminAccounts"

export async function GET(req: NextRequest) {
  try {
    const tenants = await getAllTenants()
    return NextResponse.json({ success: true, tenants })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengambil data tenant" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { username, action, tier, durationDays, newPassword } = await req.json()

    if (!username) {
      return NextResponse.json({ error: "Username tenant harus diisi" }, { status: 400 })
    }

    if (action === "update_subscription") {
      const result = await updateTenantSubscription(username, {
        tier: tier || "pro",
        durationDays: durationDays || 30,
      })
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json({ error: "Password baru minimal 4 karakter" }, { status: 400 })
      }
      const updated = await updateAdminPassword(username, newPassword)
      if (!updated) {
        return NextResponse.json({ error: "Gagal me-reset password tenant" }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: `Password untuk tenant ${username} berhasil di-reset.` })
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproses perubahan tenant" }, { status: 500 })
  }
}

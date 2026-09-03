import { NextRequest, NextResponse } from "next/server"
import {
  getAllTenants,
  updateTenantSubscription,
  toggleTenantStatus,
  createTenantManual,
} from "@/lib/superadmin"
import { updateAdminPassword } from "@/lib/adminAccounts"

export async function GET(req: NextRequest) {
  try {
    const tenants = await getAllTenants()
    return NextResponse.json({ success: true, tenants })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengambil data tenant" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await createTenantManual(body)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: result.message })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mendaftarkan tenant baru" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { username, action, tier, durationDays, newPassword, status } = await req.json()

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

    if (action === "toggle_status") {
      const result = await toggleTenantStatus(username, status === "suspended" ? "suspended" : "active")
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

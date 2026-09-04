import { NextRequest, NextResponse } from "next/server"
import {
  getAllTenants,
  updateTenantSubscription,
  toggleTenantStatus,
  createTenantManual,
  updateTenantApprovalConfig,
} from "@/lib/superadmin"
import { updateAdminPassword } from "@/lib/adminAccounts"
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const tenants = await getAllTenants()
    return NextResponse.json({ success: true, tenants })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengambil data tenant" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const result = await createTenantManual(body, auth.username)
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
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const { username, action, tier, durationDays, newPassword, status, approvalWorkflow } = await req.json()

    if (!username) {
      return NextResponse.json({ error: "Username tenant harus diisi" }, { status: 400 })
    }

    if (action === "update_subscription") {
      const result = await updateTenantSubscription(username, {
        tier: tier || "pro",
        durationDays: durationDays || 30,
      }, auth.username)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "update_approval_workflow") {
      const result = await updateTenantApprovalConfig(username, approvalWorkflow || {}, auth.username)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "toggle_status") {
      const result = await toggleTenantStatus(username, status === "suspended" ? "suspended" : "active", auth.username)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: "Password baru minimal 8 karakter" }, { status: 400 })
      }
      const updated = await updateAdminPassword(username, newPassword)
      if (!updated) {
        return NextResponse.json({ error: "Gagal me-reset password tenant" }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: `Password untuk tenant ${username} berhasil di-reset oleh ${auth.username}.` })
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproses perubahan tenant" }, { status: 500 })
  }
}

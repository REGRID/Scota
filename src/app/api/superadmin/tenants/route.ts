import { NextRequest, NextResponse } from "next/server"
import {
  getAllTenants,
  updateTenantSubscription,
  toggleTenantStatus,
  deleteTenant,
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

    const { username, action, tier, durationDays, newPassword, status, approvalWorkflow, tenantId } = await req.json()

    if (!username && !tenantId) {
      return NextResponse.json({ error: "Identitas tenant (username / tenantId) harus diisi" }, { status: 400 })
    }

    const targetUser = username || tenantId

    if (action === "update_subscription") {
      const result = await updateTenantSubscription(targetUser, {
        tier: tier || "pro",
        durationDays: durationDays || 30,
        tenantId,
      }, auth.username)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "update_approval_workflow") {
      const result = await updateTenantApprovalConfig(targetUser, approvalWorkflow || {}, auth.username)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "toggle_status") {
      const result = await toggleTenantStatus(
        targetUser,
        status === "suspended" ? "suspended" : "active",
        auth.username,
        tenantId
      )
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "delete_tenant") {
      const result = await deleteTenant(targetUser, auth.username, tenantId)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: "Password baru minimal 8 karakter" }, { status: 400 })
      }
      const updated = await updateAdminPassword(targetUser, newPassword)
      if (!updated) {
        return NextResponse.json({ error: "Gagal me-reset password tenant" }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: `Password untuk tenant ${targetUser} berhasil di-reset oleh ${auth.username}.` })
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproses perubahan tenant" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username") || ""
    const tenantId = searchParams.get("tenantId") || ""

    if (!username && !tenantId) {
      return NextResponse.json({ error: "Username atau tenantId harus diisi" }, { status: 400 })
    }

    const result = await deleteTenant(username || tenantId, auth.username, tenantId || undefined)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menghapus tenant" }, { status: 500 })
  }
}

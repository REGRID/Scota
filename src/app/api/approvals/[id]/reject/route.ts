import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSession } from "@/lib/authHelper"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { getSubscriptionInfo } from "@/lib/subscriptionServer"
import { DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"
import { DEFAULT_TENANT_ID } from "@/lib/session"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cleanId = (id || "").trim()

    if (!cleanId) {
      return NextResponse.json({ error: "ID permintaan verifikasi tidak valid" }, { status: 400 })
    }

    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Akses Ditolak: Sesi tidak valid atau belum login." }, { status: 401 })
    }

    const rejectingAdmin = session.username
    const userRole = session.role
    const sessionTenantId = session.tenantId || DEFAULT_TENANT_ID

    if (userRole === "KARYAWAN") {
      return NextResponse.json({
        error: "Akses Ditolak: Role Karyawan tidak diizinkan menolak/memverifikasi permintaan. Penolakan wajib dilakukan oleh Admin atau Superadmin.",
      }, { status: 403 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    // Check approval workflow config
    const subInfo = await getSubscriptionInfo(sessionTenantId).catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW
    const target = workflow.approverTarget || workflow.approvalTargetRole || "ANY_ADMIN"

    if (userRole !== "SUPERADMIN") {
      if (target === "SPECIFIC_USER" && workflow.designatedApproverUsername) {
        if (rejectingAdmin.trim().toLowerCase() !== workflow.designatedApproverUsername.trim().toLowerCase()) {
          return NextResponse.json({
            error: `Akses Ditolak: Hak penolakan/persetujuan saat ini ditugaskan khusus kepada akun "${workflow.designatedApproverUsername}".`,
          }, { status: 403 })
        }
      } else if (target !== "ANY_ADMIN") {
        if (userRole.toUpperCase() !== target.toUpperCase()) {
          return NextResponse.json({
            error: `Akses Ditolak: Penolakan membutuhkan akun dengan role ${target}.`,
          }, { status: 403 })
        }
      }
    }

    const body = await req.json()
    const { reason } = body || {}

    const findRes = await queryPg<any>(
      `SELECT * FROM pending_approvals WHERE id = $1 LIMIT 1`,
      [cleanId]
    )
    const pendingApproval = findRes.rows?.[0]

    if (!pendingApproval) {
      return NextResponse.json({ error: "Permintaan verifikasi tidak ditemukan" }, { status: 404 })
    }

    // Tenant Isolation Guard: Ensure non-superadmin only rejects approvals within their tenant
    if (userRole !== "SUPERADMIN" && pendingApproval.tenantId && pendingApproval.tenantId !== sessionTenantId) {
      return NextResponse.json({ error: "Akses Ditolak: Permintaan bukan milik organisasi/toko Anda" }, { status: 403 })
    }

    const targetTenantId = pendingApproval.tenantId || sessionTenantId
    const cleanRejectingAdmin = rejectingAdmin.trim().toLowerCase()

    // Dual-Control Enforcement: Prevent Self-Rejection only for destructive items (unless Superadmin)
    const isDestructive = pendingApproval.actionType === "DELETE" || pendingApproval.actionType === "BULK_DELETE" || pendingApproval.actionType === "EDIT"
    if (userRole !== "SUPERADMIN" && isDestructive && (pendingApproval.requestedBy || "").trim().toLowerCase() === cleanRejectingAdmin) {
      return NextResponse.json({
        error: `Akses Ditolak: Permintaan diajukan oleh Anda (${rejectingAdmin}). Verifikasi/penolakan harus dilakukan oleh Admin lain.`,
      }, { status: 403 })
    }

    const updateRes = await queryPg(
      `UPDATE pending_approvals 
       SET status = 'REJECTED', "approvedBy" = $1, "rejectionReason" = $2, "updatedAt" = NOW()
       WHERE id = $3
       RETURNING *`,
      [rejectingAdmin, reason || "Ditolak oleh admin", cleanId]
    )
    const updatedApproval = updateRes.rows?.[0]

    // Invalidate caches immediately
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    // Insert notification & Send Web Push
    try {
      let payloadObj: any = {}
      try {
        payloadObj = JSON.parse(pendingApproval.payload || "{}")
      } catch (e) {}

      const notifTitle = pendingApproval.actionType === "CREATE" ? "Pengajuan Nota Baru Ditolak" : "Permintaan Ditolak"
      const notifMsg = pendingApproval.actionType === "CREATE"
        ? `Admin ${rejectingAdmin} menolak pengajuan nota baru dari "${payloadObj.merchantName || 'Nota'}". Alasan: ${reason || "Tidak disetujui"}.`
        : `Admin ${rejectingAdmin} menolak permintaan ${pendingApproval.actionType} Anda. Alasan: ${reason || "Tidak disetujui"}.`

      await queryPg(
        `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
         VALUES ($1, 'all', $2, 'REJECT', $3, $4, $5::uuid, false, NOW())`,
        [targetTenantId, rejectingAdmin, notifTitle, notifMsg, cleanId]
      ).catch(() => {})

      sendWebPushNotification({
        tenantId: targetTenantId,
        title: notifTitle,
        message: notifMsg,
        url: "/",
        recipientRole: "ADMIN",
        excludeUsername: rejectingAdmin,
      }).catch((pErr) => console.warn("[WebPush Error on Reject]:", pErr))
    } catch (nErr) {
      console.warn("Reject notification error:", nErr)
    }

    return NextResponse.json({
      success: true,
      message: `Permintaan perubahan telah ditolak oleh Admin ${rejectingAdmin}.`,
      approval: updatedApproval || { id: cleanId, status: "REJECTED" },
    })
  } catch (error: any) {
    console.error("Reject Request Error:", error)
    return NextResponse.json({ error: error.message || "Gagal menolak permintaan" }, { status: 500 })
  }
}

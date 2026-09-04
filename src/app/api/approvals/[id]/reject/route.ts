import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getAdminUserFromRequest, getAdminRoleFromRequest } from "@/lib/authHelper"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cleanId = (id || "").trim()

    if (!cleanId) {
      return NextResponse.json({ error: "ID permintaan verifikasi tidak valid" }, { status: 400 })
    }

    const rejectingAdmin = getAdminUserFromRequest(req)
    const userRole = getAdminRoleFromRequest(req)

    if (userRole === "KARYAWAN") {
      return NextResponse.json({
        error: "Akses Ditolak: Role Karyawan tidak diizinkan menolak/memverifikasi permintaan. Penolakan/Persetujuan wajib dilakukan oleh Admin (Rama / Refo).",
      }, { status: 403 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
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

    const cleanRejectingAdmin = rejectingAdmin.trim().toLowerCase()
    const isRamaAdmin1 = cleanRejectingAdmin === "rama" || cleanRejectingAdmin === "admin1"

    // Exclusive Rejection for New Receipts (CREATE): Only Admin 1 (Rama) is authorized to reject new receipts
    if (pendingApproval.actionType === "CREATE" && !isRamaAdmin1) {
      return NextResponse.json({
        error: "Akses Ditolak: Hak penolakan/persetujuan nota baru hanya dimiliki khusus oleh Admin 1 (Rama).",
      }, { status: 403 })
    }

    // Dual-Control Enforcement: Prevent Self-Rejection only for destructive items
    const isDestructive = pendingApproval.actionType === "DELETE" || pendingApproval.actionType === "BULK_DELETE" || pendingApproval.actionType === "EDIT"
    if (isDestructive && (pendingApproval.requestedBy || "").trim().toLowerCase() === cleanRejectingAdmin) {
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
        `INSERT INTO notifications (recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
         VALUES ('all', $1, 'REJECT', $2, $3, $4::uuid, false, NOW())`,
        [rejectingAdmin, notifTitle, notifMsg, cleanId]
      ).catch(() => {})

      sendWebPushNotification({
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

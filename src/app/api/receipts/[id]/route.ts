import { NextRequest, NextResponse } from "next/server"
import { getAdminUserFromRequest } from "@/lib/authHelper"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { compressBase64Image } from "@/lib/imageCompressor"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSubscriptionInfo } from "@/lib/subscriptionServer"
import { DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const id = resolvedParams?.id

    if (!id) {
      return NextResponse.json({ error: "ID nota tidak valid" }, { status: 400 })
    }

    let receipt: any = null

    if (isDatabaseConfigured) {
      try {
        const pgRes = await queryPg(
          `SELECT 
            r.id, 
            r."merchantName", 
            r.date, 
            r."imageUrl", 
            r.subtotal, 
            r."discountAmount", 
            r."taxAmount", 
            r."totalAmount", 
            r."paymentMethod", 
            r."paymentStatus", 
            r.note, 
            r."staffName", 
            r."createdAt", 
            r."updatedAt",
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id,
                  'name', i.name,
                  'category', i.category,
                  'subCategory', i."subCategory",
                  'price', i.price,
                  'quantity', i.quantity
                )
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) as items
          FROM receipts r
          LEFT JOIN receipt_items i ON i."receiptId" = r.id
          WHERE r.id = $1
          GROUP BY r.id
          LIMIT 1`,
          [id]
        )
        if (pgRes.rows && pgRes.rows.length > 0) {
          receipt = pgRes.rows[0]
        }
      } catch (pgErr) {
        console.warn("PG query notice:", pgErr)
      }
    }

    if (!receipt) {
      return NextResponse.json({ error: "Nota tidak ditemukan di database" }, { status: 404 })
    }

    const res = NextResponse.json(receipt)
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    return res
  } catch (error: any) {
    console.error("GET Single Receipt Error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat detail nota" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const adminUser = getAdminUserFromRequest(req)
    const body = await req.json()
    const { date, items, merchantName, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, paymentStatus, note, imageUrl } = body

    if (!date) {
      return NextResponse.json({ error: "Tanggal nota wajib diisi" }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nota harus memiliki minimal 1 item produk" }, { status: 400 })
    }

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const subInfo = await getSubscriptionInfo().catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    // Direct Edit if Approval Workflow is Disabled or Excluded for Edit
    if (!workflow.enableApproval || !workflow.requireForEdit) {
      const compressedImageUrl = imageUrl ? await compressBase64Image(imageUrl) : null

      if (isDatabaseConfigured) {
        await queryPg(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [id])

        if (compressedImageUrl) {
          await queryPg(
            `UPDATE receipts 
             SET "merchantName" = $1, date = $2, subtotal = $3, "discountAmount" = $4, "taxAmount" = $5, "totalAmount" = $6, "paymentMethod" = $7, "paymentStatus" = $8, note = $9, "imageUrl" = $10, "updatedAt" = NOW()
             WHERE id = $11`,
            [
              merchantName || "Nota / Toko",
              date,
              Number(subtotal) || 0,
              Number(discountAmount) || 0,
              Number(taxAmount) || 0,
              Number(totalAmount) || 0,
              paymentMethod || "Cash",
              paymentStatus || "Lunas",
              note || null,
              compressedImageUrl,
              id,
            ]
          )
        } else {
          await queryPg(
            `UPDATE receipts 
             SET "merchantName" = $1, date = $2, subtotal = $3, "discountAmount" = $4, "taxAmount" = $5, "totalAmount" = $6, "paymentMethod" = $7, "paymentStatus" = $8, note = $9, "updatedAt" = NOW()
             WHERE id = $10`,
            [
              merchantName || "Nota / Toko",
              date,
              Number(subtotal) || 0,
              Number(discountAmount) || 0,
              Number(taxAmount) || 0,
              Number(totalAmount) || 0,
              paymentMethod || "Cash",
              paymentStatus || "Lunas",
              note || null,
              id,
            ]
          )
        }

        for (const it of items) {
          await queryPg(
            `INSERT INTO receipt_items ("receiptId", name, category, "subCategory", price, quantity, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              id,
              it.name || "Item",
              it.category || "Lain-lain",
              it.subCategory || "Umum",
              Number(it.price) || 0,
              Number(it.quantity) || 1,
            ]
          )
        }
      }

      return NextResponse.json({
        directPublished: true,
        message: "Perubahan nota berhasil disimpan langsung ke sistem.",
      })
    }

    // Dual-Admin Control: Create Pending Approval for EDIT action
    let approval: any = {
      id: `appr-edit-${Date.now()}`,
      receiptId: id,
      actionType: "EDIT",
      requestedBy: adminUser,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const apprRes = await queryPg<{ id: string; receiptId: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ($1, 'EDIT', $2, 'PENDING', $3, NOW(), NOW())
         RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
        [id, adminUser, JSON.stringify(body)]
      )
      if (apprRes.rows?.[0]) {
        approval = apprRes.rows[0]
      }
    }

    // Insert Notification for all admins & Trigger Web Push
    try {
      const notifTitle = "Permintaan Edit Nota"
      const notifMsg = `Pengguna ${adminUser} mengajukan perubahan data nota "${body.merchantName || 'Nota'}".`

      if (isDatabaseConfigured && approval.id) {
        await queryPg(
          `INSERT INTO notifications (recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
           VALUES ('all', $1, 'REQUEST', $2, $3, $4::uuid, false, NOW())`,
          [adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
        ).catch(() => {})
      }

      sendWebPushNotification({
        title: notifTitle,
        message: notifMsg,
        url: "/",
        recipientRole: "ADMIN",
        excludeUsername: adminUser,
      }).catch((pErr: any) => console.warn("[WebPush Error on Edit Request]:", pErr))
      invalidateNotificationsCache()
    } catch (nErr) {
      console.warn("Edit request notification insert notice:", nErr)
    }

    return NextResponse.json({
      pendingApproval: true,
      message: `Permintaan edit nota berhasil diajukan oleh ${adminUser}. Menunggu verifikasi dari pengelola.`,
      approval,
    })
  } catch (error: any) {
    console.error("PUT Receipt Error:", error)
    return NextResponse.json({ error: error.message || "Gagal mengajukan edit nota" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const adminUser = getAdminUserFromRequest(req)

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const subInfo = await getSubscriptionInfo().catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    // Direct Delete if Approval Workflow is Disabled or Excluded for Delete
    if (!workflow.enableApproval || !workflow.requireForDelete) {
      if (isDatabaseConfigured) {
        await queryPg(`DELETE FROM receipts WHERE id = $1`, [id])
      }
      return NextResponse.json({
        directPublished: true,
        message: "Nota berhasil dihapus secara langsung.",
      })
    }

    let approval: any = {
      id: `appr-del-${Date.now()}`,
      receiptId: id,
      actionType: "DELETE",
      requestedBy: adminUser,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const apprRes = await queryPg<{ id: string; receiptId: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ($1, 'DELETE', $2, 'PENDING', $3, NOW(), NOW())
         RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
        [id, adminUser, JSON.stringify({ id })]
      )
      if (apprRes.rows?.[0]) {
        approval = apprRes.rows[0]
      }
    }

    // Insert Notification for all admins & Trigger Web Push
    try {
      const notifTitle = "Permintaan Hapus Nota"
      const notifMsg = `Pengguna ${adminUser} mengajukan penghapusan nota.`

      if (isDatabaseConfigured && approval.id) {
        await queryPg(
          `INSERT INTO notifications (recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
           VALUES ('all', $1, 'REQUEST', $2, $3, $4::uuid, false, NOW())`,
          [adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
        ).catch(() => {})
      }

      sendWebPushNotification({
        title: notifTitle,
        message: notifMsg,
        url: "/",
        recipientRole: "ADMIN",
        excludeUsername: adminUser,
      }).catch((pErr: any) => console.warn("[WebPush Error on Delete Request]:", pErr))
      invalidateNotificationsCache()
    } catch (nErr) {
      console.warn("Delete request notification insert notice:", nErr)
    }

    return NextResponse.json({
      pendingApproval: true,
      message: `Permintaan hapus nota berhasil diajukan oleh ${adminUser}. Menunggu verifikasi dari pengelola.`,
      approval,
    })
  } catch (error: any) {
    console.error("DELETE Receipt Error:", error)
    return NextResponse.json({ error: "Gagal mengajukan penghapusan nota" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const id = resolvedParams?.id
    const body = await req.json()
    const { imageUrl } = body

    if (!id || !imageUrl) {
      return NextResponse.json({ error: "ID dan data gambar nota wajib diisi" }, { status: 400 })
    }

    const compressedImageUrl = await compressBase64Image(imageUrl)

    let updatedReceipt = null
    if (isDatabaseConfigured) {
      const updateRes = await queryPg(
        `UPDATE receipts 
         SET "imageUrl" = $1, "updatedAt" = now() 
         WHERE id = $2 
         RETURNING id, "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdAt", "updatedAt"`,
        [compressedImageUrl, id]
      )
      updatedReceipt = updateRes.rows?.[0] || null
    }

    invalidateReceiptsListCache()

    return NextResponse.json({
      success: true,
      message: "Foto nota berhasil diperbarui dan disimpan.",
      receipt: updatedReceipt,
    })
  } catch (error: any) {
    console.error("PATCH Receipt Image Error:", error)
    return NextResponse.json({ error: error.message || "Gagal memperbarui foto nota" }, { status: 500 })
  }
}

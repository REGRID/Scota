import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getAdminUserFromRequest, getAdminRoleFromRequest } from "@/lib/authHelper"
import { compressBase64Image } from "@/lib/imageCompressor"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { sendWebPushNotification } from "@/lib/serverPush"
import { syncReceiptToPos } from "@/lib/posSync"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cleanId = (id || "").trim()

    if (!cleanId) {
      return NextResponse.json({ error: "ID permintaan verifikasi tidak valid" }, { status: 400 })
    }

    const approvingAdmin = getAdminUserFromRequest(req)
    const userRole = getAdminRoleFromRequest(req)

    if (userRole === "KARYAWAN") {
      return NextResponse.json({
        error: "Akses Ditolak: Role Karyawan tidak diizinkan memverifikasi/menyetujui permintaan. Persetujuan wajib dilakukan oleh Admin (Rama / Refo).",
      }, { status: 403 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    // Fetch approval request safely
    const findRes = await queryPg<any>(
      `SELECT * FROM pending_approvals WHERE id = $1 LIMIT 1`,
      [cleanId]
    )
    const pendingApproval = findRes.rows?.[0]

    if (!pendingApproval) {
      return NextResponse.json({ error: "Permintaan verifikasi tidak ditemukan" }, { status: 404 })
    }

    if (pendingApproval.status !== "PENDING") {
      return NextResponse.json({ error: "Permintaan verifikasi ini telah diproses sebelumnya" }, { status: 400 })
    }

    const actionType = pendingApproval.actionType
    const cleanApprovingAdmin = approvingAdmin.trim().toLowerCase()
    const cleanRequestedBy = (pendingApproval.requestedBy || "").trim().toLowerCase()

    // Dual-Control Enforcement: Prevent Self-Approval (Case-Insensitive)
    if (cleanRequestedBy === cleanApprovingAdmin) {
      return NextResponse.json({
        error: `Akses Ditolak: Permintaan diajukan oleh Anda (${approvingAdmin}). Verifikasi & persetujuan harus dilakukan oleh Admin lain.`,
      }, { status: 403 })
    }

    let payload: any = {}
    try {
      payload = JSON.parse(pendingApproval.payload || "{}")
    } catch (pErr) {
      payload = {}
    }

    // Invalidate list cache
    invalidateReceiptsListCache()

    let createdReceiptId: string | null = null

    // Execute requested changes in database
    if (actionType === "CREATE") {
      const {
        merchantName,
        date,
        imageUrl,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod,
        paymentStatus,
        note,
        staffName,
        items,
      } = payload

      const compressedImageUrl = imageUrl ? await compressBase64Image(imageUrl) : null

      const newReceiptRes = await queryPg<{ id: string }>(
        `INSERT INTO receipts ("merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id`,
        [
          merchantName || "Nota / Toko",
          date || new Date().toISOString().split("T")[0],
          compressedImageUrl,
          Number(subtotal) || 0,
          Number(discountAmount) || 0,
          Number(taxAmount) || 0,
          Number(totalAmount) || 0,
          paymentMethod || "Cash",
          paymentStatus || "Lunas",
          note || null,
          staffName || null,
        ]
      )

      const newReceipt = newReceiptRes.rows?.[0]
      if (!newReceipt) {
        throw new Error("Gagal menyimpan nota yang disetujui")
      }

      createdReceiptId = newReceipt.id

      // Insert items
      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await queryPg(
            `INSERT INTO receipt_items ("receiptId", name, category, "subCategory", price, quantity, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              newReceipt.id,
              item.name || "Item",
              item.category || "Lain-lain",
              item.subCategory || "Umum",
              Number(item.price) || 0,
              Number(item.quantity) || 1,
            ]
          )
        }
      }

      // Background auto-learning into dictionaries
      try {
        if (merchantName) {
          await queryPg(
            `INSERT INTO merchant_dictionaries ("rawPattern", "cleanName", "verifiedCount", "updatedAt")
             VALUES ($1, $2, 1, NOW())
             ON CONFLICT ("rawPattern")
             DO UPDATE SET "cleanName" = EXCLUDED."cleanName", "verifiedCount" = merchant_dictionaries."verifiedCount" + 1, "updatedAt" = NOW()`,
            [merchantName.toLowerCase().trim(), merchantName.trim()]
          )
        }

        if (items && Array.isArray(items)) {
          for (const itm of items) {
            if (itm.name) {
              await queryPg(
                `INSERT INTO product_dictionaries ("rawName", "verifiedName", category, "subCategory", "lastKnownPrice", "verifiedCount", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, 1, NOW())
                 ON CONFLICT ("rawName")
                 DO UPDATE SET 
                   "verifiedName" = EXCLUDED."verifiedName",
                   category = EXCLUDED.category,
                   "subCategory" = EXCLUDED."subCategory",
                   "lastKnownPrice" = EXCLUDED."lastKnownPrice",
                   "verifiedCount" = product_dictionaries."verifiedCount" + 1,
                   "updatedAt" = NOW()`,
                [
                  itm.name.toLowerCase().trim(),
                  itm.name.trim(),
                  itm.category || "Lain-lain",
                  itm.subCategory || "Umum",
                  Number(itm.price) || 0,
                ]
              )
            }
          }
        }
      } catch (dictErr) {
        console.warn("Background auto-learning notice:", dictErr)
      }

      // Background sync to Studio POS
      syncReceiptToPos({
        receiptId: createdReceiptId || cleanId,
        merchantName: merchantName || "Nota / Toko",
        date: date || new Date().toISOString().split("T")[0],
        totalAmount: Number(totalAmount) || 0,
        subtotal: Number(subtotal) || 0,
        taxAmount: Number(taxAmount) || 0,
        discountAmount: Number(discountAmount) || 0,
        paymentMethod: paymentMethod || "Cash",
        paymentStatus: paymentStatus || "Lunas",
        note: note || null,
        imageUrl: compressedImageUrl || imageUrl || null,
        staffName: staffName || null,
        approvedBy: approvingAdmin,
        items: (items || []).map((it: any) => ({
          name: it.name || "Item",
          category: it.category || "Lain-lain",
          subCategory: it.subCategory || "Umum",
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          sku: it.sku,
        })),
      }).catch((posErr) => console.warn("[POS Sync Trigger Error]:", posErr))
    } else if (actionType === "DELETE" && (pendingApproval.receiptId || payload.id)) {
      const delId = pendingApproval.receiptId || payload.id
      await queryPg(`DELETE FROM receipts WHERE id = $1`, [delId])
    } else if (actionType === "BULK_DELETE" && payload.ids && Array.isArray(payload.ids)) {
      await queryPg(`DELETE FROM receipts WHERE id = ANY($1::uuid[])`, [payload.ids])
    } else if (actionType === "BULK_SETTLE" || actionType === "SETTLE") {
      const targetIds: string[] =
        payload.ids && Array.isArray(payload.ids) && payload.ids.length > 0
          ? payload.ids
          : pendingApproval.receiptId
          ? [pendingApproval.receiptId]
          : payload.id
          ? [payload.id]
          : []

      if (targetIds.length > 0) {
        await queryPg(
          `UPDATE receipts SET "paymentStatus" = 'Sudah Dilunasi', "updatedAt" = NOW() WHERE id = ANY($1::uuid[])`,
          [targetIds]
        )
      }
    } else if (actionType === "EDIT" && (pendingApproval.receiptId || payload.id)) {
      const editReceiptId = pendingApproval.receiptId || payload.id
      const { merchantName, date, imageUrl, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, paymentStatus, note, items } = payload
      const compressedImageUrl = imageUrl ? await compressBase64Image(imageUrl) : null

      // Delete existing receipt items
      await queryPg(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [editReceiptId])

      // Update parent receipt record
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
            editReceiptId,
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
            editReceiptId,
          ]
        )
      }

      // Re-create items
      if (items && Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          await queryPg(
            `INSERT INTO receipt_items ("receiptId", name, category, "subCategory", price, quantity, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              editReceiptId,
              it.name || "Item",
              it.category || "Lain-lain",
              it.subCategory || "Umum",
              Number(it.price) || 0,
              Number(it.quantity) || 1,
            ]
          )
        }
      }
    }

    // Mark approval request as APPROVED
    const updateRes = await queryPg(
      `UPDATE pending_approvals 
       SET status = 'APPROVED', "approvedBy" = $1, "receiptId" = COALESCE($2, "receiptId"), "updatedAt" = NOW()
       WHERE id = $3
       RETURNING *`,
      [approvingAdmin, createdReceiptId, cleanId]
    )
    const updatedApproval = updateRes.rows?.[0]

    // Invalidate caches immediately
    invalidateApprovalsCache()
    invalidateNotificationsCache()
    invalidateReceiptsListCache()

    // Insert notification & Send Web Push
    try {
      const notifTitle = actionType === "CREATE" ? "Nota Baru Disetujui & Diterbitkan" : "Permintaan Diverifikasi & Disetujui"
      const notifMsg = actionType === "CREATE"
        ? `Admin ${approvingAdmin} telah menyetujui nota baru dari "${payload.merchantName || 'Nota / Toko'}" sebesar Rp ${(Number(payload.totalAmount) || 0).toLocaleString("id-ID")}. Nota kini resmi tercatat di sistem.`
        : `Admin ${approvingAdmin} telah memverifikasi & menyetujui permintaan ${pendingApproval.actionType} Anda.`

      await queryPg(
        `INSERT INTO notifications (recipient, sender, type, title, message, "approvalId", "receiptId", "isRead", "createdAt")
         VALUES ('all', $1, 'APPROVE', $2, $3, $4::uuid, $5, false, NOW())`,
        [approvingAdmin, notifTitle, notifMsg, cleanId, createdReceiptId || pendingApproval.receiptId || null]
      ).catch(() => {})

      sendWebPushNotification({
        title: notifTitle,
        message: notifMsg,
        url: "/",
        recipientRole: "ALL",
        excludeUsername: approvingAdmin,
      }).catch((pErr) => console.warn("[WebPush Error on Approval]:", pErr))
    } catch (nErr) {
      console.warn("Approve notification error:", nErr)
    }

    return NextResponse.json({
      success: true,
      message: actionType === "CREATE"
        ? `Nota baru "${payload.merchantName || 'Nota'}" berhasil disetujui & diterbitkan ke sistem oleh Admin ${approvingAdmin}.`
        : `Perubahan berhasil diverifikasi dan diterapkan oleh Admin ${approvingAdmin}.`,
      approval: updatedApproval || { id: cleanId, status: "APPROVED" },
      receiptId: createdReceiptId || pendingApproval.receiptId || null,
    })
  } catch (error: any) {
    console.error("Approve Request Error:", error)
    return NextResponse.json({ error: error.message || "Gagal menyetujui perubahan" }, { status: 500 })
  }
}

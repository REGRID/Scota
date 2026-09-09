import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"
import { getSession } from "@/lib/authHelper"
import { requireRole } from "@/lib/roleGuard"
import { compressBase64Image } from "@/lib/imageCompressor"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { sendWebPushNotification } from "@/lib/serverPush"
import { syncReceiptToPos } from "@/lib/posSync"
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

    const auth = await requireRole(req, ["OWNER", "ADMIN", "MANAGER"])
    if (!auth.ok) return auth.response

    const approvingAdmin = auth.username
    const userRole = auth.userRole
    const sessionTenantId = auth.tenantId

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    // Check approval workflow config
    const subInfo = await getSubscriptionInfo(sessionTenantId).catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW
    const target = workflow.approverTarget || workflow.approvalTargetRole || "ANY_ADMIN"

    if (userRole !== "SUPERADMIN") {
      if (target === "SPECIFIC_USER" && workflow.designatedApproverUsername) {
        if (approvingAdmin.trim().toLowerCase() !== workflow.designatedApproverUsername.trim().toLowerCase()) {
          return NextResponse.json({
            error: `Akses Ditolak: Jalur persetujuan saat ini ditugaskan khusus kepada akun "${workflow.designatedApproverUsername}".`,
          }, { status: 403 })
        }
      } else if (target !== "ANY_ADMIN") {
        if (userRole.toUpperCase() !== target.toUpperCase()) {
          return NextResponse.json({
            error: `Akses Ditolak: Persetujuan membutuhkan akun dengan role ${target}.`,
          }, { status: 403 })
        }
      }
    }

    // Fetch approval request safely
    let pendingApproval: any = null
    const isSessionMigrated = await isTenantSchemaMigrated(sessionTenantId)
    if (isSessionMigrated) {
      const tenantFindRes = await withTenantSchema(sessionTenantId, async (client) => {
        return client.query(`SELECT * FROM pending_approvals WHERE id = $1 LIMIT 1`, [cleanId])
      })
      pendingApproval = tenantFindRes.rows?.[0]
    }
    if (!pendingApproval) {
      const findRes = await queryPg<any>(
        `SELECT * FROM pending_approvals WHERE id = $1 LIMIT 1`,
        [cleanId]
      )
      pendingApproval = findRes.rows?.[0]
    }

    if (!pendingApproval) {
      return NextResponse.json({ error: "Permintaan verifikasi tidak ditemukan" }, { status: 404 })
    }

    // Tenant Isolation Guard: Ensure non-superadmin only approves approvals within their tenant
    if (userRole !== "SUPERADMIN" && pendingApproval.tenantId && pendingApproval.tenantId !== sessionTenantId) {
      return NextResponse.json({ error: "Akses Ditolak: Permintaan bukan milik organisasi/toko Anda" }, { status: 403 })
    }

    const targetTenantId = pendingApproval.tenantId || sessionTenantId

    if (pendingApproval.status !== "PENDING") {
      return NextResponse.json({ error: "Permintaan verifikasi ini telah diproses sebelumnya" }, { status: 400 })
    }

    const actionType = pendingApproval.actionType
    let payload: any = {}
    try {
      payload = JSON.parse(pendingApproval.payload || "{}")
    } catch (pErr) {
      payload = {}
    }

    const normalizeUserStr = (str: string) =>
      str.replace(/\s*\([^)]*\)\s*/g, "").trim().toLowerCase()

    const cleanApprovingAdmin = normalizeUserStr(approvingAdmin)
    const cleanRequestedBy = normalizeUserStr(pendingApproval.requestedBy || "")
    const payloadCreator = normalizeUserStr(payload.createdByUsername || "")

    // Dual-Control Enforcement: Prevent Self-Approval (Case-Insensitive & Suffix-Insensitive) unless Superadmin
    if (
      userRole !== "SUPERADMIN" &&
      (cleanRequestedBy === cleanApprovingAdmin ||
        (payloadCreator && payloadCreator === cleanApprovingAdmin))
    ) {
      return NextResponse.json({
        error: `Akses Ditolak: Permintaan diajukan oleh Anda (${approvingAdmin}). Verifikasi & persetujuan harus dilakukan oleh Admin lain.`,
      }, { status: 403 })
    }

    // Invalidate list cache
    invalidateReceiptsListCache()

    let createdReceiptId: string | null = null

    // Execute requested changes in database
    const isMigrated = await isTenantSchemaMigrated(targetTenantId)

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
      const requestedByVal = pendingApproval.requestedBy || ""
      const creatorRole = payload.createdByRole || (requestedByVal.toLowerCase().includes("karyawan") || requestedByVal.toLowerCase().includes("kasir") ? "KASIR" : "ADMIN")
      const creatorUsername = payload.createdByUsername || pendingApproval.requestedBy || "system"

      if (isMigrated) {
        const newReceipt = await withTenantSchema(targetTenantId, async (client) => {
          const insertRes: any = await client.query(
            `INSERT INTO receipts ("tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", notes, "staffName", "createdByRole", "createdByUsername", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
             RETURNING id`,
            [
              targetTenantId,
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
              creatorRole,
              creatorUsername,
            ]
          )
          const rcpt = insertRes.rows?.[0]
          if (rcpt?.id && items && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              const itemPrice = Number(item.price) || 0
              const itemQty = Number(item.quantity) || 1
              await client.query(
                `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                  targetTenantId,
                  rcpt.id,
                  item.name || "Item",
                  itemQty,
                  itemPrice,
                  (itemPrice * itemQty),
                  item.category || "Lain-lain",
                  item.subCategory || "Umum",
                ]
              )
            }
          }
          return rcpt
        })

        if (!newReceipt) {
          throw new Error("Gagal menyimpan nota yang disetujui")
        }
        createdReceiptId = newReceipt.id
      } else {
        const newReceiptRes = await queryPg<{ id: string }>(
          `INSERT INTO receipts ("tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdByRole", "createdByUsername", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
           RETURNING id`,
          [
            targetTenantId,
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
            creatorRole,
            creatorUsername,
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
      if (isMigrated) {
        await withTenantSchema(targetTenantId, async (client) => {
          await client.query(`DELETE FROM receipts WHERE id = $1`, [delId])
        })
      } else {
        await queryPg(`DELETE FROM receipts WHERE id = $1`, [delId])
      }
    } else if (actionType === "BULK_DELETE" && payload.ids && Array.isArray(payload.ids)) {
      if (isMigrated) {
        await withTenantSchema(targetTenantId, async (client) => {
          await client.query(`DELETE FROM receipts WHERE id = ANY($1::uuid[])`, [payload.ids])
        })
      } else {
        await queryPg(`DELETE FROM receipts WHERE id = ANY($1::uuid[])`, [payload.ids])
      }
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
        if (isMigrated) {
          await withTenantSchema(targetTenantId, async (client) => {
            await client.query(
              `UPDATE receipts SET "paymentStatus" = 'Sudah Dilunasi', "updatedAt" = NOW() WHERE id = ANY($1::uuid[])`,
              [targetIds]
            )
          })
        } else {
          await queryPg(
            `UPDATE receipts SET "paymentStatus" = 'Sudah Dilunasi', "updatedAt" = NOW() WHERE id = ANY($1::uuid[])`,
            [targetIds]
          )
        }
      }
    } else if (actionType === "EDIT" && (pendingApproval.receiptId || payload.id)) {
      const editReceiptId = pendingApproval.receiptId || payload.id
      const { merchantName, date, imageUrl, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, paymentStatus, note, items } = payload
      const compressedImageUrl = imageUrl ? await compressBase64Image(imageUrl) : null

      if (isMigrated) {
        await withTenantSchema(targetTenantId, async (client) => {
          await client.query(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [editReceiptId])
          if (compressedImageUrl) {
            await client.query(
              `UPDATE receipts 
               SET "merchantName" = $1, date = $2, subtotal = $3, "discountAmount" = $4, "taxAmount" = $5, "totalAmount" = $6, "paymentMethod" = $7, "paymentStatus" = $8, notes = $9, "imageUrl" = $10, "updatedAt" = NOW()
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
            await client.query(
              `UPDATE receipts 
               SET "merchantName" = $1, date = $2, subtotal = $3, "discountAmount" = $4, "taxAmount" = $5, "totalAmount" = $6, "paymentMethod" = $7, "paymentStatus" = $8, notes = $9, "updatedAt" = NOW()
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

          if (items && Array.isArray(items) && items.length > 0) {
            for (const it of items) {
              const itemPrice = Number(it.price) || 0
              const itemQty = Number(it.quantity) || 1
              await client.query(
                `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                  targetTenantId,
                  editReceiptId,
                  it.name || "Item",
                  itemQty,
                  itemPrice,
                  (itemPrice * itemQty),
                  it.category || "Lain-lain",
                  it.subCategory || "Umum",
                ]
              )
            }
          }
        })
      } else {
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
    }

    // Mark approval request as APPROVED
    let updatedApproval: any = null
    const isTargetMigrated = await isTenantSchemaMigrated(targetTenantId)
    if (isTargetMigrated) {
      const updateRes = await withTenantSchema(targetTenantId, async (client) => {
        return client.query(
          `UPDATE pending_approvals 
           SET status = 'APPROVED', "approvedBy" = $1, "receiptId" = COALESCE($2, "receiptId"), "updatedAt" = NOW()
           WHERE id = $3
           RETURNING *`,
          [approvingAdmin, createdReceiptId, cleanId]
        )
      })
      updatedApproval = updateRes.rows?.[0]
    } else {
      const updateRes = await queryPg(
        `UPDATE pending_approvals 
         SET status = 'APPROVED', "approvedBy" = $1, "receiptId" = COALESCE($2, "receiptId"), "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [approvingAdmin, createdReceiptId, cleanId]
      )
      updatedApproval = updateRes.rows?.[0]
    }

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

      if (isTargetMigrated) {
        await withTenantSchema(targetTenantId, async (client) => {
          return client.query(
            `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
             VALUES ($1, 'all', $2, 'APPROVE', $3, $4, $5::uuid, false, NOW())`,
            [targetTenantId, approvingAdmin, notifTitle, notifMsg, cleanId]
          )
        }).catch(() => {})
      } else {
        await queryPg(
          `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
           VALUES ($1, 'all', $2, 'APPROVE', $3, $4, $5::uuid, false, NOW())`,
          [targetTenantId, approvingAdmin, notifTitle, notifMsg, cleanId]
        ).catch(() => {})
      }

      sendWebPushNotification({
        tenantId: targetTenantId,
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

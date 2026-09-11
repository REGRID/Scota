import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { requireRole, requirePermission } from "@/lib/roleGuard"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { compressBase64Image } from "@/lib/imageCompressor"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"
import { getSubscriptionInfo } from "@/lib/subscriptionServer"
import { DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"
import { DEFAULT_TENANT_ID } from "@/lib/session"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const id = resolvedParams?.id

    if (!id) {
      return NextResponse.json({ error: "ID nota tidak valid" }, { status: 400 })
    }

    const session = await getSession(req)
    const rawRole = (session?.role || "ADMIN").toUpperCase()
    const userTenantId = session?.tenantId || DEFAULT_TENANT_ID
    const isSuperadmin = rawRole === "SUPERADMIN"
    const isKasirOrStaff = ["KASIR", "KARYAWAN", "STAFF", "STAF"].includes(rawRole)

    let receipt: any = null

    if (isDatabaseConfigured) {
      try {
        const isMigrated = await isTenantSchemaMigrated(userTenantId)
        if (isMigrated && !isSuperadmin) {
          receipt = await withTenantSchema(userTenantId, async (client) => {
            const query = `
              SELECT 
                r.id, 
                r."tenantId",
                r."merchantName", 
                r.date, 
                r."imageUrl", 
                r.subtotal, 
                r."discountAmount", 
                r."taxAmount", 
                r."totalAmount", 
                r."paymentMethod", 
                r."paymentStatus", 
                r.notes,
                r.notes as note, 
                r."staffName", 
                r."createdByRole",
                r."createdByUsername",
                r."createdAt", 
                r."updatedAt",
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', i.id,
                      'name', i.name,
                      'category', i.category,
                      'subCategory', i."subCategory",
                      'price', i."unitPrice",
                      'quantity', i.qty
                    )
                  ) FILTER (WHERE i.id IS NOT NULL),
                  '[]'::json
                ) as items
              FROM receipts r
              LEFT JOIN receipt_items i ON i."receiptId" = r.id
              WHERE r.id = $1
              GROUP BY r.id
            `
            const res: any = await client.query(query, [id])
            return res.rows?.[0] || null
          })
        } else {
          const query = `
            SELECT 
              r.id, 
              r."tenantId",
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
              r."createdByRole",
              r."createdByUsername",
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
            WHERE r.id = $1 ${isSuperadmin ? "" : `AND (r."tenantId" = $2 OR r."tenantId" IS NULL)`}
            GROUP BY r.id
          `
          const queryParams = isSuperadmin ? [id] : [id, userTenantId]
          const pgRes = await queryPg(query, queryParams)
          receipt = pgRes.rows?.[0] || null
        }
      } catch (pgErr) {
        console.warn("Postgres receipts query error:", pgErr)
      }
    }

    if (!receipt) {
      return NextResponse.json({ error: "Nota tidak ditemukan di database" }, { status: 404 })
    }

    // Role Kasir & Staff Scope: Staf/Kasir hanya dapat melihat nota buatan sesama staf/kasir atau nota miliknya
    if (isKasirOrStaff) {
      const creatorRole = (receipt.createdByRole || "").toUpperCase()
      const isCreatedByStaff = ["KASIR", "KARYAWAN", "STAFF", "STAF"].includes(creatorRole)
      const isOwnReceipt = receipt.createdByUsername && receipt.createdByUsername === session?.username

      if (!isCreatedByStaff && !isOwnReceipt) {
        return NextResponse.json(
          { error: "Akses ditolak: Staf/Kasir hanya dapat melihat nota yang dibuat oleh sesama staf/kasir." },
          { status: 403 }
        )
      }
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
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid atau belum login. Silakan login terlebih dahulu." }, { status: 401 })
    }

    const adminUser = session.username
    const userTenantId = session.tenantId || DEFAULT_TENANT_ID
    const isSuperadmin = session.role === "SUPERADMIN"
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

    const subInfo = await getSubscriptionInfo(userTenantId).catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW
    const isMigrated = isDatabaseConfigured ? await isTenantSchemaMigrated(userTenantId) : false

    // Direct Edit if Approval Workflow is Disabled or Excluded for Edit
    if (!workflow.enableApproval || !workflow.requireForEdit) {
      if (isDatabaseConfigured) {
        if (isMigrated && !isSuperadmin) {
          const result = await withTenantSchema(userTenantId, async (client) => {
            const checkRes: any = await client.query(
              `SELECT id, "imageUrl" FROM receipts WHERE id = $1`,
              [id]
            )
            const existingReceipt = checkRes.rows?.[0]
            if (!existingReceipt) {
              return { notFound: true }
            }

            let finalImageUrl = existingReceipt.imageUrl
            if (imageUrl !== undefined) {
              if (imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0) {
                finalImageUrl = await compressBase64Image(imageUrl)
              } else if (imageUrl === null || imageUrl === "") {
                finalImageUrl = null
              }
            }

            await client.query(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [id])

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
                finalImageUrl,
                id,
              ]
            )

            for (const it of items) {
              const itemPrice = Number(it.price) || 0
              const itemQty = Number(it.quantity) || 1
              await client.query(
                `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                  userTenantId,
                  id,
                  it.name || "Item",
                  itemQty,
                  itemPrice,
                  (itemPrice * itemQty),
                  it.category || "Lain-lain",
                  it.subCategory || "Umum",
                ]
              )
            }

            return { ok: true }
          })

          if (result?.notFound) {
            return NextResponse.json(
              { error: "Nota tidak ditemukan atau Anda tidak memiliki hak akses untuk mengubah nota ini." },
              { status: 404 }
            )
          }
        } else {
          // 1. Verify existence and tenant ownership first before touching items
          const checkRes = await queryPg<{ id: string; imageUrl: string | null }>(
            isSuperadmin
              ? `SELECT id, "imageUrl" FROM receipts WHERE id = $1`
              : `SELECT id, "imageUrl" FROM receipts WHERE id = $1 AND ("tenantId" = $2 OR "tenantId" IS NULL)`,
            isSuperadmin ? [id] : [id, userTenantId]
          )

          const existingReceipt = checkRes.rows?.[0]
          if (!existingReceipt) {
            return NextResponse.json(
              { error: "Nota tidak ditemukan atau Anda tidak memiliki hak akses untuk mengubah nota ini." },
              { status: 404 }
            )
          }

          // 2. Preserve existing image if new imageUrl is not provided / omitted
          let finalImageUrl = existingReceipt.imageUrl
          if (imageUrl !== undefined) {
            if (imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0) {
              finalImageUrl = await compressBase64Image(imageUrl)
            } else if (imageUrl === null || imageUrl === "") {
              finalImageUrl = null
            }
          }

          // 3. Clear existing items and update receipt
          await queryPg(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [id])

          const tenantClause = isSuperadmin ? "" : `AND ("tenantId" = $12 OR "tenantId" IS NULL)`
          const updateParams: any[] = [
            merchantName || "Nota / Toko",
            date,
            Number(subtotal) || 0,
            Number(discountAmount) || 0,
            Number(taxAmount) || 0,
            Number(totalAmount) || 0,
            paymentMethod || "Cash",
            paymentStatus || "Lunas",
            note || null,
            finalImageUrl,
            id,
          ]
          if (!isSuperadmin) updateParams.push(userTenantId)

          await queryPg(
            `UPDATE receipts 
             SET "merchantName" = $1, date = $2, subtotal = $3, "discountAmount" = $4, "taxAmount" = $5, "totalAmount" = $6, "paymentMethod" = $7, "paymentStatus" = $8, note = $9, "imageUrl" = $10, "updatedAt" = NOW()
             WHERE id = $11 ${tenantClause}`,
            updateParams
          )

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
      if (isMigrated) {
        const apprRes: any = await withTenantSchema(userTenantId, async (client) => {
          return client.query(
            `INSERT INTO pending_approvals ("tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
             VALUES ($1, $2, 'EDIT', $3, 'PENDING', $4, NOW(), NOW())
             RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
            [userTenantId, id, adminUser, JSON.stringify(body)]
          )
        })
        if (apprRes.rows?.[0]) {
          approval = apprRes.rows[0]
        }
      } else {
        const apprRes = await queryPg<{ id: string; receiptId: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
          `INSERT INTO pending_approvals ("tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
           VALUES ($1, $2, 'EDIT', $3, 'PENDING', $4, NOW(), NOW())
           RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
          [userTenantId, id, adminUser, JSON.stringify(body)]
        )
        if (apprRes.rows?.[0]) {
          approval = apprRes.rows[0]
        }
      }
    }

    // Insert Notification for all admins & Trigger Web Push
    try {
      const notifTitle = "Permintaan Edit Nota"
      const notifMsg = `Pengguna ${adminUser} mengajukan perubahan data nota "${body.merchantName || 'Nota'}".`

      if (isDatabaseConfigured && approval.id) {
        if (isMigrated) {
          await withTenantSchema(userTenantId, async (client) => {
            return client.query(
              `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
               VALUES ($1, 'all', $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
              [userTenantId, adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
            )
          }).catch(() => {})
        } else {
          await queryPg(
            `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
             VALUES ($1, 'all', $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
            [userTenantId, adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
          ).catch(() => {})
        }
      }

      sendWebPushNotification({
        tenantId: userTenantId,
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
    const auth = await requirePermission(req, "manage_staff")
    if (!auth.ok) return auth.response

    const { id } = await params
    const adminUser = auth.username
    const userTenantId = auth.tenantId
    const isSuperadmin = auth.userRole === "SUPERADMIN"

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const subInfo = await getSubscriptionInfo(userTenantId).catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    const isMigrated = await isTenantSchemaMigrated(userTenantId)

    // Direct Delete if Approval Workflow is Disabled or Excluded for Delete
    if (!workflow.enableApproval || !workflow.requireForDelete) {
      if (isDatabaseConfigured) {
        if (isMigrated && !isSuperadmin) {
          await withTenantSchema(userTenantId, async (client) => {
            await client.query(`DELETE FROM receipts WHERE id = $1`, [id])
          })
        } else {
          const query = isSuperadmin
            ? `DELETE FROM receipts WHERE id = $1`
            : `DELETE FROM receipts WHERE id = $1 AND ("tenantId" = $2 OR "tenantId" IS NULL)`
          const params = isSuperadmin ? [id] : [id, userTenantId]
          await queryPg(query, params)
        }
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
      if (isMigrated) {
        const apprRes: any = await withTenantSchema(userTenantId, async (client) => {
          return client.query(
            `INSERT INTO pending_approvals ("tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
             VALUES ($1, $2, 'DELETE', $3, 'PENDING', $4, NOW(), NOW())
             RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
            [userTenantId, id, adminUser, JSON.stringify({ id })]
          )
        })
        if (apprRes.rows?.[0]) {
          approval = apprRes.rows[0]
        }
      } else {
        const apprRes = await queryPg<{ id: string; receiptId: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
          `INSERT INTO pending_approvals ("tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
           VALUES ($1, $2, 'DELETE', $3, 'PENDING', $4, NOW(), NOW())
           RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
          [userTenantId, id, adminUser, JSON.stringify({ id })]
        )
        if (apprRes.rows?.[0]) {
          approval = apprRes.rows[0]
        }
      }
    }

    // Insert Notification for all admins & Trigger Web Push
    try {
      const notifTitle = "Permintaan Hapus Nota"
      const notifMsg = `Pengguna ${adminUser} mengajukan penghapusan nota.`

      if (isDatabaseConfigured && approval.id) {
        if (isMigrated) {
          await withTenantSchema(userTenantId, async (client) => {
            return client.query(
              `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
               VALUES ($1, 'all', $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
              [userTenantId, adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
            )
          }).catch(() => {})
        } else {
          await queryPg(
            `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
             VALUES ($1, 'all', $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
            [userTenantId, adminUser, notifTitle, notifMsg, approval.id.startsWith("appr-") ? null : approval.id]
          ).catch(() => {})
        }
      }

      sendWebPushNotification({
        tenantId: userTenantId,
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
    const session = await getSession(req)
    const userTenantId = session?.tenantId || DEFAULT_TENANT_ID
    const isSuperadmin = session?.role === "SUPERADMIN"

    const body = await req.json()
    const { imageUrl } = body

    if (!id || !imageUrl) {
      return NextResponse.json({ error: "ID dan data gambar nota wajib diisi" }, { status: 400 })
    }

    const compressedImageUrl = await compressBase64Image(imageUrl)

    let updatedReceipt = null
    if (isDatabaseConfigured) {
      const query = isSuperadmin
        ? `UPDATE receipts 
           SET "imageUrl" = $1, "updatedAt" = now() 
           WHERE id = $2 
           RETURNING id, "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdAt", "updatedAt"`
        : `UPDATE receipts 
           SET "imageUrl" = $1, "updatedAt" = now() 
           WHERE id = $2 AND ("tenantId" = $3 OR "tenantId" IS NULL)
           RETURNING id, "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdAt", "updatedAt"`
      const queryParams = isSuperadmin ? [compressedImageUrl, id] : [compressedImageUrl, id, userTenantId]
      const updateRes = await queryPg(query, queryParams)
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

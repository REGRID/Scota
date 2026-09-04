import { NextRequest, NextResponse } from "next/server"
import { recordVerifiedReceiptLearning } from "@/lib/selfLearningEngine"
import { getSession } from "@/lib/authHelper"
import { getOrSeedCategories } from "@/lib/categories"
import { compressBase64Image } from "@/lib/imageCompressor"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateApprovalsCache } from "@/app/api/approvals/route"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSubscriptionInfo } from "@/lib/subscriptionServer"
import { DEFAULT_APPROVAL_WORKFLOW } from "@/lib/subscription"

let listCache: { key: string; data: any; timestamp: number } | null = null
const LIST_CACHE_TTL = 5000 // 5 seconds cache

export function invalidateReceiptsListCache() {
  listCache = null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const limit = searchParams.has("limit") || searchParams.has("take")
      ? Math.min(Math.max(Number(searchParams.get("limit") || searchParams.get("take")), 1), 1000)
      : undefined

    const cacheKey = `${search}_${category}_${limit || 'all'}`
    const now = Date.now()

    if (listCache && listCache.key === cacheKey && now - listCache.timestamp < LIST_CACHE_TTL) {
      const cachedResponse = NextResponse.json(listCache.data)
      cachedResponse.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30")
      return cachedResponse
    }

    const rootKeyword = category ? category.split("/")[0].trim() : ""
    let receipts: any[] = []

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
          GROUP BY r.id
          ORDER BY r."createdAt" DESC
          ${limit ? `LIMIT ${limit}` : ''}`
        )
        receipts = pgRes.rows || []
      } catch (pgErr) {
        console.warn("PostgreSQL receipts query notice:", pgErr)
      }
    }

    // In-memory filter for search/category criteria
    if (search || category) {
      const searchLower = search.toLowerCase().trim()
      const categoryLower = category.toLowerCase().trim()
      const rootLower = rootKeyword.toLowerCase().trim()

      receipts = receipts.filter((r: any) => {
        const matchesSearch = !searchLower || (
          (r.merchantName || "").toLowerCase().includes(searchLower) ||
          (r.note || "").toLowerCase().includes(searchLower) ||
          (r.paymentMethod || "").toLowerCase().includes(searchLower) ||
          (r.items || []).some((i: any) =>
            (i.name || "").toLowerCase().includes(searchLower) ||
            (i.category || "").toLowerCase().includes(searchLower) ||
            (i.subCategory || "").toLowerCase().includes(searchLower)
          )
        )

        const matchesCategory = !categoryLower || (
          (r.items || []).some((i: any) => {
            const itemCat = (i.category || "").toLowerCase()
            const itemSub = (i.subCategory || "").toLowerCase()
            return (
              itemCat.includes(categoryLower) ||
              itemSub.includes(categoryLower) ||
              (rootLower && itemCat.includes(rootLower))
            )
          })
        )

        return matchesSearch && matchesCategory
      })
    }

    // Fetch cached Custom Categories to map legacy category names
    const categoryHierarchy = await getOrSeedCategories()
    const parentNames: string[] = categoryHierarchy.map((c) => c.name)

    // Normalize item categories
    let normalizedReceipts = receipts.map((r: any) => {
      const isPersonal =
        r.paymentMethod === "Dana Pribadi Owner" || r.paymentMethod === "Talangan Karyawan"
      const cleanedNote =
        !isPersonal && r.note
          ? r.note.replace(/\[Dibayar oleh: [^\]]+\]\s*/g, "").trim() || null
          : r.note

      return {
        ...r,
        note: cleanedNote,
        items: (r.items || []).map((item: any) => {
          const itemCat = item.category || "Lain-lain"
          const itemRoot = itemCat.split("/")[0].trim().toLowerCase()

          const matchedParent = parentNames.find((p) => {
            const pRoot = p.split("/")[0].trim().toLowerCase()
            return pRoot === itemRoot || p.toLowerCase() === itemCat.toLowerCase()
          })

          return {
            ...item,
            category: matchedParent || itemCat.split("/")[0].trim(),
          }
        }),
      }
    })

    // Role KARYAWAN Data Scoping
    const session = await getSession(req)
    const userRole = session?.role || "ADMIN"
    if (userRole === "KARYAWAN") {
      const knownStaff = ["reza", "ummu", "cheisa", "novi", "titis", "karyawan"]
      normalizedReceipts = normalizedReceipts.filter((r: any) => {
        const noteText = (r.note || "").toLowerCase()
        const method = (r.paymentMethod || "").toLowerCase()
        return (
          method === "talangan karyawan" ||
          noteText.includes("(karyawan)") ||
          noteText.includes("diunggah oleh:") ||
          knownStaff.some((st) => noteText.includes(st))
        )
      })
    }

    listCache = { key: cacheKey, data: normalizedReceipts, timestamp: now }

    const response = NextResponse.json(normalizedReceipts)
    response.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15")
    return response
  } catch (error: any) {
    console.error("GET Receipts Error:", error)
    return NextResponse.json({ error: "Gagal mengambil data nota" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid atau belum login. Silakan login terlebih dahulu." }, { status: 401 })
    }

    const body = await req.json()
    const {
      merchantName,
      date,
      subtotal = 0,
      discountAmount = 0,
      taxAmount = 0,
      totalAmount = 0,
      paymentMethod = "Cash",
      paymentStatus = "Lunas",
      note,
      items = [],
      imageUrl,
      staffName,
    } = body

    if (!date) {
      return NextResponse.json({ error: "Tanggal nota wajib diisi" }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nota harus memiliki minimal 1 item produk" }, { status: 400 })
    }

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const userRole = session.role || "ADMIN"
    const reqStaffName = staffName || session.staffName || ""
    const adminUser = session.username

    const isPersonal =
      paymentMethod === "Dana Pribadi Owner" || paymentMethod === "Talangan Karyawan"
    
    let cleanedNote = note
      ? isPersonal
        ? note
        : note.replace(/\[Dibayar oleh: [^\]]+\]\s*/g, "").trim() || null
      : null

    if (userRole === "KARYAWAN" && reqStaffName) {
      const uploaderTag = `[Diunggah oleh: ${reqStaffName} (Karyawan)]`
      if (!cleanedNote) {
        cleanedNote = uploaderTag
      } else if (!cleanedNote.includes("[Diunggah oleh:")) {
        cleanedNote = `${cleanedNote} ${uploaderTag}`
      }
    }

    // 1. Compress Image before storing
    const compressedImageUrl = imageUrl ? await compressBase64Image(imageUrl) : null

    const resolvedAdmin = adminUser || (userRole === "KARYAWAN" && reqStaffName ? reqStaffName : "admin")
    const uploaderName = reqStaffName
      ? `${reqStaffName} (Karyawan)`
      : userRole === "KARYAWAN"
      ? "Karyawan"
      : resolvedAdmin

    const payloadObj = {
      merchantName: merchantName || "Nota / Toko",
      date: date || new Date().toISOString().split("T")[0],
      imageUrl: compressedImageUrl,
      subtotal: Number(subtotal) || 0,
      discountAmount: Number(discountAmount) || 0,
      taxAmount: Number(taxAmount) || 0,
      totalAmount: Number(totalAmount) || 0,
      paymentMethod: paymentMethod || "Cash",
      paymentStatus: paymentStatus || "Lunas",
      note: cleanedNote,
      staffName: reqStaffName || null,
      items: items.map((it: any) => ({
        name: it.name || "Item",
        category: it.category || "Lain-lain",
        subCategory: it.subCategory || "Umum",
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      })),
    }

    // Check Tenant Approval Workflow Configuration
    const subInfo = await getSubscriptionInfo().catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    const requiresApproval =
      workflow.enableApproval &&
      workflow.requireForCreate &&
      ((Number(totalAmount) || 0) >= (workflow.minAmountThreshold || 0))

    // Direct Publish / Auto-Approve if Approval Workflow is Disabled or Excluded
    if (!requiresApproval) {
      let createdReceipt: any = null

      if (isDatabaseConfigured) {
        const insertRes = await queryPg<{ id: string }>(
          `INSERT INTO receipts ("merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "staffName", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
           RETURNING id, "merchantName", date, "totalAmount", "paymentMethod", "paymentStatus", "createdAt"`,
          [
            payloadObj.merchantName,
            payloadObj.date,
            payloadObj.imageUrl,
            payloadObj.subtotal,
            payloadObj.discountAmount,
            payloadObj.taxAmount,
            payloadObj.totalAmount,
            payloadObj.paymentMethod,
            payloadObj.paymentStatus,
            payloadObj.note,
            payloadObj.staffName,
          ]
        )
        createdReceipt = insertRes.rows?.[0]

        if (createdReceipt?.id) {
          for (const item of payloadObj.items) {
            await queryPg(
              `INSERT INTO receipt_items ("receiptId", name, category, "subCategory", price, quantity, "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                createdReceipt.id,
                item.name,
                item.category,
                item.subCategory,
                item.price,
                item.quantity,
              ]
            )
          }

          // Background auto-learning into dictionaries
          try {
            if (payloadObj.merchantName) {
              await queryPg(
                `INSERT INTO merchant_dictionaries ("rawPattern", "cleanName", "verifiedCount", "updatedAt")
                 VALUES ($1, $2, 1, NOW())
                 ON CONFLICT ("rawPattern")
                 DO UPDATE SET "cleanName" = EXCLUDED."cleanName", "verifiedCount" = merchant_dictionaries."verifiedCount" + 1, "updatedAt" = NOW()`,
                [payloadObj.merchantName.toLowerCase().trim(), payloadObj.merchantName.trim()]
              )
            }
            for (const itm of payloadObj.items) {
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
                    itm.category,
                    itm.subCategory,
                    itm.price,
                  ]
                )
              }
            }
          } catch (dictErr) {
            console.warn("Direct publish background learning notice:", dictErr)
          }
        }
      }

      return NextResponse.json({
        directPublished: true,
        message: `Nota dari "${payloadObj.merchantName}" berhasil disimpan langsung ke pembukuan.`,
        receipt: createdReceipt || { id: `rcpt-${Date.now()}`, ...payloadObj },
      }, { status: 201 })
    }

    // Insert into pending_approvals for Approval Workflow
    let newApproval: any = {
      id: `appr-${Date.now()}`,
      actionType: "CREATE",
      requestedBy: uploaderName,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const apprRes = await queryPg<{ id: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES (NULL, 'CREATE', $1, 'PENDING', $2, NOW(), NOW())
         RETURNING id, "actionType", "requestedBy", status, "createdAt"`,
        [uploaderName, JSON.stringify(payloadObj)]
      )
      if (apprRes.rows?.[0]) {
        newApproval = apprRes.rows[0]
      }
    }

    invalidateApprovalsCache()
    invalidateNotificationsCache()

    // Insert Notification & Send Real Web Push to Approvers
    try {
      const notifTitle = "Pengajuan Nota Baru Menunggu Approval"
      const notifMessage = `${uploaderName} telah mengajukan nota baru dari "${merchantName || 'Nota / Toko'}" sebesar Rp ${(Number(totalAmount) || 0).toLocaleString("id-ID")}. Menunggu persetujuan.`

      const targetMode = workflow.approverTarget || workflow.approvalTargetRole || "ANY_ADMIN"
      const designatedRecipient = targetMode === "SPECIFIC_USER" ? (workflow.designatedApproverUsername || "admin") : "all"
      const recipientRole = (targetMode === "KARYAWAN" ? "KARYAWAN" : targetMode === "ALL" ? "ALL" : "ADMIN") as "ADMIN" | "ALL" | "KARYAWAN"

      if (isDatabaseConfigured && newApproval.id) {
        await queryPg(
          `INSERT INTO notifications (recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
           VALUES ($1, $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
          [designatedRecipient, uploaderName, notifTitle, notifMessage, newApproval.id.startsWith("appr-") ? null : newApproval.id]
        ).catch(() => {})
      }

      sendWebPushNotification({
        title: notifTitle,
        message: notifMessage,
        url: "/",
        recipientRole,
        excludeUsername: uploaderName,
      }).catch((pErr: any) => console.warn("[WebPush Error on New Receipt Request]:", pErr))
    } catch (nErr) {
      console.warn("New receipt request notification notice:", nErr)
    }

    return NextResponse.json({
      pendingApproval: true,
      message: `Nota baru dari "${merchantName || 'Nota / Toko'}" berhasil diajukan oleh ${uploaderName}. Menunggu persetujuan (approval).`,
      approval: newApproval,
      ...payloadObj,
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST Receipt Error:", error)
    return NextResponse.json({ error: error.message || "Gagal mengajukan nota ke database" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid atau belum login. Silakan login terlebih dahulu." }, { status: 401 })
    }

    const adminUser = session.username
    const { ids } = await req.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ID nota yang akan dihapus tidak valid" }, { status: 400 })
    }

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const subInfo = await getSubscriptionInfo().catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    // Direct delete if approval is not required for delete
    if (!workflow.enableApproval || !workflow.requireForDelete) {
      if (isDatabaseConfigured) {
        await queryPg(`DELETE FROM receipts WHERE id = ANY($1::uuid[])`, [ids])
      }
      return NextResponse.json({
        directPublished: true,
        message: `Berhasil menghapus ${ids.length} nota secara langsung.`,
      })
    }

    let approval: any = {
      id: `appr-bulk-del-${Date.now()}`,
      actionType: "BULK_DELETE",
      requestedBy: adminUser,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const apprRes = await queryPg<{ id: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ('BULK_DELETE', $1, 'PENDING', $2, NOW(), NOW())
         RETURNING id, "actionType", "requestedBy", status, "createdAt"`,
        [adminUser, JSON.stringify({ ids })]
      )
      if (apprRes.rows?.[0]) {
        approval = apprRes.rows[0]
      }
    }

    // Insert Notification for other admin & Send Web Push
    try {
      const notifTitle = `Permintaan Hapus Massal (${ids.length} Nota)`
      const notifMsg = `Pengguna ${adminUser} mengajukan penghapusan massal untuk ${ids.length} nota.`

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
      }).catch((pErr: any) => console.warn("[WebPush Error on Bulk Delete]:", pErr))
    } catch (nErr) {
      console.warn("Bulk delete notification insert notice:", nErr)
    }

    return NextResponse.json({
      pendingApproval: true,
      message: `Permintaan hapus massal (${ids.length} nota) berhasil diajukan oleh ${adminUser}. Menunggu verifikasi dari pengelola.`,
      approval,
    })
  } catch (error: any) {
    console.error("Bulk DELETE Receipts Error:", error)
    return NextResponse.json({ error: "Gagal mengajukan hapus nota secara massal" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid atau belum login. Silakan login terlebih dahulu." }, { status: 401 })
    }

    const adminUser = session.username
    const { ids, paymentStatus, proofImageUrl, personName, totalAmount } = await req.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ID nota yang akan diperbarui tidak valid" }, { status: 400 })
    }

    invalidateReceiptsListCache()
    invalidateApprovalsCache()
    invalidateNotificationsCache()

    const statusToSet = paymentStatus || "Sudah Dilunasi"
    const compressedProof = proofImageUrl ? await compressBase64Image(proofImageUrl) : null

    const subInfo = await getSubscriptionInfo().catch(() => null)
    const workflow = subInfo?.approvalWorkflow || DEFAULT_APPROVAL_WORKFLOW

    // Direct settle if approval is not required for settle
    if (!workflow.enableApproval || !workflow.requireForSettle) {
      if (isDatabaseConfigured) {
        await queryPg(
          `UPDATE receipts SET "paymentStatus" = $1, "updatedAt" = NOW() WHERE id = ANY($2::uuid[])`,
          [statusToSet, ids]
        )
      }
      return NextResponse.json({
        directPublished: true,
        message: `Berhasil melunasi ${ids.length} nota secara langsung.`,
      })
    }

    const payloadObj = {
      ids,
      paymentStatus: statusToSet,
      proofImageUrl: compressedProof,
      personName: personName || "",
      totalAmount: Number(totalAmount) || 0,
    }

    let approval: any = {
      id: `appr-bulk-settle-${Date.now()}`,
      actionType: "BULK_SETTLE",
      requestedBy: adminUser,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const apprRes = await queryPg<{ id: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ('BULK_SETTLE', $1, 'PENDING', $2, NOW(), NOW())
         RETURNING id, "actionType", "requestedBy", status, "createdAt"`,
        [adminUser, JSON.stringify(payloadObj)]
      )
      if (apprRes.rows?.[0]) {
        approval = apprRes.rows[0]
      }
    }

    // Insert Notification for all admins & Send Web Push
    try {
      const notifTitle = `Pengajuan Pelunasan (${ids.length} Nota)`
      const notifMsg = `Pengguna ${adminUser} mengajukan pelunasan untuk ${ids.length} nota${personName ? ` (${personName})` : ''} sebesar Rp ${(Number(totalAmount) || 0).toLocaleString("id-ID")}.`

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
      }).catch((pErr: any) => console.warn("[WebPush Error on Bulk Settle]:", pErr))
    } catch (nErr) {
      console.warn("Bulk settle notification insert notice:", nErr)
    }

    return NextResponse.json({
      pendingApproval: true,
      message: `Permintaan pelunasan massal (${ids.length} nota) berhasil diajukan oleh ${adminUser}. Menunggu verifikasi dari pengelola.`,
      approval,
    })
  } catch (error: any) {
    console.error("Bulk PATCH Receipts Error:", error)
    return NextResponse.json({ error: "Gagal mengajukan pelunasan nota secara massal" }, { status: 500 })
  }
}

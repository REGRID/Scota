import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSession } from "@/lib/authHelper"
import { sendWebPushNotification } from "@/lib/serverPush"
import { invalidateNotificationsCache } from "@/app/api/notifications/route"
import { DEFAULT_TENANT_ID } from "@/lib/session"

// In-Memory Backend Cache
let approvalsCache: { key: string; data: any; timestamp: number } | null = null
const CACHE_TTL_MS = 8000 // 8 seconds cache

export function invalidateApprovalsCache() {
  approvalsCache = null
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    const userTenantId = session.tenantId || DEFAULT_TENANT_ID
    const isSuperadmin = session.role === "SUPERADMIN"

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "PENDING"
    const receiptId = searchParams.get("receiptId") || ""
    const cacheKey = `${userTenantId}_${status}_${receiptId}`
    const now = Date.now()

    if (approvalsCache && approvalsCache.key === cacheKey && now - approvalsCache.timestamp < CACHE_TTL_MS) {
      const cached = NextResponse.json(approvalsCache.data)
      cached.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15")
      return cached
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json([])
    }

    let query = `
      SELECT 
        a.id, 
        a."tenantId",
        a."receiptId", 
        a."actionType", 
        a."requestedBy", 
        a."approvedBy", 
        a.status, 
        a."rejectionReason", 
        a.payload, 
        a."createdAt", 
        a."updatedAt",
        CASE WHEN r.id IS NOT NULL THEN
          json_build_object(
            'id', r.id,
            'merchantName', r."merchantName",
            'date', r.date,
            'totalAmount', r."totalAmount",
            'paymentMethod', r."paymentMethod",
            'paymentStatus', r."paymentStatus",
            'note', r.note,
            'items', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', i.id,
                    'name', i.name,
                    'category', i.category,
                    'subCategory', i."subCategory",
                    'price', i.price,
                    'quantity', i.quantity
                  )
                ) FROM receipt_items i WHERE i."receiptId" = r.id
              ),
              '[]'::json
            )
          )
        ELSE NULL END as receipt
      FROM pending_approvals a
      LEFT JOIN receipts r ON r.id = a."receiptId"
    `
    const params: any[] = []
    const conditions: string[] = []

    if (!isSuperadmin) {
      params.push(userTenantId)
      conditions.push(`(a."tenantId" = $${params.length} OR a."tenantId" IS NULL)`)
    }

    if (status !== "ALL") {
      params.push(status)
      conditions.push(`a.status = $${params.length}`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ")
    }

    query += ` ORDER BY a."createdAt" DESC LIMIT 50`

    const { rows: approvals } = await queryPg(query, params)
    let result = approvals || []

    if (receiptId) {
      result = result.filter((app: any) => {
        if (app.receiptId === receiptId) return true
        if (app.payload) {
          try {
            const p = JSON.parse(app.payload)
            if (p.id === receiptId) return true
            if (p.ids && Array.isArray(p.ids) && p.ids.includes(receiptId)) return true
          } catch (e) {}
        }
        return false
      })
    }

    approvalsCache = { key: cacheKey, data: result, timestamp: now }

    const res = NextResponse.json(result)
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15")
    return res
  } catch (error: any) {
    console.error("GET Approvals Error:", error)
    return NextResponse.json({ error: "Gagal mengambil daftar verifikasi" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    const adminUser = session.username
    const userTenantId = session.tenantId || DEFAULT_TENANT_ID
    const body = await req.json()
    const { receiptId, actionType, payload } = body

    if (!actionType || !payload) {
      return NextResponse.json({ error: "Tipe aksi dan payload data wajib diisi" }, { status: 400 })
    }

    invalidateApprovalsCache()
    invalidateNotificationsCache()

    let newApproval: any = {
      id: `appr-${Date.now()}`,
      tenantId: userTenantId,
      receiptId: receiptId || null,
      actionType,
      requestedBy: adminUser,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    }

    if (isDatabaseConfigured) {
      const res = await queryPg<{ id: string; receiptId: string; actionType: string; requestedBy: string; status: string; createdAt: string }>(
        `INSERT INTO pending_approvals ("tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW(), NOW())
         RETURNING id, "receiptId", "actionType", "requestedBy", status, "createdAt"`,
        [userTenantId, receiptId || null, actionType, adminUser, typeof payload === "string" ? payload : JSON.stringify(payload)]
      )
      if (res.rows?.[0]) {
        newApproval = res.rows[0]
      }
    }

    // Insert Notification for all admins & Send Web Push
    try {
      const notifTitle = `Permintaan Verifikasi (${actionType})`
      const notifMsg = `Admin ${adminUser} mengajukan permintaan verifikasi ${actionType}.`

      if (isDatabaseConfigured && newApproval.id) {
        await queryPg(
          `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
           VALUES ($1, 'all', $2, 'REQUEST', $3, $4, $5::uuid, false, NOW())`,
          [userTenantId, adminUser, notifTitle, notifMsg, newApproval.id.startsWith("appr-") ? null : newApproval.id]
        ).catch(() => {})
      }

      sendWebPushNotification({
        title: notifTitle,
        message: notifMsg,
        url: "/",
        recipientRole: "ADMIN",
        excludeUsername: adminUser,
      }).catch((pErr: any) => console.warn("[WebPush Error on Approval POST]:", pErr))
    } catch (nErr) {
      console.warn("Approval POST notification insert notice:", nErr)
    }

    return NextResponse.json({
      success: true,
      message: `Permintaan ${actionType} berhasil diajukan oleh ${adminUser}. Menunggu verifikasi oleh admin lain.`,
      approval: newApproval,
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST Approval Request Error:", error)
    return NextResponse.json({ error: "Gagal membuat permintaan verifikasi" }, { status: 500 })
  }
}

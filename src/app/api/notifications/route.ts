import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSession } from "@/lib/authHelper"
import { DEFAULT_TENANT_ID } from "@/lib/session"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"

// In-memory cache per user/role/tenant
let notifCache: Map<string, { data: any; timestamp: number }> = new Map()
const CACHE_TTL_MS = 8000 // 8 seconds cache

export function invalidateNotificationsCache() {
  notifCache.clear()
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    const adminUser = session?.username || ""
    const userRole = session?.role || "STAFF"
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID
    const cleanUser = (adminUser || "all").trim().toLowerCase() || "all"
    const cacheKey = `${userRole}_${cleanUser}_${tenantId}`
    const now = Date.now()

    const cached = notifCache.get(cacheKey)
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const res = NextResponse.json(cached.data)
      res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15")
      return res
    }

    if (!isDatabaseConfigured) {
      const fallbackPayload = { notifications: [], unreadCount: 0 }
      return NextResponse.json(fallbackPayload)
    }

    let notifications: any[] = []

    try {
      const isMigrated = await isTenantSchemaMigrated(tenantId)
      if (isMigrated && userRole !== "SUPERADMIN") {
        notifications = await withTenantSchema(tenantId, async (client) => {
          let tenantQuery = `
            SELECT id, "tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt"
            FROM notifications
          `
          const recipients = (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "MANAGER" || userRole === "OWNER")
            ? [cleanUser, "admin", "superadmin", "manager", "owner", "all", "*"]
            : ["karyawan", "all", cleanUser, "*"]

          tenantQuery += ` WHERE recipient = ANY($1::text[]) ORDER BY "createdAt" DESC LIMIT 30`
          const res = await client.query(tenantQuery, [recipients])
          return res.rows || []
        })
      } else {
        let query = `
          SELECT id, "tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt"
          FROM notifications
        `
        const params: any[] = []

        if (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "MANAGER" || userRole === "OWNER") {
          query += ` WHERE recipient = ANY($1::text[])`
          params.push([cleanUser, "admin", "superadmin", "manager", "owner", "all", "*"])
        } else {
          query += ` WHERE recipient = ANY($1::text[])`
          params.push(["karyawan", "all", cleanUser, "*"])
        }

        // Tenant isolation guard: Non-superadmin users only see their tenant notifications
        if (userRole !== "SUPERADMIN") {
          params.push(tenantId)
          query += ` AND ("tenantId" = $${params.length} OR "tenantId" IS NULL)`
        }

        query += ` ORDER BY "createdAt" DESC LIMIT 30`

        const { rows } = await queryPg(query, params)
        notifications = rows || []
      }
    } catch (dbErr) {
      console.warn("GET Notifications Notice:", dbErr)
    }

    // Filter for KARYAWAN
    if (userRole === "KARYAWAN") {
      const knownStaff = ["karyawan", "reza", "ummu", "cheisa", "novi", "titis"]
      notifications = notifications.filter((n) => {
        const senderLower = (n.sender || "").toLowerCase().trim()
        const isFromKaryawan =
          knownStaff.some((staff) => senderLower.includes(staff)) ||
          n.recipient === "karyawan"
        const isNewReceipt = n.type === "NEW_RECEIPT"
        return isNewReceipt && isFromKaryawan
      })
    }

    const unreadCount = notifications.filter((n) => {
      if (n.isRead) return false
      const senderLower = (n.sender || "").toLowerCase()
      if (cleanUser && cleanUser !== "all" && senderLower.includes(cleanUser)) return false
      return true
    }).length

    const payload = {
      notifications,
      unreadCount,
    }

    notifCache.set(cacheKey, { data: payload, timestamp: now })

    const res = NextResponse.json(payload)
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15")
    return res
  } catch (error: any) {
    console.warn("Notifications API graceful fallback:", error?.message || error)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req)
    const adminUser = session?.username || ""
    const userRole = session?.role || "STAFF"
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID
    const cleanUser = (adminUser || "all").trim().toLowerCase() || "all"
    const { id, markAllRead } = await req.json()

    invalidateNotificationsCache()

    if (!isDatabaseConfigured) {
      return NextResponse.json({ success: true })
    }

    try {
      const isMigrated = await isTenantSchemaMigrated(tenantId)
      if (isMigrated && userRole !== "SUPERADMIN") {
        await withTenantSchema(tenantId, async (client) => {
          if (markAllRead) {
            const recipients = userRole === "KARYAWAN"
              ? ["karyawan", "all", cleanUser, "*"]
              : [cleanUser, "admin", "superadmin", "manager", "owner", "all", "*"]
            await client.query(
              `UPDATE notifications SET "isRead" = true WHERE recipient = ANY($1::text[])`,
              [recipients]
            )
          } else if (id) {
            await client.query(
              `UPDATE notifications SET "isRead" = true WHERE id = $1`,
              [id]
            )
          }
        })
      } else {
        if (markAllRead) {
          if (userRole === "KARYAWAN") {
            await queryPg(
              `UPDATE notifications 
               SET "isRead" = true 
               WHERE recipient = ANY($1::text[]) 
               AND ("tenantId" = $2 OR "tenantId" IS NULL)`,
              [["karyawan", "all", cleanUser, "*"], tenantId]
            )
          } else if (userRole === "SUPERADMIN") {
            await queryPg(
              `UPDATE notifications SET "isRead" = true WHERE recipient = ANY($1::text[])`,
              [[cleanUser, "admin", "superadmin", "manager", "owner", "all", "*"]]
            )
          } else {
            await queryPg(
              `UPDATE notifications 
               SET "isRead" = true 
               WHERE recipient = ANY($1::text[]) 
               AND ("tenantId" = $2 OR "tenantId" IS NULL)`,
              [[cleanUser, "admin", "superadmin", "manager", "owner", "all", "*"], tenantId]
            )
          }
        } else if (id) {
          if (userRole === "SUPERADMIN") {
            await queryPg(
              `UPDATE notifications SET "isRead" = true WHERE id = $1`,
              [id]
            )
          } else {
            await queryPg(
              `UPDATE notifications SET "isRead" = true WHERE id = $1 AND ("tenantId" = $2 OR "tenantId" IS NULL)`,
              [id, tenantId]
            )
          }
        }
      }
    } catch (err) {
      console.warn("PATCH Notification DB update notice:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.warn("PATCH Notification notice:", error?.message || error)
    return NextResponse.json({ success: true })
  }
}

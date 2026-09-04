import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getAdminUserFromRequest, getAdminRoleFromRequest } from "@/lib/authHelper"

// In-memory cache per user/role
let notifCache: Map<string, { data: any; timestamp: number }> = new Map()
const CACHE_TTL_MS = 8000 // 8 seconds cache

export function invalidateNotificationsCache() {
  notifCache.clear()
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = getAdminUserFromRequest(req)
    const userRole = getAdminRoleFromRequest(req)
    const cleanUser = (adminUser || "all").trim().toLowerCase() || "all"
    const cacheKey = `${userRole}_${cleanUser}`
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
      let query = `
        SELECT id, recipient, sender, type, title, message, "approvalId", "isRead", "createdAt"
        FROM notifications
      `
      const params: any[] = []

      if (userRole === "ADMIN") {
        query += ` WHERE recipient = ANY($1::text[])`
        params.push([cleanUser, "admin", "all", "*", "rama", "refo"])
      } else {
        query += ` WHERE recipient = ANY($1::text[])`
        params.push(["karyawan", "all", cleanUser, "*"])
      }

      query += ` ORDER BY "createdAt" DESC LIMIT 30`

      const { rows } = await queryPg(query, params)
      notifications = rows || []
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
    const adminUser = getAdminUserFromRequest(req)
    const userRole = getAdminRoleFromRequest(req)
    const cleanUser = (adminUser || "all").trim().toLowerCase() || "all"
    const { id, markAllRead } = await req.json()

    invalidateNotificationsCache()

    if (!isDatabaseConfigured) {
      return NextResponse.json({ success: true })
    }

    try {
      if (markAllRead) {
        if (userRole === "KARYAWAN") {
          await queryPg(
            `UPDATE notifications SET "isRead" = true WHERE recipient = ANY($1::text[])`,
            [["karyawan", "all", cleanUser, "*"]]
          )
        } else {
          await queryPg(
            `UPDATE notifications SET "isRead" = true WHERE recipient = ANY($1::text[])`,
            [[cleanUser, "admin", "all", "*", "rama", "refo"]]
          )
        }
      } else if (id) {
        await queryPg(
          `UPDATE notifications SET "isRead" = true WHERE id = $1`,
          [id]
        )
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

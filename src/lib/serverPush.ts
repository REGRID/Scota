import webpush from "web-push"
import { queryPg, isDatabaseConfigured } from "./pgDb"

// VAPID keys for Web Push Protocol
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BO_S9oK2ObAvgfSAO-osPlgLpEp6471E9BVQxYNN0CgbQPHFEojBmJAvRhcK4iOqmYkmRfmOGpK6wUOezzaoWhk"

export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ""

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@notaphoto.com"

// Initialize web-push details fail-closed
if (!VAPID_PRIVATE_KEY) {
  console.warn(
    "[WebPush Config Warning] VAPID_PRIVATE_KEY environment variable is not configured. Web Push notification delivery is disabled."
  )
} else {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (e) {
    console.error("[WebPush Init Error]:", e)
  }
}

export interface PushPayload {
  title: string
  message: string
  url?: string
  icon?: string
  badge?: string
  tag?: string
  timestamp?: number
}

export interface SendPushOptions {
  tenantId: string
  scope?: "TENANT" | "GLOBAL"
  title: string
  message: string
  url?: string
  recipientRole?: "ALL" | "ADMIN" | "KARYAWAN"
  excludeUsername?: string
  tag?: string
}

/**
 * Broadcasts a Web Push notification to all matching subscriptions (even when browser/app is closed on mobile).
 */
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"

export async function sendWebPushNotification(options: SendPushOptions) {
  if (!VAPID_PRIVATE_KEY) {
    console.error("[WebPush Delivery Aborted] VAPID_PRIVATE_KEY is not configured in environment variables.")
    return { success: false, sentCount: 0, error: "VAPID_PRIVATE_KEY is not configured" }
  }

  if (!isDatabaseConfigured) {
    return { success: true, sentCount: 0 }
  }

  try {
    const {
      tenantId,
      scope = "TENANT",
      title,
      message,
      url = "/",
      recipientRole = "ALL",
      excludeUsername,
      tag,
    } = options

    const isGlobal = scope === "GLOBAL"
    if (!isGlobal && !tenantId) {
      console.error("[WebPush Error] tenantId is required when scope is not GLOBAL.")
      return { success: false, sentCount: 0, error: "tenantId is required" }
    }

    let subscriptions: {
      id: string
      endpoint: string
      p256dh: string
      auth: string
      username: string
      role: string
    }[] = []

    const isMigrated = (!isGlobal && tenantId) ? await isTenantSchemaMigrated(tenantId) : false

    if (!isGlobal && tenantId && isMigrated) {
      subscriptions = await withTenantSchema(tenantId, async (client) => {
        let tQuery = `SELECT id, endpoint, p256dh, auth, username, role FROM push_subscriptions WHERE 1=1`
        const tParams: any[] = []
        if (recipientRole !== "ALL") {
          tParams.push(recipientRole)
          tQuery += ` AND (role = $${tParams.length} OR role = 'ALL')`
        }
        const res = await client.query(tQuery, tParams)
        return res.rows || []
      })
    } else {
      let query = `SELECT id, endpoint, p256dh, auth, username, role FROM push_subscriptions WHERE 1=1`
      const params: any[] = []

      if (!isGlobal && tenantId) {
        params.push(tenantId)
        query += ` AND "tenantId" = $${params.length}`
      }

      if (recipientRole !== "ALL") {
        params.push(recipientRole)
        query += ` AND (role = $${params.length} OR role = 'ALL')`
      }

      const res = await queryPg<{
        id: string
        endpoint: string
        p256dh: string
        auth: string
        username: string
        role: string
      }>(query, params)
      subscriptions = res.rows || []
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0 }
    }

    const cleanTitle = title.trim()
    const cleanMessage = message.trim()

    const payload: PushPayload = {
      title: cleanTitle,
      message: cleanMessage,
      url,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || `nota-${Date.now()}`,
      timestamp: Date.now(),
    }

    const jsonPayload = JSON.stringify(payload)
    const staleEndpointIds: string[] = []
    let sentCount = 0

    const sendPromises = subscriptions.map(async (sub) => {
      if (excludeUsername && sub.username && sub.username.toLowerCase() === excludeUsername.toLowerCase()) {
        return
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, jsonPayload, {
          TTL: 86400,
          urgency: "high",
        })
        sentCount++
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpointIds.push(sub.id)
        } else {
          console.warn(`[WebPush] Failed to push to endpoint (${sub.username || "unknown"}):`, err.message || err)
        }
      }
    })

    await Promise.allSettled(sendPromises)

    // Remove expired subscriptions in the background
    if (staleEndpointIds.length > 0) {
      if (!isGlobal && tenantId && isMigrated) {
        await withTenantSchema(tenantId, async (client) => {
          await client.query(`DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`, [staleEndpointIds])
        }).catch(() => {})
      } else {
        await queryPg(
          `DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`,
          [staleEndpointIds]
        ).catch(() => {})
      }
    }

    return { success: true, sentCount, staleRemoved: staleEndpointIds.length }
  } catch (err) {
    console.error("[WebPush Broadcast Error]:", err)
    return { success: false, error: err }
  }
}

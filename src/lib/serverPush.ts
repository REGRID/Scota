import webpush from "web-push"
import { queryPg, isDatabaseConfigured } from "./pgDb"

// VAPID keys for Web Push Protocol
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BO_S9oK2ObAvgfSAO-osPlgLpEp6471E9BVQxYNN0CgbQPHFEojBmJAvRhcK4iOqmYkmRfmOGpK6wUOezzaoWhk"

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "ZFrM4s75bYa7BITthm3kVzdKQtfQankA-Mwvhsd9TI0"

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@notaphoto.com"

// Initialize web-push details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} catch (e) {
  console.error("[WebPush Init Error]:", e)
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
  tenantId?: string
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
export async function sendWebPushNotification(options: SendPushOptions) {
  if (!isDatabaseConfigured) {
    return { success: true, sentCount: 0 }
  }

  try {
    const { tenantId, title, message, url = "/", recipientRole = "ALL", excludeUsername, tag } = options

    let query = `SELECT id, endpoint, p256dh, auth, username, role FROM push_subscriptions WHERE 1=1`
    const params: any[] = []

    if (tenantId) {
      params.push(tenantId)
      query += ` AND ("tenantId" = $${params.length} OR "tenantId" IS NULL)`
    }

    if (recipientRole !== "ALL") {
      params.push(recipientRole)
      query += ` AND (role = $${params.length} OR role = 'ALL')`
    }

    const { rows: subscriptions } = await queryPg<{
      id: string
      endpoint: string
      p256dh: string
      auth: string
      username: string
      role: string
    }>(query, params)

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
      await queryPg(
        `DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`,
        [staleEndpointIds]
      ).catch(() => {})
    }

    return { success: true, sentCount, staleRemoved: staleEndpointIds.length }
  } catch (err) {
    console.error("[WebPush Broadcast Error]:", err)
    return { success: false, error: err }
  }
}

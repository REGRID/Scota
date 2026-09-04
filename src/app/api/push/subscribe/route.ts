import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { VAPID_PUBLIC_KEY } from "@/lib/serverPush"
import { getSession } from "@/lib/authHelper"
import { DEFAULT_TENANT_ID } from "@/lib/session"

// GET: Returns VAPID Public Key for client-side subscription
export async function GET() {
  return NextResponse.json({
    publicKey: VAPID_PUBLIC_KEY,
  })
}

// POST: Register or update push subscription
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    const body = await req.json()
    const { subscription, username = "all", role = "ALL" } = body
    const tenantId = session?.tenantId || body.tenantId || DEFAULT_TENANT_ID

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 }
      )
    }

    const { endpoint, keys } = subscription
    const { p256dh, auth } = keys

    if (!p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing p256dh or auth keys" },
        { status: 400 }
      )
    }

    if (isDatabaseConfigured) {
      await queryPg(
        `INSERT INTO push_subscriptions ("tenantId", endpoint, p256dh, auth, username, role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (endpoint)
         DO UPDATE SET "tenantId" = EXCLUDED."tenantId", p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, username = EXCLUDED.username, role = EXCLUDED.role, "updatedAt" = NOW()`,
        [tenantId, endpoint, p256dh, auth, (session?.username || username || "all").toLowerCase(), (session?.role || role || "ALL").toUpperCase()]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[API push/subscribe catch]:", err)
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

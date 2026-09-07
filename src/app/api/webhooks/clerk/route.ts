import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { NextRequest, NextResponse } from "next/server"
import { queryPg } from "@/lib/pgDb"

/**
 * Clerk Webhook Handler
 * Synchronizes user updates and deactivations from Clerk to local PostgreSQL.
 * Securely verified via CLERK_WEBHOOK_SIGNING_SECRET.
 */
export async function POST(req: NextRequest) {
  let evt: any
  try {
    evt = await verifyWebhook(req)
  } catch (err: any) {
    console.error("[ClerkWebhook] Signature verification failed:", err?.message || err)
    return NextResponse.json({ error: "Signature tidak valid atau missing signing secret" }, { status: 400 })
  }

  try {
    if (evt.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, username } = evt.data
      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || username || "Pengguna"
      const email = email_addresses?.[0]?.email_address || ""

      await queryPg(
        `UPDATE admin_accounts SET email = $1, "fullName" = $2, "updatedAt" = NOW() WHERE "clerkId" = $3`,
        [email, fullName, id]
      )
    }

    if (evt.type === "user.deleted") {
      // Soft-deactivate rather than hard delete to preserve receipt audit records
      await queryPg(
        `UPDATE admin_accounts SET status = 'deactivated', "updatedAt" = NOW() WHERE "clerkId" = $1`,
        [evt.data.id]
      )
    }

    return NextResponse.json({ received: true })
  } catch (dbErr) {
    console.error("[ClerkWebhook] Database sync error:", dbErr)
    return NextResponse.json({ error: "Database sync failed" }, { status: 500 })
  }
}

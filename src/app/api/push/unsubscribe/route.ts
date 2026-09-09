import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSession } from "@/lib/authHelper"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    const body = await req.json()
    const { endpoint } = body
    const tenantId = session?.tenantId || body?.tenantId

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
    }

    if (isDatabaseConfigured) {
      if (tenantId) {
        const isMigrated = await isTenantSchemaMigrated(tenantId)
        if (isMigrated) {
          await withTenantSchema(tenantId, async (client) => {
            await client.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint])
          }).catch(() => {})
        }
      }
      await queryPg(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

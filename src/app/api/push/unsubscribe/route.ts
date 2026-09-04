import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
    }

    if (isDatabaseConfigured) {
      await queryPg(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint])
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ success: true, receipts: [] })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "100")
    const search = (searchParams.get("search") || "").trim()

    let query = `SELECT * FROM receipts`
    const params: any[] = []

    if (search) {
      query += ` WHERE "merchantName" ILIKE $1`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY "createdAt" DESC LIMIT ${limit}`

    const { rows: receipts } = await queryPg(query, params)

    return NextResponse.json({ success: true, receipts: receipts || [] })
  } catch (error: any) {
    return NextResponse.json({ success: true, receipts: [] })
  }
}

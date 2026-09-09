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

    // Enable Superadmin bypass for PostgreSQL Row-Level Security (RLS)
    await queryPg(`SELECT set_config('app.is_superadmin', 'true', false)`)

    // Find all active isolated tenant schemas
    const { rows: schemas } = await queryPg<{ schema_name: string }>(
      `SELECT schema_name 
       FROM information_schema.schemata 
       WHERE schema_name LIKE 'tenant_%'`
    )

    const validSchemas = (schemas || [])
      .map(s => s.schema_name)
      .filter(name => /^tenant_[a-f0-9_]+$/.test(name))

    const selectPublic = `
      SELECT id, "tenantId", "merchantName", date, "imageUrl", subtotal, 
             "discountAmount", "taxAmount", "totalAmount", "paymentMethod", 
             "paymentStatus", note, "createdAt", "updatedAt"
      FROM public.receipts
    `

    const selectTenantSchemas = validSchemas.map(schemaName => `
      SELECT id, "tenantId", "merchantName", date, "imageUrl", subtotal, 
             "discountAmount", "taxAmount", "totalAmount", "paymentMethod", 
             "paymentStatus", notes as note, "createdAt", "updatedAt"
      FROM "${schemaName}".receipts
    `)

    const unionQuery = [selectPublic, ...selectTenantSchemas].join(" UNION ALL ")

    const params: any[] = []
    let whereClause = ""

    if (search) {
      whereClause = ` WHERE "merchantName" ILIKE $1`
      params.push(`%${search}%`)
      params.push(limit)
    } else {
      params.push(limit)
    }

    const limitParamIndex = params.length

    const finalQuery = `
      WITH unified_receipts AS (
        ${unionQuery}
      )
      SELECT * FROM unified_receipts
      ${whereClause}
      ORDER BY "createdAt" DESC 
      LIMIT $${limitParamIndex}
    `

    const { rows: receipts } = await queryPg(finalQuery, params)

    return NextResponse.json({ success: true, receipts: receipts || [] })
  } catch (error: any) {
    console.error("[Superadmin Receipts Error]:", error)
    return NextResponse.json({ success: true, receipts: [] })
  }
}

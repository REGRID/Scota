import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "100")
    const search = (searchParams.get("search") || "").trim()

    let query = supabase
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (search) {
      query = query.ilike("merchantName", `%${search}%`)
    }

    const { data: receipts, error } = await query

    if (error) {
      console.warn("Superadmin global receipts query notice:", error)
      return NextResponse.json({ success: true, receipts: [] })
    }

    return NextResponse.json({ success: true, receipts: receipts || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengambil data nota global" }, { status: 500 })
  }
}

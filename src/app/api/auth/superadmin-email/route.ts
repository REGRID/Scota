import { NextResponse } from "next/server"
import { getSuperadminEmail } from "@/lib/superadminConfig"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    authorizedEmail: getSuperadminEmail(),
  })
}

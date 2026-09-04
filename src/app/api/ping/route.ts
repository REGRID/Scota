import { NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

/**
 * Health Check / Ping API Endpoint for Database
 */
export async function GET() {
  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json(
        {
          status: "standalone",
          message: "Scota running in standalone local memory mode",
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      )
    }

    const { rows } = await queryPg<{ now: string }>(`SELECT NOW() as now`)

    return NextResponse.json(
      {
        status: "healthy",
        message: "PostgreSQL database connection active",
        serverTime: rows?.[0]?.now,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error?.message || "Internal Database Error",
      },
      { status: 500 }
    )
  }
}

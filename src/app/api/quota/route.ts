import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, normalizeIp } from "@/lib/rateLimiter"
import { DEMO_SCAN_LIMIT, getOrCreateDemoTenant } from "@/lib/demoTenant"
import { isDatabaseConfigured } from "@/lib/pgDb"

export async function GET(req: NextRequest) {
  try {
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"

    const cleanIp = normalizeIp(rawIp)
    let used = 0

    if (isDatabaseConfigured) {
      try {
        const demoTenant = await getOrCreateDemoTenant(cleanIp)
        used = demoTenant.demoScanCount || 0
      } catch {
        const rateLimit = await checkRateLimit(cleanIp)
        used = rateLimit.current
      }
    } else {
      const rateLimit = await checkRateLimit(cleanIp)
      used = rateLimit.current
    }

    const remaining = Math.max(0, DEMO_SCAN_LIMIT - used)
    const allowed = remaining > 0

    const res = NextResponse.json({
      dailyLimit: DEMO_SCAN_LIMIT,
      used,
      remaining,
      allowed,
      ip: cleanIp,
    })

    // Disable browser HTTP caching so quota is 100% real-time on every refresh
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    return res
  } catch (error: any) {
    return NextResponse.json({
      dailyLimit: DEMO_SCAN_LIMIT,
      used: 0,
      remaining: DEMO_SCAN_LIMIT,
      allowed: true,
    })
  }
}

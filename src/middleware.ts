import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session"

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/signin(.*)",
  "/signup(.*)",
  "/pricing(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/sso-callback(.*)",
  "/superadmin(.*)",
  "/join(.*)",
  "/api/invites(.*)",
  "/api/tenants(.*)",
  "/api/ping",
  "/api/quota",
  "/api/parse-receipt",
  "/api/auth/(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks/pakasir(.*)",
  "/api/subscription(.*)",
  "/api/settings(.*)",
])

export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // 2. Proteksi API Superadmin (/api/superadmin/**)
  if (pathname.startsWith("/api/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      return NextResponse.json({ error: "Akses ditolak. Sesi Superadmin tidak valid." }, { status: 401 })
    }

    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Akses ditolak. Endpoint khusus Superadmin." }, { status: 403 })
    }

    return NextResponse.next()
  }

  // 2. Proteksi API Routes Non-Publik (/api/**)
  if (pathname.startsWith("/api/") && !isPublicRoute(req)) {
    const { userId } = await auth()
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader
    const hasLegacySession = token && (await verifySessionToken(token))

    if (!userId && !hasLegacySession) {
      return NextResponse.json(
        { error: "Sesi tidak valid. Silakan login terlebih dahulu." },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
})

export default middleware

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session"

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/signin(.*)",
  "/signup(.*)",
  "/pricing(.*)",
  "/sso-callback(.*)",
  "/api/ping",
  "/api/quota",
  "/api/parse-receipt",
  "/api/auth/(.*)",
  "/api/subscription(.*)",
])

export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // Proteksi Halaman Superadmin
  if (pathname.startsWith("/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", req.url))
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

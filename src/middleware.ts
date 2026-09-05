import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session"

// Daftar route yang MEMANG boleh diakses tanpa login.
// Prinsipnya: default TERTUTUP -- kalau tidak ada di daftar ini, wajib punya sesi valid.
const PUBLIC_API_ROUTES = [
  "/api/ping",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/demo-login", // endpoint bridge sesi Scota untuk demo Google
  "/api/auth/callback", // endpoint callback Auth.js (mis. /api/auth/callback/google)
  "/api/parse-receipt", // publik by design untuk scan sebelum login
  "/api/quota", // satu paket dengan parse-receipt -- menampilkan sisa kuota IP, bukan data tenant
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- Bagian 1: Proteksi Halaman /superadmin/** ---
  if (pathname.startsWith("/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      // Belum login sama sekali -> arahkan ke halaman login
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const session = await verifySessionToken(token)

    if (!session || session.role !== "SUPERADMIN") {
      // Sudah login TAPI bukan superadmin -> arahkan senyap ke halaman utama,
      // BUKAN ke halaman 403 Forbidden agar tidak mengonfirmasi keberadaan panel superadmin
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  }

  // --- Bagian 2: Proteksi API /api/** ---
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))
  if (isPublic) {
    return NextResponse.next()
  }

  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  const token = sessionCookie || authHeader

  if (!token) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
  }

  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa." }, { status: 401 })
  }

  // Teruskan hasil verifikasi lewat header internal
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-verified-username", session.username)
  requestHeaders.set("x-verified-tenant-id", session.tenantId || "")

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/api/:path*", "/superadmin/:path*"],
}

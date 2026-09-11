# Fix: Regresi Ketiga — Halaman `/superadmin` Terbuka Lagi + Test CI Permanen

## Masalah

Ini kejadian **ketiga** dengan pola yang sama: blok proteksi untuk halaman `/superadmin/**` hilang lagi dari `middleware.ts`. Dua kejadian sebelumnya sudah diperbaiki, tapi setiap kali ada refactor besar di area middleware/superadmin, blok ini rupanya ikut terhapus tanpa disadari.

Kondisi `middleware.ts` saat ini:

```ts
const isPublicRoute = createRouteMatcher([
  ...
  "/superadmin(.*)",   // entry ini TIDAK BERPENGARUH untuk halaman (isPublicRoute cuma dipakai di blok /api/),
  ...                  // tapi menyesatkan -- terlihat seperti "sengaja diizinkan publik"
])

export const middleware = clerkMiddleware(async (auth, req) => {
  // Cuma ada 2 blok: proteksi /api/superadmin, dan proteksi umum /api/**
  // TIDAK ADA blok yang menangani halaman /superadmin/** sama sekali
```

Karena tidak ada blok untuk halaman, siapa pun bisa buka `/superadmin`, `/superadmin/tenants`, `/superadmin/billing`, dll langsung tanpa login. Data di dalamnya tetap aman (endpoint `/api/superadmin/**` masih terlindungi blok terpisah), tapi kerangka halaman/layout-nya bocor ke publik.

## Solusi — Bagian 1: Kembalikan Blok Proteksi

```ts
// src/middleware.ts
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
  "/superadmin/login",       // <- HANYA halaman login yang publik, bukan seluruh /superadmin
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
  "/onboarding(.*)",
  "/api/onboarding(.*)",
])

export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // 1. Proteksi HALAMAN /superadmin/** (dikembalikan -- ini yang hilang)
  if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login") {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      return NextResponse.redirect(new URL("/superadmin/login", req.url))
    }

    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  }

  // 2. Proteksi API Superadmin (/api/superadmin/**) -- TIDAK BERUBAH
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

  // 3. Proteksi API Routes Non-Publik (/api/**) -- TIDAK BERUBAH
  if (pathname.startsWith("/api/") && !isPublicRoute(req)) {
    const { userId } = await auth()
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader
    const hasLegacySession = token && (await verifySessionToken(token))

    if (!userId && !hasLegacySession) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login terlebih dahulu." }, { status: 401 })
    }
  }

  return NextResponse.next()
})

export default middleware

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
```

## Solusi — Bagian 2: Test Otomatis Permanen (Supaya Tidak Terjadi Keempat Kalinya)

Karena ini sudah kejadian ketiga di titik yang **persis sama**, perbaikan kode saja tidak cukup — dibutuhkan jaring pengaman otomatis yang gagal-lantang (*loud failure*) setiap kali regresi ini terjadi lagi, idealnya terdeteksi **sebelum** sempat live, bukan ditemukan manual lagi setelah live.

**`scripts/test-superadmin-page-protected.ts`** (baru):

```ts
/**
 * Regression guard -- kejadian ke-3 blok proteksi halaman /superadmin hilang dari middleware.
 * Test ini WAJIB tetap ada dan dijalankan di setiap deploy. Kalau gagal, JANGAN di-skip --
 * artinya proteksi halaman superadmin benar-benar hilang lagi.
 */
const BASE_URL = process.env.TEST_BASE_URL || "https://scota.web.id"

async function testSuperadminPageProtected() {
  const paths = ["/superadmin", "/superadmin/tenants", "/superadmin/billing", "/superadmin/audit-log"]

  for (const path of paths) {
    const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual" })

    const isRedirect = res.status === 307 || res.status === 302 || res.status === 303
    if (!isRedirect) {
      console.error(`❌ REGRESI TERDETEKSI: ${path} mengembalikan status ${res.status} untuk pengunjung tanpa sesi (seharusnya redirect).`)
      process.exit(1)
    }

    const location = res.headers.get("location") || ""
    if (!location.includes("/superadmin/login")) {
      console.error(`❌ REGRESI TERDETEKSI: ${path} redirect ke "${location}", seharusnya ke /superadmin/login.`)
      process.exit(1)
    }

    console.log(`✅ ${path} -> redirect ke /superadmin/login (aman)`)
  }

  // Pastikan halaman login itu sendiri TIDAK ikut ter-redirect (tidak infinite loop)
  const loginRes = await fetch(`${BASE_URL}/superadmin/login`, { redirect: "manual" })
  if (loginRes.status >= 300 && loginRes.status < 400) {
    console.error(`❌ REGRESI TERDETEKSI: /superadmin/login sendiri ikut ter-redirect (kemungkinan infinite redirect).`)
    process.exit(1)
  }
  console.log(`✅ /superadmin/login dapat diakses langsung (tidak infinite redirect)`)

  console.log("\n✅ Semua test proteksi halaman superadmin lolos.")
}

testSuperadminPageProtected().catch((err) => {
  console.error("Test error:", err)
  process.exit(1)
})
```

### Jalankan otomatis setiap deploy

Tambahkan ke `.github/workflows/deploy.yml`, sebagai langkah **setelah** deploy selesai (supaya benar-benar test kondisi live, bukan cuma kode lokal):

```yaml
- name: Verify superadmin page protection (regression guard)
  run: node --loader ts-node/esm scripts/test-superadmin-page-protected.ts
  env:
    TEST_BASE_URL: https://scota.web.id
```

Kalau step ini gagal, workflow deploy sebaiknya ditandai gagal juga (bukan cuma warning) — supaya siapa pun yang me-merge perubahan middleware langsung tahu kalau tidak sengaja menghapus proteksi ini lagi, sebelum sempat jadi masalah produksi.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/middleware.ts` | Kembalikan blok proteksi halaman `/superadmin/**`; ganti `"/superadmin(.*)"` di `isPublicRoute` jadi `"/superadmin/login"` saja |
| `scripts/test-superadmin-page-protected.ts` | **Baru** — regression guard otomatis |
| `.github/workflows/deploy.yml` | Tambah step verifikasi pasca-deploy |

## Catatan Penting

- Ini regresi ketiga di titik yang sama persis — kemungkinan besar terjadi karena `middleware.ts` sering ditulis ulang total (bukan di-patch sebagian) setiap kali ada fitur besar baru (Clerk, multi-tenant, dst). Kalau memungkinkan, pertimbangkan pecah proteksi superadmin jadi fungsi terpisah yang di-import (`protectSuperadminPage(req)`), bukan inline di dalam body `clerkMiddleware` — supaya lebih kecil kemungkinan hilang saat file ini ditulis ulang lagi di masa depan.
- Test di atas sengaja mengecek **status code + tujuan redirect**, bukan cuma "apakah 401" — supaya kalau nanti ada yang mengubah cara proteksinya (misal dari redirect jadi langsung block), test ini akan gagal dan memaksa update, bukan diam-diam jadi tidak relevan.

## Checklist Verifikasi

- [ ] Buka `/superadmin` tanpa login → redirect ke `/superadmin/login`
- [ ] Buka `/superadmin/tenants`, `/superadmin/billing` langsung tanpa login → sama-sama redirect, tidak ada yang lolos
- [ ] Buka `/superadmin/login` langsung → tidak ikut ter-redirect, form tampil normal
- [ ] Login sebagai superadmin sungguhan → semua halaman `/superadmin/**` bisa diakses normal seperti biasa
- [ ] Jalankan `scripts/test-superadmin-page-protected.ts` secara manual → semua lolos (✅)
- [ ] Cek `.github/workflows/deploy.yml` → step verifikasi ini benar-benar terpasang dan akan menggagalkan deploy kalau test ini gagal

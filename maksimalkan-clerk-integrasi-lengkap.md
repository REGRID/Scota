# Maksimalkan Clerk: Dari "Ter-install" Jadi Benar-Benar Berfungsi

## Ringkasan

Clerk sudah ter-install penuh tapi **belum tersambung ke apa pun** di aplikasi. Kalau ada orang berhasil sign-up lewat Clerk hari ini, dia akan stuck total — tidak bisa akses dashboard/scan/apa pun, karena sistem inti aplikasi (semua yang bergantung ke `getSession()`) tidak tahu Clerk itu ada. 5 celah yang menyebabkannya sudah ditampilkan di kartu sebelumnya (navigasi tidak terhubung, `getSession()` buta terhadap Clerk, tidak ada webhook, tidak ada kolom `clerkId`, middleware bocor).

Dokumen ini menutup semuanya, plus memutuskan nasib sistem lama (password manual, Auth.js/Google) yang sekarang tumpang tindih dengan Clerk.

---

## 1. Skema — Tambahkan Kolom Penghubung

```sql
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS "clerkId" TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS admin_accounts_clerk_idx ON admin_accounts ("clerkId");
```

`clerkId` dibuat nullable + unique — akun lama (password/Google) tetap valid tanpa `clerkId` sampai mereka migrasi (lihat Bagian 6).

## 2. Environment Variables

Pastikan semua ini sudah diset di Vercel (dan `.env.local` untuk dev):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
CLERK_WEBHOOK_SIGNING_SECRET="whsec_..."   # baru -- untuk webhook di Bagian 4
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

## 3. Jembatani `getSession()` ke Clerk — Ini Perbaikan Paling Penting

Supaya **seluruh** endpoint yang sudah ada (`receipts`, `categories`, `notifications`, dll — ratusan pemanggilan `getSession(req)`) otomatis bisa menerima pengguna Clerk **tanpa perlu diubah satu per satu**, ubah `getSession()` sendiri supaya jadi jembatan:

```ts
// src/lib/authHelper.ts
import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifySessionToken, SessionPayload } from "@/lib/session"
import { queryPg } from "@/lib/pgDb"
import { provisionTenantForClerkUser } from "@/lib/clerkBridge"

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  // 1. Coba sesi lama dulu (password / Google via Auth.js) -- tidak mengganggu akun yang sudah ada.
  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  const legacyToken = sessionCookie || authHeader

  if (legacyToken) {
    const legacySession = await verifySessionToken(legacyToken)
    if (legacySession) return legacySession
  }

  // 2. Kalau tidak ada sesi lama, cek sesi Clerk.
  const { userId } = await auth()
  if (!userId) return null

  const res = await queryPg<{ username: string; role: string; tenantId: string; fullName: string }>(
    `SELECT username, role, "tenantId", "fullName" FROM admin_accounts WHERE "clerkId" = $1`,
    [userId]
  )

  if (res.rows?.[0]) {
    const account = res.rows[0]
    return { username: account.username, role: account.role as any, tenantId: account.tenantId, staffName: account.fullName }
  }

  // 3. User Clerk ini belum punya tenant sama sekali -- provisioning otomatis (JIT),
  //    JANGAN menunggu webhook (webhook Clerk async & tidak dijamin sudah selesai
  //    di titik ini -- ini rekomendasi resmi Clerk sendiri untuk kasus seperti ini).
  return provisionTenantForClerkUser(userId)
}
```

**`src/lib/clerkBridge.ts`** (baru) — provisioning otomatis, aman dipanggil berkali-kali (idempotent):

```ts
import { currentUser } from "@clerk/nextjs/server"
import { queryPg } from "@/lib/pgDb"
import type { SessionPayload } from "@/lib/session"

export async function provisionTenantForClerkUser(clerkId: string): Promise<SessionPayload | null> {
  const user = await currentUser()
  if (!user) return null

  const email = user.emailAddresses?.[0]?.emailAddress || ""
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Pengguna Baru"

  // Cek dulu (race-safe lewat ON CONFLICT di bawah, ini cuma fast-path).
  const existing = await queryPg<{ username: string; role: string; tenantId: string }>(
    `SELECT username, role, "tenantId" FROM admin_accounts WHERE "clerkId" = $1`,
    [clerkId]
  )
  if (existing.rows?.[0]) {
    const a = existing.rows[0]
    return { username: a.username, role: a.role as any, tenantId: a.tenantId, staffName: fullName }
  }

  const tenantRes = await queryPg<{ id: string }>(
    `INSERT INTO tenants ("businessName", status, "createdAt", "updatedAt")
     VALUES ($1, 'active', NOW(), NOW()) RETURNING id`,
    [`Bisnis ${fullName}`]
  )
  const tenantId = tenantRes.rows[0].id
  const username = `clerk_${clerkId.slice(-10)}`

  await queryPg(
    `INSERT INTO admin_accounts (username, "clerkId", email, "fullName", role, "tenantId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'OWNER', $5, NOW(), NOW())
     ON CONFLICT ("clerkId") DO NOTHING`,
    [username, clerkId, email, fullName, tenantId]
  )

  // Selalu buat tier trial 14 hari untuk tenant baru (konsisten dengan aturan lama:
  // tier tidak pernah ditentukan dari input pengguna).
  await queryPg(
    `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "createdAt", "updatedAt")
     VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days', NOW(), NOW())`,
    [tenantId]
  )

  return { username, role: "OWNER" as any, tenantId, staffName: fullName }
}
```

## 4. Webhook Clerk — Untuk `user.updated` & `user.deleted`, Bukan Provisioning Utama

Provisioning inti sudah ditangani JIT di Bagian 3 (menghindari race condition, karena webhook Clerk **async dan tidak dijamin selesai** tepat saat user baru pertama kali membuka dashboard — ini peringatan resmi dari dokumentasi Clerk sendiri). Webhook tetap dipasang untuk menjaga data tetap sinkron kalau user ganti nama/email di Clerk, atau menghapus akunnya:

```ts
// src/app/api/webhooks/clerk/route.ts
import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { NextRequest, NextResponse } from "next/server"
import { queryPg } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)   // baca CLERK_WEBHOOK_SIGNING_SECRET otomatis, throw kalau signature salah
  } catch (err) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 400 })
  }

  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data
    const fullName = `${first_name || ""} ${last_name || ""}`.trim()
    await queryPg(
      `UPDATE admin_accounts SET email = $1, "fullName" = $2, "updatedAt" = NOW() WHERE "clerkId" = $3`,
      [email_addresses?.[0]?.email_address || "", fullName, id]
    )
  }

  if (evt.type === "user.deleted") {
    // Nonaktifkan, jangan hard-delete -- data tenant/nota tetap harus ada untuk keperluan audit/billing.
    await queryPg(`UPDATE admin_accounts SET status = 'deactivated' WHERE "clerkId" = $1`, [evt.data.id])
  }

  return NextResponse.json({ received: true })
}
```

Daftarkan endpoint ini di **Clerk Dashboard → Webhooks**, arahkan ke `https://scota.web.id/api/webhooks/clerk`, centang event `user.updated` dan `user.deleted`.

## 5. Perbaiki Middleware — Enforcement + Kompatibel Clerk

```ts
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session"

const isPublicRoute = createRouteMatcher([
  "/", "/login(.*)", "/register(.*)", "/sign-in(.*)", "/sign-up(.*)",
  "/pricing(.*)", "/sso-callback(.*)",
  "/api/ping", "/api/quota", "/api/parse-receipt",
  "/api/auth/(.*)", "/api/webhooks/clerk",
])

export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const token = sessionCookie || req.headers.get("authorization")?.replace("Bearer ", "").trim()
    if (!token) return NextResponse.redirect(new URL("/login", req.url))
    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") return NextResponse.redirect(new URL("/", req.url))
    return NextResponse.next()
  }

  // BARU -- benar-benar menegakkan isPublicRoute, bukan cuma deklarasi
  if (pathname.startsWith("/api/") && !isPublicRoute(req)) {
    const { userId } = await auth()
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const hasLegacySession = sessionCookie && (await verifySessionToken(sessionCookie))

    if (!userId && !hasLegacySession) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
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

Perlu tambahkan `/api/webhooks/clerk` ke `isPublicRoute` — endpoint webhook wajib bisa diakses tanpa sesi (Clerk yang memanggilnya langsung, bukan browser pengguna), keamanannya dijaga lewat verifikasi signature (`verifyWebhook`), bukan lewat cek sesi.

## 6. Hubungkan Navigasi ke Clerk — Putuskan Satu Sumber Kebenaran

Ini keputusan produk yang perlu diambil, bukan cuma teknis:

**Opsi A — Clerk jadi satu-satunya pintu masuk baru** (disarankan, paling bersih): Ganti semua `href="/login"` dan `href="/register"` di `IntroductionDashboard.tsx`, `SubscriptionBanner.tsx`, `pricing/page.tsx` supaya mengarah ke `/sign-in` dan `/sign-up`. Halaman `/login`/`/register` lama tetap dibiarkan hidup **hanya** untuk akun lama yang belum migrasi (lihat Bagian 7), tidak lagi dipromosikan di navigasi manapun.

**Opsi B — Tetap dua pintu berdampingan**: Kalau ada alasan bisnis untuk tetap menawarkan password manual (misalnya sebagian pengguna tidak nyaman pakai akun Google/pihak ketiga), tambahkan link "Daftar dengan Email/Password" kecil di halaman `/sign-up` Clerk, dan sebaliknya. Lebih ribet dari sisi UX (2 sistem paralel selamanya), tapi memberi pilihan.

Saya sarankan **Opsi A** — dua sistem paralel selamanya cuma menambah kompleksitas & permukaan yang perlu diamankan tanpa manfaat besar buat pengguna.

## 7. Bereskan Sistem yang Jadi Redundan

Setelah Clerk aktif dan jadi pintu utama, sistem Auth.js (Google via `next-auth`) jadi **sepenuhnya redundan** — Clerk sendiri sudah punya "Sign in with Google" bawaan (tinggal aktifkan provider Google di Clerk Dashboard), jadi tidak perlu dua jalur OAuth Google yang berbeda.

**Boleh dihapus** (setelah dipastikan tidak ada lagi yang memakainya):
- `next-auth` dari `package.json`
- `src/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/google-login/route.ts`
- `src/app/api/auth/demo-login/route.ts` (kalau memang sudah tidak dipakai alur demo manapun)
- `src/app/auth/callback/page.tsx`

**Tetap dipertahankan** (jangan dihapus):
- Sistem password lama (`login/route.ts`, `register/route.ts`, `session.ts`, `password.ts`) — masih dibutuhkan untuk akun yang belum migrasi ke Clerk (Bagian 8), dan untuk superadmin yang sengaja tetap pakai sistem internal terpisah dari Clerk (lebih sedikit dependensi eksternal untuk akun sepenting itu).

## 8. Migrasi Akun Lama ke Clerk (Opsional, Bertahap)

Akun yang sudah ada (password atau `googleId` dari Auth.js) **tetap bisa login seperti biasa** lewat `/login` — tidak ada yang rusak. Kalau suatu saat ingin mendorong mereka pindah ke Clerk sepenuhnya:

1. Tambahkan tombol "Hubungkan ke Google/Clerk" di halaman `/settings` untuk user yang sudah login lewat sistem lama.
2. Klik → alur OAuth Clerk → dapat `clerkId` → `UPDATE admin_accounts SET "clerkId" = $1 WHERE username = $2`.
3. Setelah `clerkId` terisi, `getSession()` di Bagian 3 akan otomatis mengenali mereka lewat jalur Clerk juga di kunjungan berikutnya — password lama tetap valid sebagai cadangan.

Migrasi paksa (mewajibkan semua akun pindah dalam waktu tertentu) **tidak disarankan** dilakukan sekaligus — biarkan berjalan natural, sistem lama tetap didukung selama masih ada akun yang memakainya.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `database/schema.sql` | Kolom `admin_accounts.clerkId` (baru) |
| `src/lib/authHelper.ts` | `getSession()` jadi jembatan: sesi lama → sesi Clerk → JIT provisioning |
| `src/lib/clerkBridge.ts` | **Baru** — `provisionTenantForClerkUser`, idempotent |
| `src/app/api/webhooks/clerk/route.ts` | **Baru** — sync `user.updated`/`user.deleted`, pakai `verifyWebhook` |
| `src/middleware.ts` | `isPublicRoute` benar-benar ditegakkan untuk `/api/**` |
| `IntroductionDashboard.tsx`, `SubscriptionBanner.tsx`, `pricing/page.tsx` | Link diarahkan ke `/sign-in`/`/sign-up` (Opsi A) |
| `package.json`, `src/auth.ts`, route Auth.js terkait | Dihapus setelah Clerk stabil (Bagian 7) |
| Clerk Dashboard | Webhook endpoint didaftarkan, provider Google diaktifkan |
| Vercel Environment Variables | `CLERK_WEBHOOK_SIGNING_SECRET` + variabel Clerk lain |

## Checklist Verifikasi

- [ ] Klik "Daftar Gratis" dari landing page → sampai ke `/sign-up` (Clerk), bukan `/register` lama
- [ ] Selesai sign-up via Clerk → langsung bisa akses `/dashboard`, tidak stuck di manapun
- [ ] Cek tabel `tenants`/`admin_accounts` → baris baru otomatis terbuat dengan `clerkId` terisi, tier `trial` aktif
- [ ] Update nama di Clerk (lewat `<UserProfile/>` atau dashboard Clerk) → `fullName` di `admin_accounts` ikut ter-update lewat webhook
- [ ] Akun lama (password) tetap bisa login normal lewat `/login`, tidak terpengaruh perubahan ini
- [ ] `curl` ke endpoint API tanpa sesi Clerk maupun sesi lama → tetap `401` (memastikan middleware benar-benar menegakkan lagi)
- [ ] Kirim payload palsu ke `/api/webhooks/clerk` tanpa signature valid → ditolak `400`, tidak diproses
- [ ] Hapus user di Clerk Dashboard → `admin_accounts.status` berubah jadi `deactivated`, bukan hard-delete (data nota tetap ada)

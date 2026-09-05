# Fitur Akun Demo via Google OAuth (Auth.js) — Detail Implementasi

Customer journey lengkapnya sudah ditampilkan terpisah (5 tahap: landing → Google sign-in → dashboard demo → limit tercapai → konversi trial). Dokumen ini fokus ke detail teknis implementasinya.

## Prinsip Desain Kunci

**Auth.js dipakai HANYA untuk handshake dengan Google** — begitu berhasil dapat profil (email, nama, `sub`/Google ID), sistem langsung menerbitkan session **milik Scota sendiri** lewat `createSessionToken` yang sudah ada di `session.ts`, disimpan di cookie `nota_admin_session` yang sama seperti login biasa. Dengan begini, `middleware.ts`, `getSession()`, dan semua route (`receipts`, `categories`, dll) **tidak perlu diubah satu baris pun** — mereka tetap membaca sesi dengan cara yang sama, tidak peduli asalnya dari login password atau dari Google.

## 1. Setup Google Cloud Console

1. Buat project baru (atau pakai yang sudah ada) di [Google Cloud Console](https://console.cloud.google.com).
2. **APIs & Services → OAuth consent screen** — isi nama aplikasi, logo, domain. Pilih **External** kalau untuk publik umum.
3. **Credentials → Create Credentials → OAuth Client ID** — tipe **Web application**.
4. **Authorized redirect URIs** — isi persis (jangan wildcard):
   ```
   https://<domain-production>/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google   (untuk dev lokal)
   ```
5. Simpan `Client ID` dan `Client Secret` yang muncul.

## 2. Install & Konfigurasi Auth.js

```bash
npm install next-auth@beta
```

**`.env.local`** (tambahkan, jangan pernah commit nilai asli — ikuti aturan `scripts/README.md` yang sudah ada):
```env
AUTH_GOOGLE_ID="<client-id-dari-google>"
AUTH_GOOGLE_SECRET="<client-secret-dari-google>"
AUTH_SECRET="<hasil openssl rand -base64 48 -- BEDA dari SESSION_SECRET yang sudah ada>"
```

**`src/auth.ts`** (baru, di root `src/`):
```ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/demo/masuk" }, // halaman custom, bukan halaman default Auth.js
})
```

**`src/app/api/auth/[...nextauth]/route.ts`** (baru):
```ts
export { GET, POST } from "@/auth"
```

## 3. Perubahan Skema Database

```sql
ALTER TABLE tenants ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN "demoGoogleId" TEXT;       -- `sub` dari profil Google, identitas unik
ALTER TABLE tenants ADD COLUMN "demoEmail" TEXT;
ALTER TABLE tenants ADD COLUMN "demoScanCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN "expiresAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX tenants_demo_google_idx ON tenants ("demoGoogleId") WHERE "isDemo" = true;
CREATE INDEX tenants_demo_expiry_idx ON tenants ("expiresAt") WHERE "isDemo" = true;
```

Kenapa `demoScanCount` langsung di tabel `tenants`, bukan pakai `authRateLimiter`/`scan_limits` yang sudah ada? Karena satu tenant demo **umurnya cuma sampai tengah malam ini juga** — begitu lewat tengah malam, seluruh tenant (termasuk hitungan scan-nya) dihapus cron. Tidak perlu logika "reset" terpisah seperti rate limiter IP lama; siklus hidupnya sendiri sudah otomatis jadi siklus harian.

Untuk `email` di tabel `admin_accounts` (dibutuhkan untuk trial "data lengkap" nanti):
```sql
ALTER TABLE admin_accounts ADD COLUMN email TEXT;
```

## 4. Helper: Auto-Provision Tenant Demo

**`src/lib/demoTenant.ts`** (baru):
```ts
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { createSessionToken } from "@/lib/session"

export const DEMO_SCAN_LIMIT = 2
export const DEMO_RECEIPT_LIMIT = 3

function nextMidnight(): Date {
  const d = new Date()
  d.setHours(24, 0, 0, 0) // jam 00:00 besok relatif ke waktu sekarang
  return d
}

/**
 * Cari tenant demo aktif milik googleId ini (belum expired).
 * Kalau tidak ada, buat baru dengan expiresAt = tengah malam nanti.
 */
export async function getOrCreateDemoTenant(googleId: string, email: string, name: string) {
  if (!isDatabaseConfigured) throw new Error("Database tidak terkonfigurasi")

  const existing = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `SELECT id, "expiresAt", "demoScanCount" FROM tenants
     WHERE "demoGoogleId" = $1 AND "isDemo" = true AND "expiresAt" > NOW()
     LIMIT 1`,
    [googleId]
  )

  if (existing.rows?.[0]) {
    return existing.rows[0]
  }

  const created = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `INSERT INTO tenants ("businessName", "isDemo", "demoGoogleId", "demoEmail", "expiresAt", "demoScanCount")
     VALUES ($1, true, $2, $3, $4, 0)
     RETURNING id, "expiresAt", "demoScanCount"`,
    [`Demo - ${name}`, googleId, email, nextMidnight().toISOString()]
  )
  return created.rows[0]
}

/** Menerbitkan cookie sesi Scota (bukan sesi Auth.js) untuk tenant demo ini. */
export async function issueDemoSession(tenantId: string, email: string) {
  return createSessionToken({
    username: `demo_${tenantId.slice(0, 8)}`,
    role: "DEMO",
    tenantId,
    fullName: email,
  })
}
```

## 5. Route Callback: Jembatan Auth.js → Sesi Scota

**`src/app/api/auth/demo-login/route.ts`** (baru — dipanggil dari frontend setelah Auth.js berhasil login Google):
```ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getOrCreateDemoTenant, issueDemoSession } from "@/lib/demoTenant"

export async function POST() {
  const authSession = await auth() // sesi Auth.js (dari Google)
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Login Google gagal atau dibatalkan" }, { status: 401 })
  }

  const googleId = (authSession.user as any).id || authSession.user.email // fallback kalau provider tidak expose `sub`
  const email = authSession.user.email
  const name = authSession.user.name || "Pengguna Demo"

  const tenant = await getOrCreateDemoTenant(googleId, email, name)
  const scotaToken = await issueDemoSession(tenant.id, email)

  const response = NextResponse.json({
    success: true,
    tenantId: tenant.id,
    scanUsed: tenant.demoScanCount,
    scanLimit: 2,
  })
  response.cookies.set({
    name: "nota_admin_session",
    value: scotaToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 hari -- selaras dengan siklus demo
  })
  return response
}
```

## 6. Update `parse-receipt/route.ts` — Simpan Hasil Scan ke Tenant Demo

Saat ini endpoint ini cuma OCR preview, tidak pernah menyimpan ke DB. Untuk alur demo, tambahkan penyimpanan otomatis + pengecekan limit:

```ts
import { getSession } from "@/lib/authHelper"
import { DEMO_SCAN_LIMIT, DEMO_RECEIPT_LIMIT } from "@/lib/demoTenant"

// ...setelah OCR berhasil dapat hasil terstruktur (payloadObj)...

const session = await getSession(req)

if (session?.role === "DEMO") {
  const tenantRes = await queryPg<{ demoScanCount: number }>(
    `SELECT "demoScanCount" FROM tenants WHERE id = $1`,
    [session.tenantId]
  )
  const currentScans = tenantRes.rows?.[0]?.demoScanCount || 0

  if (currentScans >= DEMO_SCAN_LIMIT) {
    return NextResponse.json(
      { error: "Kuota scan demo hari ini sudah habis. Reset otomatis tengah malam, atau mulai Trial 14 hari sekarang untuk scan tanpa batas.", upsell: true },
      { status: 429 }
    )
  }

  const receiptCountRes = await queryPg<{ count: string }>(
    `SELECT COUNT(*) as count FROM receipts WHERE "tenantId" = $1`,
    [session.tenantId]
  )
  if (Number(receiptCountRes.rows?.[0]?.count || 0) >= DEMO_RECEIPT_LIMIT) {
    return NextResponse.json(
      { error: "Batas maksimal 3 nota untuk akun demo tercapai. Lanjut Trial 14 hari untuk nota tanpa batas.", upsell: true },
      { status: 429 }
    )
  }

  // Simpan hasil scan sebagai receipt baru untuk tenant demo ini
  await queryPg(
    `INSERT INTO receipts ("tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Lunas', NOW(), NOW())`,
    [session.tenantId, payloadObj.merchantName, payloadObj.date, payloadObj.imageUrl, payloadObj.subtotal, payloadObj.discountAmount, payloadObj.taxAmount, payloadObj.totalAmount, payloadObj.paymentMethod]
  )

  await queryPg(`UPDATE tenants SET "demoScanCount" = "demoScanCount" + 1 WHERE id = $1`, [session.tenantId])
}

// Untuk pengguna yang belum pernah demo sama sekali (belum ada session role DEMO):
// tetap kembalikan hasil OCR seperti biasa TANPA menyimpan, lalu frontend yang memicu
// /api/auth/demo-login (Google sign-in) sebelum scan berikutnya bisa masuk dashboard.
```

## 7. Blokir Download untuk Role `DEMO`

**`receipts/export/route.ts`, `backup/route.ts`**:
```ts
if (session.role === "DEMO") {
  return NextResponse.json(
    { error: "Fitur download hanya tersedia untuk akun Trial atau Berbayar.", upsell: true },
    { status: 403 }
  )
}
```

## 8. Cron Cleanup (Tengah Malam)

**`scripts/cleanup-demo-tenants.js`** (baru):
```js
const { Pool } = require("pg")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function cleanup() {
  const res = await pool.query(
    `DELETE FROM tenants WHERE "isDemo" = true AND "expiresAt" <= NOW() RETURNING id`
  )
  console.log(`Cleanup: ${res.rowCount} tenant demo dihapus.`)
  await pool.end()
}

cleanup().catch((e) => { console.error(e); process.exit(1) })
```

Jadwalkan lewat PM2 (`ecosystem.config.cjs`, kalau mendukung cron restart) atau lebih simpel pakai **GitHub Actions terjadwal**:
```yaml
# .github/workflows/cleanup-demo.yml
on:
  schedule:
    - cron: "5 17 * * *"  # 00:05 WIB (UTC+7) = 17:05 UTC hari sebelumnya
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/cleanup-demo-tenants.js
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## 9. Trial "Data Lengkap" — Pre-fill dari Google

Kalau pengguna demo klik "Lanjut Trial 14 Hari", kirim `email`/`name` yang sudah ada dari sesi demo ke form trial supaya bisa di-*pre-fill*:

```ts
// src/app/api/auth/register/route.ts -- tambahkan field wajib baru
const { username, password, fullName, businessName, phone, email } = await req.json()

const cleanEmail = (email || "").trim().toLowerCase()
if (!cleanEmail || !cleanEmail.includes("@")) {
  return NextResponse.json({ error: "Email wajib diisi dengan format yang valid" }, { status: 400 })
}
if (!cleanFullName || !cleanBusinessName || !cleanPhone) {
  return NextResponse.json({ error: "Nama lengkap, nama usaha, dan nomor HP wajib diisi" }, { status: 400 })
}

// Verifikasi nomor HP via OTP WhatsApp (reuse whatsappOtp.ts yang sudah ada)
// sebelum tenant trial benar-benar diaktifkan -- pola sama seperti forgot-password.
```

Tenant trial yang dibuat **baru**, bukan mengubah tenant demo yang ada menjadi permanen — supaya alur `isDemo`/`expiresAt` tetap sederhana dan tidak ada tenant "setengah demo setengah permanen" yang bikin bingung logic pembersihan cron.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `database/schema.sql` | Kolom baru di `tenants` (`isDemo`, `demoGoogleId`, `demoEmail`, `demoScanCount`, `expiresAt`) & `admin_accounts` (`email`) |
| `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts` | **Baru** — konfigurasi Auth.js + Google provider |
| `src/lib/demoTenant.ts` | **Baru** — auto-provision tenant demo, terbitkan sesi Scota |
| `src/app/api/auth/demo-login/route.ts` | **Baru** — jembatan sesi Auth.js → sesi Scota |
| `src/lib/session.ts` | `SessionPayload.role` tambah `"DEMO"` |
| `src/app/api/parse-receipt/route.ts` | Simpan hasil scan ke tenant demo + cek limit 2x scan & 3 nota |
| `src/app/api/receipts/export/route.ts`, `backup/route.ts` | Tolak akses untuk `role === "DEMO"` |
| `src/app/api/auth/register/route.ts` | Wajibkan `email`, `fullName`, `businessName`, `phone` (verifikasi OTP) |
| `scripts/cleanup-demo-tenants.js` + jadwal cron | **Baru** — hapus tenant demo yang sudah lewat tengah malam |
| `.env.local` | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` |
| `middleware.ts` | `/api/auth/demo-login` & `/api/auth/[...nextauth]` ditambahkan ke `PUBLIC_API_ROUTES` (dua-duanya memang harus bisa diakses sebelum sesi Scota ada) |

## Catatan Penting

- `AUTH_SECRET` (dipakai Auth.js) sengaja **dibuat terpisah** dari `SESSION_SECRET` (dipakai `session.ts`) — dua sistem berbeda, tidak perlu berbagi secret yang sama.
- Karena identitas sekarang berbasis akun Google (bukan IP), semua risiko yang dibahas sebelumnya (rotasi IPv6, shared-IP, abuse biaya Gemini lewat ganti-ganti IP) otomatis jauh berkurang — bikin banyak akun Google asli jauh lebih mahal/susah daripada ganti IP.
- Role `"DEMO"` **tidak pernah** boleh lolos `requireSuperadmin` — pastikan `isSuperadminUser()` selalu return `false` untuk username sintetik `demo_*` (aman by default karena lookup-nya ke tabel `admin_accounts` yang memang tidak pernah punya baris untuk user demo).

## Checklist Verifikasi

- [ ] Klik "Coba Scan Gratis" di landing → redirect ke Google sign-in → berhasil → masuk dashboard demo dengan banner jelas
- [ ] Scan ke-1 & ke-2 berhasil, nota masuk ke tenant yang sama (cek `tenantId` konsisten)
- [ ] Scan ke-3 ditolak dengan pesan upsell, bukan error generik
- [ ] Coba tambah nota manual (bukan lewat scan) sampai lewat 3 → ditolak
- [ ] Klik download (xlsx/PDF/backup) sebagai demo → `403` dengan pesan upsell, bukan file kosong
- [ ] Login Google dengan akun yang SAMA dari IP berbeda → tetap masuk ke tenant demo yang sama (karena kuncinya `googleId`, bukan IP lagi)
- [ ] Login Google dengan akun BERBEDA → dapat tenant demo baru yang terpisah total
- [ ] Klik "Lanjut Trial 14 Hari" → form ter-pre-fill nama/email dari Google, minta lengkapi sisanya + verifikasi OTP HP
- [ ] Setelah lewat tengah malam, cron jalan → tenant demo & semua nota/kategori turunannya hilang total dari database
- [ ] Coba akses dashboard demo pakai cookie sesi lama setelah tenant-nya dihapus cron → `401`, diarahkan ke landing lagi

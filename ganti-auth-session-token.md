# Ganti Auth ke Session Token yang Benar

## Masalah Saat Ini

Ada 2 masalah yang saling berkaitan, dan keduanya lebih parah dari sekadar "token lemah":

### 1. Token bukan token — cuma base64 dari data mentah

Di `src/app/api/auth/login/route.ts`:

```ts
const tokenPayload = Buffer.from(
  `${authenticatedUser}:${cleanPassword}:${userRole}:${finalStaffName}:nota_session_secret`
).toString("base64")
```

Ini **bukan tanda tangan kriptografis** — cuma encoding, bukan enkripsi/signing. Siapa pun bisa:
- **Decode** token dan langsung dapat password asli user itu (base64 dua arah, bukan hash).
- **Bikin token baru** dengan isi bebas (`base64("rama:apapun:ADMIN::nota_session_secret")`) karena string `"nota_session_secret"` di situ statis dan publik (ada di source code), bukan secret yang hanya diketahui server.

Pola yang sama (dan sama rentannya) dipakai ulang di `change-password/route.ts` dan diverifikasi ulang di `session/route.ts`.

### 2. Server mempercayai header dari client, bukan dari token

Yang lebih parah: `authHelper.ts` — file yang dipakai di **semua** route (`receipts`, `approvals`, `notifications`) — tidak selalu mem-verifikasi token sama sekali:

```ts
export function getAdminUserFromRequest(req: NextRequest): string {
  let user = ""
  const customUserHeader = req.headers.get("x-admin-user")
  if (customUserHeader && customUserHeader.trim()) {
    user = customUserHeader.trim().toLowerCase()   // <- langsung dipakai, tanpa verifikasi
  } else {
    // baru fallback ke cookie/token
  }
  ...
}
```

Dan di frontend, `src/lib/authClient.ts` **memang mengirim header itu** langsung dari `localStorage`:

```ts
if (user) headers["x-admin-user"] = user
if (role) headers["x-admin-role"] = role
```

Artinya siapa pun yang buka DevTools, jalankan:
```js
localStorage.setItem("nota_admin_user", "rama")
localStorage.setItem("nota_admin_role", "ADMIN")
```
lalu refresh halaman — langsung dianggap admin `rama` oleh backend, **tanpa perlu tahu password sama sekali**. Ini akar masalah dari hampir semua celah privilege escalation yang ditemukan sebelumnya.

## Solusi

Ganti total mekanismenya dengan **JWT yang ditandatangani server** (bukan base64 biasa), disimpan **hanya** di cookie `httpOnly`, dan **hapus total** ketergantungan pada header `x-admin-user` / `x-admin-role` yang dikirim client.

### 1. Install library JWT

```bash
npm install jose
```

(`jose` dipilih karena kompatibel dengan Next.js Edge Runtime, tidak seperti `jsonwebtoken`.)

### 2. Tambahkan secret di environment

`.env.local` dan `.env.example`:
```
SESSION_SECRET=<generate dengan: openssl rand -base64 48>
```

Secret ini **tidak boleh** hardcoded seperti kasus `pgDb.ts` sebelumnya — wajib dari env, dan wajib beda antara dev/staging/production.

### 3. Buat helper terpusat: `src/lib/session.ts`

```ts
import { SignJWT, jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET belum diset di environment variables")
}

export interface SessionPayload {
  username: string
  role: "ADMIN" | "KARYAWAN" | "SUPERADMIN"
  staffName?: string
}

/** Membuat token yang ditandatangani server. TIDAK menyimpan password di dalamnya. */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET)
}

/** Memverifikasi tanda tangan & masa berlaku token. Return null kalau tidak valid/dipalsukan. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null // signature tidak cocok, expired, atau format salah
  }
}
```

Poin penting: payload **tidak lagi memuat password**. Karena token sudah ditandatangani, server tidak perlu menyimpan password di token untuk "membuktikan" keaslian—tanda tangan itulah buktinya.

### 4. Update `src/app/api/auth/login/route.ts`

```ts
import { createSessionToken } from "@/lib/session"

// ...setelah account.password !== cleanPassword dicek (lolos):

const tokenPayload = await createSessionToken({
  username: authenticatedUser,
  role: userRole as "ADMIN" | "KARYAWAN",
  staffName: finalStaffName,
})

const response = NextResponse.json({
  success: true,
  message: `Login Admin (${authenticatedUser}) berhasil`,
  user: { username: authenticatedUser, role: userRole, staffName: finalStaffName },
  // token TIDAK dikembalikan ke body/JSON lagi — cukup lewat cookie httpOnly
})

response.cookies.set({
  name: "nota_admin_session",
  value: tokenPayload,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
})

return response
```

Perubahan penting: token **tidak lagi dikirim di body JSON**. Kalau token ada di body, frontend cenderung menyimpannya di `localStorage` (rentan dicuri lewat XSS). Cukup andalkan cookie `httpOnly` — browser otomatis mengirimkannya, dan JavaScript di halaman tidak bisa membacanya sama sekali.

### 5. Update `src/lib/authHelper.ts` — hapus total kepercayaan pada header

```ts
import { NextRequest } from "next/server"
import { verifySessionToken } from "@/lib/session"

export async function getSession(req: NextRequest) {
  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  if (!sessionCookie) return null

  return verifySessionToken(sessionCookie) // null kalau tidak valid/dipalsukan
}
```

**Hapus** fungsi `getAdminUserFromRequest`, `getAdminRoleFromRequest`, `getStaffNameFromRequest` yang lama — termasuk seluruh logic yang membaca `x-admin-user`, `x-admin-role`, `x-staff-name` dari header. Semua route yang sebelumnya memanggil fungsi-fungsi itu harus diubah untuk memanggil `getSession(req)` dan menolak request kalau hasilnya `null`:

```ts
// contoh di src/app/api/receipts/route.ts
const session = await getSession(req)
if (!session) {
  return NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 })
}
const { username: adminUser, role: userRole, staffName: reqStaffName } = session
```

Ini perlu diterapkan di semua file yang tadinya import dari `authHelper`: `approvals/route.ts`, `approvals/[id]/approve/route.ts`, `approvals/[id]/reject/route.ts`, `notifications/route.ts`, `receipts/route.ts`, `receipts/[id]/route.ts`.

### 6. Update `src/lib/superadminGuard.ts` (dari dokumen sebelumnya)

Sekarang bisa disederhanakan — tidak perlu lagi memverifikasi ulang password ke database di setiap request, karena tanda tangan JWT sudah cukup membuktikan keaslian sesi:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { isSuperadminUser } from "@/lib/superadmin"

export async function requireSuperadmin(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: "Akses ditolak. Silakan login." }, { status: 401 }) }
  }

  const isSuperadmin = await isSuperadminUser(session.username)
  if (!isSuperadmin) {
    return { ok: false as const, response: NextResponse.json({ error: "Memerlukan hak akses Superadmin." }, { status: 403 }) }
  }

  return { ok: true as const, username: session.username }
}
```

### 7. Update `src/app/api/auth/session/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, user: session })
}
```

### 8. Update `src/app/api/auth/change-password/route.ts`

Ganti pembuatan token base64 di akhir file dengan `createSessionToken`, sama seperti di langkah 4 — dan jangan kembalikan token di body JSON.

### 9. Update frontend — `src/lib/authClient.ts`

Hapus seluruhnya. Karena auth sekarang murni lewat cookie `httpOnly`, request cukup memakai `fetch(url, { credentials: "include" })` (default-nya sudah include untuk same-origin di Next.js), tanpa perlu menyusun header `Authorization`/`x-admin-user`/`x-admin-role` manual dari `localStorage`. Cari semua pemanggilan `getAuthHeaders()` di komponen frontend dan hapus — cukup pastikan `Content-Type: application/json` saja yang tersisa untuk request `POST`/`PUT`/`PATCH`.

Juga hapus semua `localStorage.setItem("nota_admin_user", ...)`, `localStorage.setItem("nota_admin_role", ...)`, dan `localStorage.setItem("nota_admin_token", ...)` di halaman login/logout — data role/identitas cukup diambil dari `/api/auth/session` saat dibutuhkan di UI, bukan disimpan mentah-mentah di client.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/lib/session.ts` | **Baru** — buat & verifikasi JWT |
| `src/lib/authHelper.ts` | Ganti total: hapus trust-header, hanya baca cookie via `getSession` |
| `src/lib/superadminGuard.ts` | Sederhanakan, pakai `getSession` |
| `src/app/api/auth/login/route.ts` | Pakai `createSessionToken`, jangan kirim token di body |
| `src/app/api/auth/session/route.ts` | Pakai `getSession`, hapus decode manual |
| `src/app/api/auth/change-password/route.ts` | Pakai `createSessionToken` |
| `src/app/api/receipts/route.ts`, `receipts/[id]/route.ts`, `approvals/**`, `notifications/route.ts` | Ganti pemanggilan `getAdminUserFromRequest`/dll menjadi `getSession(req)` + cek `null` |
| `src/lib/authClient.ts` | Hapus, ganti semua pemanggilannya di komponen frontend |
| `.env.local`, `.env.example` | Tambah `SESSION_SECRET` |

## Catatan Penting

- Ini **tidak menggantikan** perbaikan hashing password (`bcrypt`) — keduanya saling melengkapi. Token yang ditandatangani mencegah pemalsuan *sesi*; hashing password melindungi kredensial kalau database bocor. Login tetap membandingkan password ke DB seperti sekarang, hanya *hasil* login-nya yang berubah dari base64 jadi JWT.
- Karena format token berubah total, **semua user yang sedang login akan ter-logout** setelah deploy — ini normal dan diharapkan (cookie lama `nota_admin_session` tidak lagi valid untuk `verifySessionToken`).

## Checklist Verifikasi

- [ ] Login normal (`rama`/`refo`/`karyawan`) tetap berhasil dan cookie baru berformat JWT (3 bagian dipisah titik, bukan base64 tunggal)
- [ ] `localStorage.setItem("nota_admin_user", "rama")` lalu refresh & panggil API — **harus tetap gagal/401**, karena header `x-admin-user` sudah tidak dibaca sama sekali
- [ ] Ubah 1 karakter di cookie session lalu panggil API apa saja → harus `401` (signature invalid)
- [ ] Endpoint superadmin tetap `403` untuk user non-superadmin yang sudah login sah
- [ ] Setelah `logout`, cookie ter-clear dan `/api/auth/session` mengembalikan `authenticated: false`
- [ ] Decode isi JWT (mis. di jwt.io) — pastikan **tidak ada field password** di payload

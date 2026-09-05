# Keamanan Halaman `/superadmin`

## Masalah Saat Ini

`src/app/superadmin/layout.tsx` (dipakai semua halaman di bawah `/superadmin/*`: `tenants`, `billing`, `audit-log`, `plans`, `ai-settings`, `receipts`) adalah **client component tanpa pengecekan otentikasi sama sekali**:

```tsx
"use client"

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 ...">
      <SuperadminSidebar />
      ...
      <main>{children}</main>
    </div>
  )
}
```

Siapa pun yang mengetik `/superadmin` di address bar — tanpa login sama sekali — langsung melihat **seluruh kerangka dashboard superadmin**: sidebar dengan daftar menu (Tenants, Billing, Audit Log, Plans, AI Settings, Receipts), topbar, layout lengkap. Memang data sungguhan di dalamnya tidak ikut bocor (endpoint API-nya sudah dilindungi `requireSuperadmin` sejak perbaikan sebelumnya, jadi fetch data akan gagal `401`), tapi ini tetap masalah:

1. **Membocorkan struktur internal** — orang luar jadi tahu persis fitur apa saja yang ada di panel superadmin (nama menu, kemungkinan format URL tiap sub-halaman) tanpa perlu autentikasi apa pun.
2. **Pengalaman yang salah** — panel admin semestinya tidak pernah terlihat sama sekali oleh pengunjung biasa, bukan cuma "datanya kosong karena gagal fetch". Tampilan kosong/error di panel admin publik juga terkesan tidak profesional dan memberi sinyal ke calon penyerang bahwa halaman ini layak dicoba lebih lanjut.
3. Kalau ada bug di masa depan pada salah satu halaman yang sempat menampilkan sebagian data sebelum fetch API gagal (misalnya render awal pakai data dummy/placeholder yang kebetulan menyebutkan sesuatu yang sensitif), itu jadi ikut terekspos ke siapa saja.

## Solusi

Proteksi paling tepat ada di **middleware**, bukan di `layout.tsx` — karena middleware jalan sebelum satu byte HTML pun dikirim ke browser, sementara client component baru "melindungi diri" setelah halaman sudah ter-render duluan.

### 1. Perluas `middleware.ts` yang sudah ada untuk mencakup halaman `/superadmin/**`

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session"

const PUBLIC_API_ROUTES = [
  "/api/ping",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/parse-receipt",
  "/api/quota",
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- Bagian 1: proteksi API (sudah ada sebelumnya, tidak berubah) ---
  if (pathname.startsWith("/api/")) {
    const isPublic = PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))
    if (isPublic) return NextResponse.next()

    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }
    const session = await verifySessionToken(sessionCookie)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa." }, { status: 401 })
    }
    return NextResponse.next()
  }

  // --- Bagian 2: BARU -- proteksi halaman /superadmin/** ---
  if (pathname.startsWith("/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value

    if (!sessionCookie) {
      // Belum login sama sekali -> arahkan ke halaman login
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const session = await verifySessionToken(sessionCookie)

    if (!session || session.role !== "SUPERADMIN") {
      // Sudah login TAPI bukan superadmin -> arahkan ke halaman utama,
      // BUKAN ke halaman "403 Forbidden" -- supaya tidak mengonfirmasi
      // ke pengguna biasa bahwa panel ini memang ada dan mereka "ditolak".
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*", "/superadmin/:path*"],
}
```

Perubahan kunci dari `matcher` sebelumnya (`"/api/:path*"` saja) jadi array yang juga mencakup `"/superadmin/:path*"` — sekarang middleware jalan untuk kedua jenis route.

### 2. Kenapa cek `session.role !== "SUPERADMIN"` di sini cukup, tanpa perlu query database

`middleware.ts` jalan di **Edge Runtime**, yang tidak mendukung koneksi TCP langsung ke Postgres (`pg` butuh Node.js runtime penuh). Karena itu middleware **tidak bisa** memanggil `isSuperadminUser()` yang ada di `superadminGuard.ts` (fungsi itu melakukan query DB, dipanggil dari route handler API yang jalan di Node.js runtime biasa).

Solusinya: middleware cukup percaya `role` yang **sudah tertanam di dalam JWT** saat login (`session.role`) — ini valid karena token sudah ditandatangani server (tidak bisa dipalsukan client) dan `role` memang diisi saat `createSessionToken` dipanggil di `login/route.ts`. Ini persis pola cek cepat yang sudah dipakai lebih dulu di `superadminGuard.ts`:
```ts
const isSuperadmin = session.role === "SUPERADMIN" || (await isSuperadminUser(session.username))
```

### 3. Catatan penting — satu celah kecil yang perlu diperhatikan

`superadminGuard.ts` (dipakai di route API) punya **fallback tambahan**: kalau `session.role` bukan `"SUPERADMIN"`, dia masih cek ulang ke database lewat `isSuperadminUser()` — yang punya logic khusus untuk username yang cocok dengan env var `SUPERADMIN_USERNAME` meski role di DB-nya bukan `SUPERADMIN` secara eksplisit. Middleware di halaman **tidak bisa melakukan fallback ini** (keterbatasan Edge Runtime tadi).

**Dampaknya**: kalau ada akun yang jadi superadmin murni lewat pencocokan `SUPERADMIN_USERNAME` env var (bukan karena kolom `role` di `admin_accounts` sungguhan berisi `"SUPERADMIN"`), akun itu akan **berhasil lolos di API** (lewat `superadminGuard.ts` yang masih query DB) tapi **ditolak masuk ke halaman UI-nya** (lewat middleware yang cuma baca token). Ini bukan celah keamanan (arahnya "terlalu ketat", bukan "kurang ketat"), tapi bisa bikin bingung kalau ada akun begitu.

**Solusinya**: pastikan setiap akun yang seharusnya jadi superadmin punya kolom `role = 'SUPERADMIN'` secara eksplisit di tabel `admin_accounts`, bukan cuma mengandalkan pencocokan env var:
```sql
UPDATE admin_accounts SET role = 'SUPERADMIN' WHERE username = '<username-superadmin-asli>';
```
Setelah ini, kedua lapis proteksi (middleware halaman & `superadminGuard` API) akan selalu konsisten satu sama lain.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/middleware.ts` | Tambah blok proteksi `/superadmin/**`, `matcher` jadi array 2 pola |
| `admin_accounts` (data) | Pastikan akun superadmin sungguhan punya `role = 'SUPERADMIN'` eksplisit, bukan cuma andalkan `SUPERADMIN_USERNAME` env var |

## Catatan Penting

- `layout.tsx` di `/superadmin` **tidak perlu diubah** — proteksinya cukup di middleware, karena middleware jalan sebelum halaman apa pun (termasuk layout-nya) sempat di-render sama sekali.
- Ini melengkapi (bukan menggantikan) proteksi API yang sudah ada (`requireSuperadmin`) — sekarang ada 2 lapis: middleware mencegah halaman ter-render sama sekali untuk yang tidak berhak, dan `requireSuperadmin` tetap menjaga API kalau-kalau ada yang mengakses endpoint API-nya langsung (bukan lewat halaman).

## Checklist Verifikasi

- [ ] Buka `/superadmin` di browser tanpa login sama sekali (mode incognito) → langsung redirect ke `/login`, tidak sempat melihat sidebar/layout apa pun
- [ ] Login sebagai akun biasa (`ADMIN`/`KARYAWAN`, bukan superadmin) → buka `/superadmin` → redirect ke `/`, tidak ada pesan "forbidden" yang mengonfirmasi panel ini ada
- [ ] Login sebagai superadmin sungguhan → `/superadmin` dan semua sub-halamannya (`/superadmin/tenants`, `/superadmin/billing`, dll) bisa diakses normal
- [ ] Coba akses langsung `/superadmin/tenants` (bukan cuma root `/superadmin`) tanpa login → tetap redirect ke `/login` (memastikan `matcher` benar-benar mencakup semua sub-path)
- [ ] Cek tabel `admin_accounts` — akun superadmin sungguhan punya `role = 'SUPERADMIN'` tertulis eksplisit, bukan cuma cocok dengan env var

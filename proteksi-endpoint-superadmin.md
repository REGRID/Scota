# Proteksi Semua Endpoint Superadmin

## Masalah Saat Ini

Ada 3 route API superadmin, dan hanya 1 yang punya pengecekan akses (itu pun lemah):

| Endpoint | File | Status Proteksi |
|---|---|---|
| `GET/POST/PUT /api/superadmin/tenants` | `src/app/api/superadmin/tenants/route.ts` | ❌ Tidak ada sama sekali |
| `GET /api/superadmin/tenants/[tenantId]` | `src/app/api/superadmin/tenants/[tenantId]/route.ts` | ❌ Tidak ada sama sekali |
| `GET /api/superadmin/stats` | `src/app/api/superadmin/stats/route.ts` | ⚠️ Ada, tapi hanya aktif kalau `NODE_ENV === "production"`, dan username diambil dari token base64 yang **tidak ditandatangani** (bisa dipalsukan siapa saja) |

Dampak nyata dari kondisi ini:

- Siapa pun yang tahu URL `/api/superadmin/tenants` bisa **melihat semua tenant** (username, tier, nomor telepon, dll) tanpa login.
- Siapa pun bisa **PUT** ke endpoint yang sama untuk: ganti tier tenant manapun ke Enterprise, suspend akun, atau **reset password admin manapun** — tanpa autentikasi apa pun.
- Bahkan endpoint `stats` yang "sudah diproteksi" tetap bisa ditembus, karena tokennya cuma `base64("username:password:role:...")` — siapa pun bisa bikin token palsu dengan `username: "rama"` tanpa tahu passwordnya, lalu decode-check di kode ini tidak memverifikasi keasliannya.

## Solusi

### 1. Buat helper terpusat: `requireSuperadmin`

File baru: `src/lib/superadminGuard.ts`

```ts
import { NextRequest, NextResponse } from "next/server"
import { isSuperadminUser } from "@/lib/superadmin"
import { validateAdminCredentials } from "@/lib/adminAccounts"

/**
 * Memverifikasi bahwa request berasal dari user yang BENAR-BENAR
 * terautentikasi (bukan cuma decode base64) DAN punya hak Superadmin.
 *
 * Catatan: ini masih bergantung pada `validateAdminCredentials` yang
 * mengecek ulang password ke DB/env — bukan sekadar mempercayai isi
 * token. Ini penting selama token session belum di-upgrade ke JWT
 * bertanda tangan (lihat poin "Ganti auth ke session token yang benar").
 */
export async function requireSuperadmin(
  req: NextRequest
): Promise<{ ok: true; username: string } | { ok: false; response: NextResponse }> {
  const authHeader = req.headers.get("authorization") || ""
  const sessionCookie = req.cookies.get("nota_admin_session")?.value || ""
  const token = authHeader.replace("Bearer ", "") || sessionCookie

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Akses ditolak. Silakan login." }, { status: 401 }),
    }
  }

  let username = ""
  let password = ""
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const parts = decoded.split(":")
    username = (parts[0] || "").trim().toLowerCase()
    password = (parts[1] || "").trim()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Token tidak valid." }, { status: 401 }),
    }
  }

  // Verifikasi ulang password ke sumber data asli — jangan percaya isi token mentah-mentah.
  const isValidCredential = await validateAdminCredentials(username, password)
  if (!isValidCredential) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa." }, { status: 401 }),
    }
  }

  const isSuperadmin = await isSuperadminUser(username)
  if (!isSuperadmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak. Memerlukan hak akses Superadmin." },
        { status: 403 }
      ),
    }
  }

  return { ok: true, username }
}
```

### 2. Terapkan di setiap route superadmin

**`src/app/api/superadmin/tenants/route.ts`** — tambahkan guard di awal `GET`, `POST`, dan `PUT`:

```ts
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  // ...kode existing tetap sama
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  // ...kode existing tetap sama
}

export async function PUT(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  // ...kode existing tetap sama
  // (khusus action "reset_password", tambahkan juga recordAuditLog dengan auth.username
  //  sebagai pelaku, bukan string statis "Superadmin")
}
```

**`src/app/api/superadmin/tenants/[tenantId]/route.ts`**:

```ts
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  // ...kode existing tetap sama
}
```

**`src/app/api/superadmin/stats/route.ts`** — ganti logic manual yang ada dengan helper yang sama (hilangkan pengecualian `NODE_ENV`, karena di local dev pun sebaiknya tetap diuji dengan login sungguhan):

```ts
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  const stats = await getSuperadminPlatformStats()
  return NextResponse.json({ success: true, stats })
}
```

### 3. Audit log pakai identitas asli

Di `superadmin.ts`, beberapa aksi (`updateTenantSubscription`, `toggleTenantStatus`, `createTenantManual`) mencatat `superadmin: "Superadmin"` sebagai string statis. Setelah guard di atas terpasang, ganti jadi `auth.username` yang dikirim dari route handler, supaya audit log benar-benar bisa melacak siapa yang melakukan perubahan.

## Batasan Solusi Ini (Penting)

Guard di atas **mitigasi cepat**, bukan solusi akhir. Ia tetap bergantung pada `validateAdminCredentials`, yang membandingkan password **plaintext**, dan token sesi yang formatnya masih base64 biasa (bisa dibaca isinya oleh siapa saja, walau tidak bisa dipalsukan lagi karena sekarang password-nya diverifikasi ulang ke DB).

Untuk benar-benar aman, ini tetap harus digabung dengan dua perbaikan lain dari checklist sebelumnya:
- **Ganti auth ke session token yang benar** (JWT bertanda tangan / server-side session) — supaya password tidak perlu ikut disimpan di cookie sama sekali.
- **Hash semua password** — supaya `validateAdminCredentials` tidak membandingkan plaintext.

## Checklist Verifikasi Setelah Implementasi

- [ ] `curl -X GET https://<domain>/api/superadmin/tenants` tanpa cookie/header → harus `401`
- [ ] `curl -X PUT ... -H "Authorization: Bearer <token-palsu>"` → harus `401`
- [ ] Login sebagai user non-superadmin (mis. `karyawan`), coba akses endpoint superadmin → harus `403`
- [ ] Login sebagai `rama`/`refo` → endpoint berhasil diakses seperti biasa
- [ ] Cek `superadmin_audit_logs.json` mencatat username asli, bukan `"Superadmin"` generik

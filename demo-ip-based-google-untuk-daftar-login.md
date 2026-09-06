# Perubahan Arah: Demo Tanpa Google, Google Auth untuk Daftar & Login

## Ringkasan Perubahan dari Rencana Sebelumnya

| Bagian | Rencana Sebelumnya | Rencana Baru (ini) |
|---|---|---|
| **Demo** | Wajib Google Sign-In dulu, identitas = `googleId` | **Tanpa login sama sekali**, identitas = alamat IP (kembali ke rencana paling awal) |
| **Daftar (Register)** | Form biasa saja | Form biasa **+ opsi "Daftar dengan Google"** |
| **Login** | Password saja | Password **+ opsi "Login dengan Google"** |

Kabar baiknya: infrastruktur Auth.js (`src/auth.ts`, Google provider, `middleware.ts` yang sudah mengizinkan path `/api/auth/signin`, `/callback`, `/csrf`, `/providers`, `/error`) **tidak perlu dibongkar** — tinggal dipakai ulang untuk keperluan daftar & login, bukan demo. Yang berubah cuma *ke mana* hasil login Google itu diarahkan.

---

## Bagian 1 — Kembalikan Demo ke Basis IP (Tanpa Google)

### Skema

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "demoIpAddress" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_demo_ip_idx ON tenants ("demoIpAddress") WHERE "isDemo" = true;
```

Kolom `demoGoogleId`/`demoEmail` yang sudah ada **dibiarkan saja** (tidak perlu drop, tidak dipakai lagi untuk demo) — supaya migrasi lebih sederhana dan tidak berisiko merusak data yang mungkin sudah ada.

### `src/lib/demoTenant.ts` — ganti kunci dari `googleId` ke IP

```ts
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export const DEMO_SCAN_LIMIT = 2
export const DEMO_RECEIPT_LIMIT = 3

export function nextMidnight(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Cari tenant demo aktif milik alamat IP ini (belum expired).
 * Kalau tidak ada, buat baru dengan expiresAt = tengah malam nanti.
 */
export async function getOrCreateDemoTenant(ipAddress: string) {
  if (!isDatabaseConfigured) {
    throw new Error("Database PostgreSQL tidak terkonfigurasi")
  }

  const cleanIp = (ipAddress || "unknown").trim()

  const existing = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `SELECT id, "expiresAt", "demoScanCount" FROM tenants
     WHERE "demoIpAddress" = $1 AND "isDemo" = true AND "expiresAt" > NOW()
     LIMIT 1`,
    [cleanIp]
  )

  if (existing.rows?.[0]) {
    return existing.rows[0]
  }

  const created = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `INSERT INTO tenants ("businessName", "isDemo", "demoIpAddress", "expiresAt", "demoScanCount", status, "createdAt", "updatedAt")
     VALUES ($1, true, $2, $3, 0, 'active', NOW(), NOW())
     RETURNING id, "expiresAt", "demoScanCount"`,
    [`Demo - ${cleanIp}`, cleanIp, nextMidnight().toISOString()]
  )

  if (!created.rows?.[0]) {
    throw new Error("Gagal membuat entitas tenant demo baru di database")
  }

  return created.rows[0]
}
```

### `parse-receipt/route.ts` — panggil dengan IP, bukan profil Google

```ts
// SEBELUM (butuh sesi Auth.js dulu untuk dapat googleId)
const authSession = await auth()
const tenant = await getOrCreateDemoTenant(googleId, email, name)

// SESUDAH -- langsung dari IP, tidak butuh login apa pun
const cleanIp = normalizeIp(req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown")
const tenant = await getOrCreateDemoTenant(cleanIp)
```

Sisa logic (cek `DEMO_SCAN_LIMIT`, `DEMO_RECEIPT_LIMIT`, simpan hasil scan sebagai receipt, terbitkan cookie sesi lewat `issueDemoSession`) **tidak berubah** — cuma sumber identitasnya yang beda.

### Hapus/nonaktifkan halaman yang tidak relevan lagi

- `src/app/demo/masuk/page.tsx`, `src/app/demo/callback/page.tsx` — ini dibuat khusus untuk alur "Google dulu baru demo". Karena demo sekarang tanpa login, halaman perantara ini **tidak diperlukan lagi**. Alih-alih dihapus, bisa **dipakai ulang** untuk alur "Daftar/Login dengan Google" di Bagian 2 & 3 (tinggal ganti isi & tujuan redirect-nya) — supaya kerja yang sudah dilakukan tidak terbuang percuma.
- `src/app/api/auth/demo-login/route.ts` — logic-nya (jembatan sesi Auth.js → sesi Scota) **tetap dipakai**, tapi dipindah fungsinya jadi jembatan untuk daftar/login (lihat Bagian 2 & 3), bukan lagi untuk demo.

### Catatan jujur — konsekuensi kembali ke basis IP

Ini menghidupkan lagi risiko yang sempat kita bahas waktu masih pakai IP dulu: rotasi IPv6 bisa dipakai untuk dapat kuota baru berkali-kali, dan pengguna sah di jaringan berbagi (kantor/WiFi publik/CGNAT seluler) bisa ikut kena limit gara-gara orang lain di jaringan yang sama. Kalau nanti risiko ini mulai terasa di data pemakaian nyata, mitigasi paling murah tetap yang sudah dibahas dulu: bulatkan IPv6 ke subnet `/64` di `normalizeIp()`.

---

## Bagian 2 — Daftar dengan Opsi Google

### Alur

1. Halaman `/register` (form biasa) sekarang punya tombol tambahan **"Daftar dengan Google"** di atas/bawah form.
2. Klik tombol → Auth.js redirect ke Google → user approve → kembali ke halaman internal (reuse `src/app/demo/callback/page.tsx`, ganti isinya).
3. Halaman callback ambil profil Google (nama, email) dari sesi Auth.js, lalu **redirect ke `/register?fromGoogle=true`** dengan nama & email sudah terisi otomatis di form — sisanya (nama usaha, nomor HP) tetap wajib diisi manual + verifikasi OTP WhatsApp seperti biasa.
4. Submit form → `register/route.ts` membuat tenant + `admin_accounts` baru, dengan `googleId` tersimpan (supaya nanti bisa dipakai login via Google).

### Skema — tambahkan `googleId` ke `admin_accounts`

```sql
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS "googleId" TEXT UNIQUE;
```

### `register/route.ts` — terima `googleId` opsional

```ts
const { username, password, fullName, businessName, phone, email, googleId } = await req.json()

// Kalau daftar via Google, `googleId` wajib ada dan `password` boleh dikosongkan
// (akun ini nanti hanya bisa login lewat Google, bukan password).
if (!googleId && (!password || password.length < 8)) {
  return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
}

// Cegah 1 akun Google dipakai daftar dua kali
if (googleId) {
  const existing = await queryPg(`SELECT id FROM admin_accounts WHERE "googleId" = $1`, [googleId])
  if (existing.rows?.[0]) {
    return NextResponse.json({ error: "Akun Google ini sudah pernah didaftarkan. Silakan login." }, { status: 409 })
  }
}

const regResult = await registerAdminAccount({
  username: cleanUsername,
  password: googleId ? null : cleanPassword, // null kalau daftar via Google
  googleId: googleId || null,
  email: cleanEmail,
  fullName: cleanFullName,
  businessName: cleanBusinessName,
  phone: cleanPhone,
  tier: "trial", // tetap dipaksa trial, tidak berubah dari perbaikan sebelumnya
})
```

**Penting — jangan otomatis "gabungkan" ke akun yang sudah ada berdasarkan kecocokan email.** Kalau email dari profil Google kebetulan sama dengan email di akun yang sudah terdaftar lewat password, **tolak dengan pesan jelas** ("Email ini sudah terdaftar, silakan login dengan password Anda"), jangan pernah otomatis menautkan `googleId` ke akun lama itu. Auto-link berdasarkan email berisiko: kalau alamat email di catatan akun lama ternyata sudah tidak dikuasai pemilik asli (kadaluarsa, ditinggal), penautan otomatis bisa dipakai orang lain untuk mengambil alih akun.

---

## Bagian 3 — Login dengan Opsi Google

### Alur

1. Halaman `/login` punya tombol tambahan **"Login dengan Google"** di samping form password.
2. Klik → Auth.js redirect ke Google → approve → kembali ke halaman callback.
3. Callback ambil `googleId` dari profil Google, **cari** (bukan buat baru) di `admin_accounts WHERE "googleId" = $1`.
4. Kalau ketemu → terbitkan sesi Scota (`createSessionToken`) untuk akun itu, redirect ke dashboard.
5. Kalau **tidak ketemu** → jangan buat akun baru secara diam-diam. Tampilkan pesan jelas: *"Akun Google ini belum terdaftar. Silakan daftar dulu."* + tombol ke halaman register.

### `src/app/api/auth/google-login/route.ts` (ganti nama dari `demo-login`, atau buat baru dengan logic serupa)

```ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { queryPg } from "@/lib/pgDb"
import { createSessionToken } from "@/lib/session"

export async function POST() {
  const authSession = await auth()
  if (!authSession?.user) {
    return NextResponse.json({ error: "Login Google gagal atau dibatalkan" }, { status: 401 })
  }

  const googleId = (authSession.user as any).id
  const res = await queryPg<{ username: string; role: string; tenantId: string; fullName: string }>(
    `SELECT username, role, "tenantId", "fullName" FROM admin_accounts WHERE "googleId" = $1`,
    [googleId]
  )

  const account = res.rows?.[0]
  if (!account) {
    // TIDAK membuat akun baru di sini -- login & register harus tetap 2 intent yang terpisah.
    return NextResponse.json(
      { error: "Akun Google ini belum terdaftar.", needsRegister: true },
      { status: 404 }
    )
  }

  const token = await createSessionToken({
    username: account.username,
    role: account.role as any,
    tenantId: account.tenantId,
    fullName: account.fullName,
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: "nota_admin_session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
```

**Kenapa dicari lewat `googleId`, bukan email**: ini kunci keamanannya — `googleId` (`sub` dari Google) cuma bisa terisi di database lewat proses register yang eksplisit (Bagian 2), tidak pernah lewat pencocokan email otomatis. Jadi tidak ada cara bagi siapa pun untuk "login sebagai akun orang lain" hanya karena kebetulan emailnya sama.

---

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `database/schema.sql` | `tenants.demoIpAddress` (baru, ganti peran `demoGoogleId` untuk demo), `admin_accounts.googleId` (baru) |
| `src/lib/demoTenant.ts` | `getOrCreateDemoTenant` kunci berdasarkan IP, bukan `googleId` |
| `src/app/api/parse-receipt/route.ts` | Panggil `getOrCreateDemoTenant(ip)` langsung, tidak perlu `auth()` Auth.js sama sekali untuk demo |
| `src/app/demo/masuk`, `src/app/demo/callback` | Dipakai ulang untuk alur daftar/login Google (isi & redirect diganti), bukan lagi untuk demo |
| `src/app/api/auth/demo-login/route.ts` | Diganti jadi `google-login/route.ts` — cari akun lewat `googleId`, tidak pernah buat tenant demo lagi |
| `src/app/api/auth/register/route.ts` | Terima `googleId`/`email` opsional, cegah duplikasi akun Google, tolak (bukan gabung) kalau email bentrok dengan akun password yang sudah ada |
| Halaman `/register`, `/login` (frontend) | Tambah tombol "Daftar/Login dengan Google" |

## Checklist Verifikasi

- [ ] Coba fitur scan demo tanpa login sama sekali → tetap bisa 2x/hari, tidak ada tombol Google yang muncul di alur ini
- [ ] Klik "Daftar dengan Google" → nama & email ter-*pre-fill*, tetap diminta lengkapi nama usaha + verifikasi HP sebelum akun aktif
- [ ] Daftar dengan Google pakai email yang sudah pernah dipakai akun password → ditolak dengan pesan jelas, tidak digabung otomatis
- [ ] Klik "Login dengan Google" pakai akun yang sudah terdaftar via Google → berhasil masuk dashboard
- [ ] Klik "Login dengan Google" pakai akun Google yang belum pernah daftar → pesan jelas "belum terdaftar", tidak ada akun baru yang diam-diam terbuat
- [ ] Login pakai username/password seperti biasa untuk akun yang daftar via form biasa → tetap berfungsi normal, tidak terganggu perubahan ini

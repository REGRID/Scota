# Rate Limiting di Login, Register, dan Forgot-Password/OTP

## Masalah Saat Ini

Ada satu rate limiter di repo ini (`src/lib/rateLimiter.ts`), tapi khusus untuk kontrol biaya pemanggilan Gemini API di endpoint scan struk (`DAILY_SCAN_LIMIT = 999999` per IP per hari — jendela 24 jam, satu bucket global per IP). Endpoint yang paling butuh proteksi dari percobaan berulang justru **tidak memakainya sama sekali**:

| Endpoint | Risiko tanpa rate limit |
|---|---|
| `POST /api/auth/login` | Brute-force password — sekarang lebih parah karena password sudah bcrypt, tapi *lockout* dari sisi server tetap perlu supaya penyerang tidak bisa mencoba ribuan kombinasi per menit |
| `POST /api/auth/register` | Siapa pun bisa membuat ratusan tenant/akun trial dalam hitungan detik (spam, atau untuk mengelilingi batas kuota trial dengan akun baru terus-menerus) |
| `POST /api/auth/forgot-password` (`action: "request_otp"`) | Tanpa batas, siapa pun bisa memicu pengiriman OTP WhatsApp berkali-kali ke nomor manapun — selain mengganggu pemilik akun, ini juga membebani biaya API WhatsApp gateway |
| `POST /api/auth/forgot-password` (`action: "verify_and_reset"`) | **Paling kritis** — OTP cuma 6 digit numerik, valid 10 menit, dan tidak ada batas percobaan verifikasi. Secara matematis, 1 juta kombinasi dalam 10 menit itu realistis untuk script otomatis tanpa rate limit — artinya siapa pun bisa mengambil alih akun manapun hanya dengan tahu username-nya |

## Solusi

### 1. Buat tabel & modul rate limiter generik (terpisah dari `rateLimiter.ts` yang sudah ada)

`rateLimiter.ts` yang ada sengaja tidak disentuh — perannya beda (kontrol biaya OCR, per-IP, jendela 24 jam, tanpa lockout). Untuk keamanan auth, dibutuhkan karakteristik berbeda: identifier bisa gabungan IP+username, jendela lebih pendek, dan ada *lockout* setelah gagal berkali-kali.

**Tabel baru — tambahkan ke `database/schema.sql`:**

```sql
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,       -- mis. "login:203.0.113.5:rama" atau "otp:081234567890"
    "actionType" TEXT NOT NULL,     -- 'login' | 'register' | 'otp_request' | 'otp_verify'
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "lockedUntil" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (identifier, "actionType")
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_identifier_idx ON public.auth_rate_limits (identifier, "actionType");
```

**Modul baru: `src/lib/authRateLimiter.ts`**

```ts
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export interface AuthRateLimitConfig {
  maxAttempts: number     // jumlah percobaan maksimal dalam satu jendela
  windowMinutes: number   // panjang jendela hitung ulang
  lockoutMinutes: number  // lama diblokir setelah maxAttempts tercapai
}

export interface AuthRateLimitResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: Date | null
}

const CONFIGS: Record<string, AuthRateLimitConfig> = {
  login:       { maxAttempts: 5, windowMinutes: 15, lockoutMinutes: 15 },
  register:    { maxAttempts: 3, windowMinutes: 60, lockoutMinutes: 60 },
  otp_request: { maxAttempts: 3, windowMinutes: 60, lockoutMinutes: 60 },
  otp_verify:  { maxAttempts: 5, windowMinutes: 10, lockoutMinutes: 30 },
}

/**
 * Mengecek apakah identifier+actionType boleh melanjutkan, TANPA menambah hitungan.
 * Panggil ini di awal handler, sebelum memproses request.
 */
export async function checkAuthRateLimit(
  identifier: string,
  actionType: keyof typeof CONFIGS
): Promise<AuthRateLimitResult> {
  const config = CONFIGS[actionType]
  if (!isDatabaseConfigured) {
    return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
  }

  const res = await queryPg<{ attemptCount: number; windowStartAt: string; lockedUntil: string | null }>(
    `SELECT "attemptCount", "windowStartAt", "lockedUntil" FROM auth_rate_limits
     WHERE identifier = $1 AND "actionType" = $2 LIMIT 1`,
    [identifier, actionType]
  )
  const record = res.rows?.[0]
  if (!record) {
    return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
  }

  const now = new Date()
  const lockedUntil = record.lockedUntil ? new Date(record.lockedUntil) : null

  if (lockedUntil && now < lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil }
  }

  const windowStart = new Date(record.windowStartAt)
  const windowExpired = now.getTime() - windowStart.getTime() > config.windowMinutes * 60 * 1000

  if (windowExpired) {
    // Jendela lama sudah lewat & tidak sedang lockout -> hitungan dianggap reset
    return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
  }

  const remaining = Math.max(config.maxAttempts - record.attemptCount, 0)
  return { allowed: remaining > 0, remainingAttempts: remaining, lockedUntil: null }
}

/**
 * Mencatat SATU percobaan (baik berhasil maupun gagal). Panggil setelah tahu hasil autentikasi.
 * Kalau berhasil, hitungan langsung direset (supaya user yang sah tidak ikut kena batas
 * hanya karena beberapa kali salah ketik sebelumnya).
 */
export async function recordAuthAttempt(
  identifier: string,
  actionType: keyof typeof CONFIGS,
  success: boolean
): Promise<void> {
  if (!isDatabaseConfigured) return
  const config = CONFIGS[actionType]

  if (success) {
    await queryPg(`DELETE FROM auth_rate_limits WHERE identifier = $1 AND "actionType" = $2`, [identifier, actionType])
    return
  }

  const now = new Date()
  const res = await queryPg<{ attemptCount: number; windowStartAt: string }>(
    `SELECT "attemptCount", "windowStartAt" FROM auth_rate_limits WHERE identifier = $1 AND "actionType" = $2 LIMIT 1`,
    [identifier, actionType]
  )
  const record = res.rows?.[0]
  const windowExpired = record
    ? now.getTime() - new Date(record.windowStartAt).getTime() > config.windowMinutes * 60 * 1000
    : true

  if (!record || windowExpired) {
    await queryPg(
      `INSERT INTO auth_rate_limits (identifier, "actionType", "attemptCount", "windowStartAt", "lockedUntil", "updatedAt")
       VALUES ($1, $2, 1, $3, NULL, $3)
       ON CONFLICT (identifier, "actionType")
       DO UPDATE SET "attemptCount" = 1, "windowStartAt" = $3, "lockedUntil" = NULL, "updatedAt" = $3`,
      [identifier, actionType, now.toISOString()]
    )
    return
  }

  const newCount = record.attemptCount + 1
  const shouldLock = newCount >= config.maxAttempts
  const lockedUntil = shouldLock ? new Date(now.getTime() + config.lockoutMinutes * 60 * 1000) : null

  await queryPg(
    `UPDATE auth_rate_limits SET "attemptCount" = $1, "lockedUntil" = $2, "updatedAt" = $3
     WHERE identifier = $4 AND "actionType" = $5`,
    [newCount, lockedUntil?.toISOString() || null, now.toISOString(), identifier, actionType]
  )
}

/** Helper untuk pesan error yang konsisten ke user */
export function formatLockoutMessage(lockedUntil: Date): string {
  const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutesLeft} menit.`
}
```

### 2. Terapkan di `POST /api/auth/login`

Identifier gabungan IP + username — supaya satu penyerang yang mencoba banyak username dari 1 IP tetap dibatasi, dan satu username tidak bisa diserang dari banyak IP sekaligus tanpa masing-masing IP kena limitnya sendiri:

```ts
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const { username, password } = await req.json()
  const cleanUsername = (username || "").trim().toLowerCase()

  const identifier = `${ip}:${cleanUsername}`
  const rateCheck = await checkAuthRateLimit(identifier, "login")

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: formatLockoutMessage(rateCheck.lockedUntil!) },
      { status: 429 }
    )
  }

  const isValid = await validateAdminCredentials(cleanUsername, password)

  await recordAuthAttempt(identifier, "login", isValid)

  if (!isValid) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 })
  }

  // ...lanjut proses createSessionToken seperti sekarang
}
```

### 3. Terapkan di `POST /api/auth/register`

Identifier cukup IP saja (mencegah 1 sumber membuat banyak tenant sekaligus):

```ts
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  const rateCheck = await checkAuthRateLimit(ip, "register")
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: formatLockoutMessage(rateCheck.lockedUntil!) }, { status: 429 })
  }

  // ...proses registrasi seperti biasa...

  await recordAuthAttempt(ip, "register", regResult.success)
  return NextResponse.json({ success: regResult.success, ... })
}
```

### 4. Terapkan di `POST /api/auth/forgot-password` — dua actionType terpisah

**`action: "request_otp"`** — identifier pakai nomor telepon/username tujuan (mencegah spam OTP ke satu akun dari IP manapun):

```ts
const identifier = `otp_request:${cleanUsername}`
const rateCheck = await checkAuthRateLimit(identifier, "otp_request")
if (!rateCheck.allowed) {
  return NextResponse.json({ error: formatLockoutMessage(rateCheck.lockedUntil!) }, { status: 429 })
}

// ...generate & kirim OTP seperti biasa...

await recordAuthAttempt(identifier, "otp_request", true)  // selalu dicatat sebagai "attempt", sukses atau gagal kirim tetap menghitung kuota permintaan
```

**`action: "verify_and_reset"`** — ini yang paling penting karena inilah yang mencegah brute-force 6-digit OTP:

```ts
const identifier = `otp_verify:${cleanUsername}`
const rateCheck = await checkAuthRateLimit(identifier, "otp_verify")
if (!rateCheck.allowed) {
  return NextResponse.json({ error: formatLockoutMessage(rateCheck.lockedUntil!) }, { status: 429 })
}

const isOtpValid = /* ...cek OTP yang ada seperti sekarang... */

await recordAuthAttempt(identifier, "otp_verify", isOtpValid)

if (!isOtpValid) {
  return NextResponse.json({ error: "Kode OTP salah atau kedaluwarsa" }, { status: 400 })
}
// ...lanjut proses reset password...
```

Dengan konfigurasi `otp_verify: { maxAttempts: 5, windowMinutes: 10, lockoutMinutes: 30 }`, penyerang cuma dapat 5 percobaan per siklus OTP 10 menit sebelum di-lockout 30 menit — mengubah serangan dari "realistis dalam hitungan menit" menjadi "butuh ribuan tahun" secara matematis.

### 5. Samakan pesan error supaya tidak membocorkan detail internal

Semua respons `429` di atas cukup bilang "Terlalu banyak percobaan, coba lagi dalam X menit" — jangan tampilkan detail seperti "identifier locked" atau angka `attemptCount` mentah, karena itu memudahkan penyerang mengalibrasi ulang strategi mereka.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `database/schema.sql` | Tabel baru `auth_rate_limits` |
| `src/lib/authRateLimiter.ts` | **Baru** — `checkAuthRateLimit`, `recordAuthAttempt`, `formatLockoutMessage` |
| `src/app/api/auth/login/route.ts` | Cek + catat rate limit per `ip:username` |
| `src/app/api/auth/register/route.ts` | Cek + catat rate limit per `ip` |
| `src/app/api/auth/forgot-password/route.ts` | Cek + catat rate limit terpisah untuk `otp_request` (per username/nomor) dan `otp_verify` (per username) |

## Catatan Penting

- Modul ini sengaja dibuat terpisah dari `rateLimiter.ts` yang sudah ada — jangan digabung, karena keduanya melindungi hal yang berbeda (biaya OCR vs. keamanan akun) dengan karakteristik jendela & lockout yang berbeda pula.
- Rate limit ini berbasis database (bukan in-memory murni), jadi tetap konsisten walau aplikasi berjalan di banyak instance serverless — penting khusus untuk kasus `otp_verify` yang harus benar-benar konsisten menghitung percobaan gagal dari semua request, bukan reset diam-diam kalau kena instance server yang berbeda.
- Sekali diterapkan, cek juga apakah frontend (halaman login/register/forgot-password) sudah menampilkan pesan `429` dengan baik ke user (bukan cuma menampilkan "terjadi kesalahan" generik).

## Checklist Verifikasi

- [ ] Login salah 5x berturut-turut dengan username sama → percobaan ke-6 langsung ditolak `429` tanpa mengecek password lagi
- [ ] Setelah 15 menit lockout berakhir → login normal bisa dicoba lagi
- [ ] Login berhasil di percobaan ke-2 (setelah 1x salah) → hitungan langsung reset, tidak ikut membatasi login berikutnya
- [ ] Register 4x dari IP yang sama dalam 1 jam → percobaan ke-4 ditolak `429`
- [ ] Minta OTP forgot-password 4x untuk username yang sama dalam 1 jam → percobaan ke-4 ditolak, WhatsApp tidak terkirim lagi
- [ ] Coba tebak OTP salah 5x → percobaan ke-6 ditolak `429` walau kode OTP-nya sendiri belum kedaluwarsa
- [ ] Cek tabel `auth_rate_limits` di database — baris ter-update sesuai `identifier` dan `actionType` yang benar

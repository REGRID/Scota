# SESSION_SECRET Punya Fallback Hardcoded

## Masalah Saat Ini

Di `src/lib/session.ts`:

```ts
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "scota_default_fallback_secret_key_needs_env_override_in_prod"
  return new TextEncoder().encode(secret)
}
```

Fungsi ini dipakai oleh **satu-satunya** mekanisme yang membuktikan keaslian sesi login — `createSessionToken` (saat login) dan `verifySessionToken` (di setiap request yang butuh autentikasi, termasuk `authHelper.ts` dan `superadminGuard.ts`). Kalau environment variable `SESSION_SECRET` lupa di-set — di server staging, di preview deployment Vercel, atau bahkan production karena human error saat setup — aplikasi **tidak crash dan tidak menolak start**. Ia diam-diam jalan memakai string fallback yang nilainya persis seperti di atas, dan string itu **ada di kode sumber repo ini**, terlihat oleh siapa pun yang bisa membaca repo.

Dampaknya: siapa pun yang tahu (atau menemukan lewat baca kode) string `scota_default_fallback_secret_key_needs_env_override_in_prod`, bisa membuat JWT sendiri yang ditandatangani pakai secret yang sama, lalu memalsukan sesi untuk **user, role, atau tenant mana pun** — termasuk `role: "SUPERADMIN"` — tanpa perlu tahu password siapa pun. Ini secara efektif membuka kembali celah "bypass total" yang sebelumnya sudah ditutup lewat migrasi ke JWT signed, hanya saja sekarang syaratnya adalah satu env var yang lupa di-set, bukan lagi bug di source code.

Ini pola yang **persis sama** dengan kasus kredensial database yang sebelumnya bocor (`pgDb.ts`) — bedanya di situ kredensial yang bocor, di sini secret kriptografisnya sendiri yang bocor karena dijadikan default.

## Solusi

### 1. Hilangkan fallback — wajib gagal cepat kalau env kosong

```ts
// src/lib/session.ts
import { SignJWT, jwtVerify } from "jose"

let cachedSecret: Uint8Array | null = null

function getSessionSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret

  const secret = process.env.SESSION_SECRET

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "SESSION_SECRET belum diset di environment variables. " +
      "Set SESSION_SECRET dengan nilai acak (mis. hasil `openssl rand -base64 48`) " +
      "sebelum menjalankan aplikasi — jangan gunakan nilai default apa pun."
    )
  }

  // Secret pendek/lemah tetap bisa di-brute-force walau sudah dari env,
  // jadi validasi panjang minimum sebagai jaring pengaman tambahan.
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET terlalu pendek (minimal 32 karakter). " +
      "Generate ulang dengan `openssl rand -base64 48`."
    )
  }

  cachedSecret = new TextEncoder().encode(secret)
  return cachedSecret
}

export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export interface SessionPayload {
  username: string
  role: "ADMIN" | "KARYAWAN" | "SUPERADMIN" | "MANAGER" | "OWNER" | string
  tenantId?: string
  staffName?: string
  name?: string
  fullName?: string
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSessionSecret()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null
  try {
    const secretKey = getSessionSecret()   // <- kalau env kosong, ini akan throw, bukan diam-diam pakai fallback
    const { payload } = await jwtVerify(token, secretKey)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
```

Catatan implementasi: `getSessionSecret()` sekarang **throw** kalau `SESSION_SECRET` kosong. Karena dipanggil dari dalam `try/catch` di `verifySessionToken`, request yang masuk akan tetap dapat respons rapi (`401` — dianggap sesi tidak valid), tapi log server akan mencatat error yang jelas ("SESSION_SECRET belum diset") sehingga masalah konfigurasi ketahuan sejak awal, bukan baru terasa saat ada yang mengeksploitasinya.

Untuk `createSessionToken` (dipanggil saat login), error ini akan langsung terlempar ke route handler login — pastikan route tersebut membungkusnya dengan pesan yang aman ke user (`"Terjadi kesalahan server, coba lagi nanti"`), bukan menampilkan detail error mentah ke response.

### 2. Tambahkan pengecekan saat startup, bukan cuma saat dipanggil

Supaya masalah konfigurasi ini ketahuan **sebelum** deployment menerima trafik sama sekali (bukan baru muncul saat request pertama masuk), tambahkan validasi startup di entry point aplikasi:

```ts
// instrumentation.ts (Next.js) — dijalankan sekali saat server start
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const required = ["SESSION_SECRET", "DATABASE_URL"]
    const missing = required.filter((key) => !process.env[key] || process.env[key]!.trim().length === 0)

    if (missing.length > 0) {
      throw new Error(
        `Environment variable wajib belum diset: ${missing.join(", ")}. ` +
        `Aplikasi tidak akan dijalankan tanpa ini.`
      )
    }

    if ((process.env.SESSION_SECRET || "").length < 32) {
      throw new Error("SESSION_SECRET terlalu pendek — minimal 32 karakter, generate dengan `openssl rand -base64 48`.")
    }
  }
}
```

(Next.js akan otomatis memanggil `register()` di `instrumentation.ts` pada saat server start, kalau `experimental.instrumentationHook` aktif — cek versi Next.js yang dipakai untuk konfigurasi yang tepat.)

### 3. Rotate `SESSION_SECRET` yang sudah dipakai sekarang

Karena tidak bisa dipastikan apakah deployment production selama ini benar-benar sudah pakai `SESSION_SECRET` dari env atau sempat jatuh ke fallback, perlakukan ini sama seperti kasus kredensial DB sebelumnya — **anggap perlu dirotasi**, bukan diasumsikan aman:

1. Generate secret baru: `openssl rand -base64 48`
2. Set sebagai `SESSION_SECRET` di Vercel (Production **dan** Preview environment)
3. Redeploy
4. Efek sampingnya sama seperti saat migrasi ke JWT dulu: **semua sesi yang sedang login akan otomatis logout**, karena token lama ditandatangani dengan secret yang berbeda — ini normal dan diharapkan.

### 4. `.env.example` sudah benar — pertahankan formatnya

```env
SESSION_SECRET="your-cryptographic-session-secret-key"
```

Sudah berupa placeholder yang jelas, bukan nilai asli — ini pola yang benar (beda dengan kasus `GEMINI_API_KEY` yang sebelumnya ketahuan berisi key asli). Cukup tambahkan komentar di atasnya sebagai pengingat:

```env
# Generate dengan: openssl rand -base64 48 — WAJIB diisi, tidak ada nilai default.
SESSION_SECRET="your-cryptographic-session-secret-key"
```

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/lib/session.ts` | Hapus fallback hardcoded; `throw` kalau `SESSION_SECRET` kosong atau < 32 karakter |
| `instrumentation.ts` | **Baru** — validasi env var wajib saat server start, gagal cepat sebelum menerima trafik |
| `.env.example` | Tambah komentar cara generate secret |
| Vercel Project Settings | Rotate `SESSION_SECRET` ke nilai baru, redeploy |

## Catatan Penting

- Ini prinsip yang sama yang berlaku untuk **semua** secret di aplikasi ini (sudah diterapkan benar di `pgDb.ts` setelah perbaikan sebelumnya): tidak boleh ada satu pun nilai default berupa string kredensial/secret asli di kode. Kalau env var belum diset, aplikasi harus gagal dengan jelas — bukan jalan diam-diam dengan nilai yang lebih lemah.
- Setelah perbaikan ini, ada baiknya audit sekali lagi seluruh codebase untuk pola serupa: `grep -rn "process.env\.\w* ||" src/` — cari semua tempat yang punya fallback ke string literal, lalu nilai satu per satu apakah fallback itu aman (misal fallback ke `"development"` untuk `NODE_ENV` itu wajar) atau berbahaya (fallback ke secret/password/key).

## Checklist Verifikasi

- [ ] Jalankan aplikasi lokal **tanpa** `SESSION_SECRET` di `.env.local` sama sekali → aplikasi gagal start / login gagal dengan error jelas, bukan diam-diam berhasil
- [ ] `grep -rn "scota_default_fallback_secret_key" .` di seluruh repo → hasil kosong setelah perbaikan
- [ ] `SESSION_SECRET` baru (hasil `openssl rand -base64 48`) sudah di-set di Vercel Production & Preview
- [ ] Setelah redeploy dengan secret baru, semua user yang tadinya login otomatis diminta login ulang
- [ ] Coba forge token manual pakai string fallback lama (`jwt.sign({role:"SUPERADMIN"}, "scota_default_fallback_secret_key_needs_override_in_prod")`) dan kirim sebagai cookie → harus ditolak `401` di production

# Hash Semua Password

## Masalah Saat Ini

Password disimpan dan dibandingkan sebagai **plaintext** di banyak tempat sekaligus. Kalau salah satu saja bocor (dan kita sudah menemukan DB credential yang bocor di `pgDb.ts`), semua password user langsung ikut bocor apa adanya — tanpa perlu di-crack sama sekali.

Titik-titik plaintext yang ditemukan:

| Lokasi | Kutipan | Masalah |
|---|---|---|
| `src/app/api/auth/login/route.ts:20` | `account.password !== cleanPassword` | Perbandingan langsung string vs string |
| `src/lib/adminAccounts.ts` (`getAdminPassword`, `validateAdminCredentials`, `updateAdminPassword`, `registerAdminAccount`) | password dibaca/ditulis apa adanya ke Supabase | Tidak ada hashing di jalur mana pun |
| `prisma/schema.prisma` | `password String` | Kolom tidak diberi batasan/format hash |
| `supabase/schema.sql` | `INSERT INTO admin_accounts (username, password, role) VALUES ('rama', 'adminnota123', 'ADMIN'), ...` | Password default **ter-commit ke repo publik** dalam bentuk plaintext |
| `admin_passwords.json` (dibuat runtime oleh `setLocalPassword`) | file lokal berisi `{ "rama": "adminnota123", ... }` | Kalau file ini ke-commit atau server file-nya diakses, semua password langsung terbaca |
| `.env.local` (ditulis ulang otomatis oleh `updateEnvFilePassword`) | `ADMIN_A_PASSWORD="..."` | Password tersimpan sebagai teks biasa di file environment |

Karena tidak ada hashing, siapa pun yang punya akses baca ke database (atau ke file-file di atas) — termasuk lewat kredensial DB yang sudah kita temukan bocor di GitHub — langsung dapat password asli semua admin, bukan sekadar hash yang butuh dipecahkan.

## Solusi

Ganti mekanisme penyimpanan & verifikasi password ke **hashing satu arah** pakai `bcrypt`. Prinsipnya: password mentah **tidak pernah** disimpan di mana pun setelah proses register/ganti password selesai — yang disimpan hanya hash-nya.

### 1. Install bcrypt

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

(`bcryptjs` dipilih — bukan `bcrypt` native — karena tidak butuh native binding/compile, lebih aman untuk deploy ke Vercel serverless.)

### 2. Buat helper terpusat: `src/lib/password.ts`

```ts
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 12

/** Mengubah password mentah menjadi hash. Dipakai saat register / ganti password. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

/** Membandingkan password mentah dari input login dengan hash yang tersimpan. */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  // Jaga-jaga kalau ada data lama yang belum sempat dimigrasikan (lihat bagian Migrasi di bawah)
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    return false
  }
  return bcrypt.compare(plainPassword, hash)
}

/** Mengecek apakah sebuah string sudah berupa hash bcrypt atau masih plaintext lama. */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value)
}
```

### 3. Update `src/lib/adminAccounts.ts`

**`validateAdminCredentials`** — ganti perbandingan string jadi `verifyPassword`:

```ts
import { verifyPassword } from "@/lib/password"

export async function validateAdminCredentials(username: string, inputPass: string): Promise<boolean> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    const cleanPass = inputPass.trim()
    if (!cleanUser || !cleanPass) return false

    const storedHash = await getAdminPassword(cleanUser)
    if (!storedHash) return false

    return verifyPassword(cleanPass, storedHash)
  } catch (error) {
    console.error("validateAdminCredentials error:", error)
    return false
  }
}
```

**`updateAdminPassword`** — hash sebelum disimpan, dan **hapus** logic yang menulis ke `admin_passwords.json` / `.env.local` (lihat bagian "Hapus Penyimpanan Sekunder" di bawah):

```ts
import { hashPassword } from "@/lib/password"

export async function updateAdminPassword(username: string, newPass: string): Promise<boolean> {
  const cleanUser = normalizeAdminUsername(username)
  const cleanPass = newPass.trim()
  if (!cleanUser || !cleanPass) return false

  const hashed = await hashPassword(cleanPass)

  if (isSupabaseConfigured) {
    const { data: existing } = await supabase
      .from("admin_accounts").select("id").eq("username", cleanUser).maybeSingle()

    if (existing) {
      await supabase.from("admin_accounts")
        .update({ password: hashed, updatedAt: new Date().toISOString() })
        .eq("id", existing.id)
    } else {
      await supabase.from("admin_accounts").insert({ username: cleanUser, password: hashed })
    }
    return true
  }

  return false
}
```

**`registerAdminAccount`** — sama, hash dulu sebelum `insert`:

```ts
const hashed = await hashPassword(cleanPass)
await supabase.from("admin_accounts").insert({
  username: cleanUser,
  password: hashed,
  role: "ADMIN",
  // ...field lain tetap sama
})
```

### 4. Hapus penyimpanan sekunder plaintext

Fungsi-fungsi berikut di `adminAccounts.ts` menyimpan password mentah di luar database dan **harus dihapus seluruhnya**, bukan sekadar diubah:

- `getLocalPasswords()`, `setLocalPassword()`, dan file `admin_passwords.json` yang dihasilkannya
- `updateEnvFilePassword()` — jangan pernah menulis ulang `.env.local` secara otomatis dari kode aplikasi
- `DEFAULT_ADMINS` dengan `defaultPass` dari `process.env.ADMIN_A_PASSWORD` dkk — kalau memang perlu akun default untuk setup awal, generate hash-nya sekali lewat script migrasi (langkah 6), bukan dibandingkan sebagai plaintext saat runtime

Alasan: selama ada jalur *fallback* ke plaintext (file lokal atau env var yang dibandingkan langsung), hashing di database jadi percuma — penyerang tinggal cari jalur yang paling lemah.

### 5. Perbaiki seed data di `supabase/schema.sql`

Ganti insert plaintext:

```sql
INSERT INTO public.admin_accounts (username, password, role)
VALUES
    ('rama', 'adminnota123', 'ADMIN'),
    ('refo', 'adminnota456', 'ADMIN'),
    ('karyawan', 'StudioPhoto2026', 'KARYAWAN')
ON CONFLICT (username) DO NOTHING;
```

menjadi hash bcrypt (generate dulu lewat script Node kecil, lalu tempel hasilnya — **jangan** taruh password aslinya di komentar SQL):

```sql
INSERT INTO public.admin_accounts (username, password, role)
VALUES
    ('rama', '$2b$12$<hash_hasil_generate>', 'ADMIN'),
    ('refo', '$2b$12$<hash_hasil_generate>', 'ADMIN'),
    ('karyawan', '$2b$12$<hash_hasil_generate>', 'KARYAWAN')
ON CONFLICT (username) DO NOTHING;
```

Dan — karena `adminnota123`, `adminnota456`, `StudioPhoto2026` sudah pernah ter-commit plaintext ke repo publik, **password-password ini harus dianggap bocor** terlepas dari hashing. Wajib diganti ke password baru yang belum pernah muncul di git history, bukan sekadar di-hash apa adanya.

### 6. Migrasi akun yang sudah ada

Karena akun-akun yang sudah terdaftar sekarang punya password plaintext di database, dibutuhkan script migrasi satu kali. Buat `scripts/migrate-hash-passwords.js`:

```js
const bcrypt = require("bcryptjs")
const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // pakai service role, bukan anon key, khusus untuk script migrasi
)

async function migrate() {
  const { data: accounts, error } = await supabase.from("admin_accounts").select("id, username, password")
  if (error) throw error

  for (const acc of accounts) {
    const isAlreadyHashed = /^\$2[aby]\$\d{2}\$/.test(acc.password || "")
    if (isAlreadyHashed) {
      console.log(`Lewati ${acc.username}, sudah ter-hash.`)
      continue
    }

    const hashed = await bcrypt.hash(acc.password, 12)
    await supabase.from("admin_accounts").update({ password: hashed }).eq("id", acc.id)
    console.log(`Password ${acc.username} berhasil di-hash.`)
  }

  console.log("Migrasi selesai.")
}

migrate()
```

Jalankan **sekali** sebelum deploy kode baru: `node scripts/migrate-hash-passwords.js`. Setelah dipastikan berhasil, hapus script ini dari repo (atau minimal jangan dijalankan ulang di production tanpa pengecekan `isAlreadyHashed`).

### 7. Panjang password minimum

Selagi mengubah alur ini, naikkan validasi panjang minimum yang saat ini cuma 4 karakter — di `register/route.ts`, `change-password/route.ts`, dan `superadmin/tenants/route.ts` (action `reset_password`):

```ts
if (cleanPassword.length < 8) {
  return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
}
```

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/lib/password.ts` | **Baru** — `hashPassword`, `verifyPassword` |
| `src/lib/adminAccounts.ts` | Hash di `updateAdminPassword` & `registerAdminAccount`; `verifyPassword` di `validateAdminCredentials`; **hapus** `getLocalPasswords`, `setLocalPassword`, `updateEnvFilePassword`, `admin_passwords.json`, fallback `DEFAULT_ADMINS.defaultPass` |
| `supabase/schema.sql` | Ganti seed password plaintext jadi hash bcrypt + ganti nilai passwordnya |
| `scripts/migrate-hash-passwords.js` | **Baru** — migrasi satu kali untuk akun lama |
| `src/app/api/auth/register/route.ts`, `change-password/route.ts`, `superadmin/tenants/route.ts` | Naikkan minimum panjang password ke 8 karakter |

## Catatan Penting

- Ini melengkapi, bukan menggantikan, perbaikan **"Ganti auth ke session token yang benar"** — alur di sana (login membandingkan password ke DB) tetap sama persis, hanya fungsi pembandingnya (`validateAdminCredentials`) yang sekarang memanggil `bcrypt.compare` alih-alih `===`.
- Karena password lama (`adminnota123`, dst.) sudah bocor lewat commit publik, hashing di titik ini **tidak cukup** untuk mengamankannya — password-nya sendiri wajib diganti (lihat langkah 5).
- `bcrypt.compare` sedikit lebih lambat dari `===` (by design, untuk memperlambat brute-force) — ini normal dan tidak akan terasa untuk endpoint login yang frekuensinya rendah.

## Checklist Verifikasi

- [ ] Login dengan password yang benar tetap berhasil
- [ ] Login dengan password salah tetap gagal (`401`)
- [ ] Cek isi tabel `admin_accounts` di Supabase — kolom `password` semua berformat `$2b$12$...`, tidak ada lagi plaintext
- [ ] File `admin_passwords.json` tidak lagi dibuat/ditulis setelah request apa pun
- [ ] `.env.local` tidak lagi ditulis ulang otomatis oleh aplikasi
- [ ] `git log -p -- supabase/schema.sql` dicek — pastikan versi baru yang di-push tidak membawa password plaintext lama di riwayat commit baru
- [ ] Coba register/reset password dengan password < 8 karakter → harus ditolak
- [ ] Password default (`adminnota123`, `adminnota456`, `StudioPhoto2026`) sudah diganti ke nilai baru di semua environment (dev, staging, production)

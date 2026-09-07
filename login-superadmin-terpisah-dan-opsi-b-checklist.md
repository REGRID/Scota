# Login Superadmin Terpisah dari Clerk + Checklist Konfigurasi Opsi B

## Masalah

`AdminLoginScreen.tsx` (dipakai `/login` & `/register`) sekarang 100% Clerk — form password custom yang lama sudah tidak ada sama sekali di UI. Untuk pengguna bisnis biasa ini tidak masalah (belum ada user asli, aman diabaikan sesuai konfirmasimu). Tapi **superadmin sengaja tetap memakai sistem internal terpisah** (`nota_admin_session`, dicek manual di `middleware.ts` — bukan Clerk), dan sekarang **tidak ada satu pun form di UI yang bisa menghasilkan sesi itu**, karena `/login` sudah sepenuhnya digantikan widget Clerk.

Ditambah, `middleware.ts` baris 32 masih mengarahkan ke `/login` kalau belum ada token:
```ts
if (!token) {
  return NextResponse.redirect(new URL("/login", req.url))
}
```
Padahal `/login` sekarang cuma berisi Clerk — sama sekali tidak membantu superadmin masuk.

## Solusi — Halaman Login Superadmin Berdiri Sendiri

Dibuat **terpisah total** dari `MainApp`/`AdminLoginScreen`/Clerk — halaman polos, tidak dipromosikan di navigasi manapun, murni pintu masuk internal.

### 1. `src/app/superadmin/login/page.tsx` (baru)

```tsx
import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"

export const metadata = {
  title: "Internal Access",
  robots: { index: false, follow: false },   // jaga-jaga tambahan, selain robots.ts
}

export default function SuperadminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <SuperadminLoginForm />
    </div>
  )
}
```

### 2. `src/components/SuperadminLoginForm.tsx` (baru) — form polos, langsung panggil API lama

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function SuperadminLoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Login gagal")
        return
      }
      router.push("/superadmin")
    } catch {
      setError("Terjadi kesalahan jaringan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
      <h1 className="text-sm font-bold text-slate-300">Internal Access</h1>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
        autoComplete="off"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-500 text-slate-950 font-bold py-2 rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  )
}
```

`/api/auth/login` **tidak perlu diubah sama sekali** — endpoint ini tidak pernah disentuh selama migrasi ke Clerk, cuma UI yang memanggilnya yang hilang. Form baru ini cukup memanggilnya lagi.

### 3. Perbaiki redirect di `middleware.ts`

```ts
// SEBELUM
if (!token) {
  return NextResponse.redirect(new URL("/login", req.url))
}

// SESUDAH
if (!token) {
  return NextResponse.redirect(new URL("/superadmin/login", req.url))
}
```

### 4. Daftarkan sebagai route publik (supaya tidak ikut kena blokir sesi API)

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/signin(.*)",
  "/signup(.*)",
  "/pricing(.*)",
  "/sso-callback(.*)",
  "/superadmin/login",   // <- baru
  "/api/ping",
  "/api/quota",
  "/api/parse-receipt",
  "/api/auth/(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/subscription(.*)",
])
```

Perhatikan: proteksi khusus `/superadmin` di middleware (baris 24-38) sudah mengecualikan `startsWith("/superadmin")` untuk dicek token-nya — perlu tambahan kecil supaya `/superadmin/login` **sendiri** dikecualikan dari pengecekan token itu (kalau tidak, akan infinite redirect: buka `/superadmin/login` → tidak ada token → redirect ke `/superadmin/login` lagi):

```ts
if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login") {
  // ...logic proteksi yang sudah ada, tidak berubah
}
```

### 5. Sembunyikan dari mesin pencari (lapisan tambahan)

`robots.ts` sudah men-disallow seluruh `/superadmin/` (termasuk otomatis `/superadmin/login`) — tidak perlu perubahan di situ. Halaman ini juga sengaja **tidak dilink dari mana pun** di navigasi publik — cuma bisa diakses kalau tahu URL persis.

## Soal Akun Lama — Aman Dibersihkan, dengan 1 Pengecualian

Karena belum ada user asli, aman untuk membersihkan baris `admin_accounts` lama (yang dulu dari sistem password manual, `role IN ('ADMIN','KARYAWAN','OWNER')`). **Kecuali baris dengan `role = 'SUPERADMIN'`** — itu **wajib dipertahankan**, karena itulah akun yang dipakai lewat form baru di atas. Sebelum bersih-bersih, verifikasi dulu:

```sql
SELECT username, role FROM admin_accounts WHERE role = 'SUPERADMIN';
```

Pastikan minimal 1 baris muncul, dan kamu tahu passwordnya (atau reset dulu lewat `updateAdminPassword` di database kalau lupa), **sebelum** menjalankan pembersihan data lama.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/superadmin/login/page.tsx` | **Baru** — halaman standalone, tidak lewat `MainApp`/Clerk |
| `src/components/SuperadminLoginForm.tsx` | **Baru** — form polos, panggil `/api/auth/login` lama |
| `src/middleware.ts` | Redirect target diperbaiki ke `/superadmin/login`; tambah pengecualian supaya halaman ini sendiri tidak ikut diproteksi; tambah ke `isPublicRoute` |

---

## Checklist Konfigurasi Clerk Dashboard — Supaya Opsi B Benar-Benar Aktif

Ini bagian yang tidak bisa diverifikasi lewat kode, cuma lewat pengaturan di **dashboard.clerk.com**:

- [ ] **User & Authentication → Email, Phone, Username** → pastikan **Password** aktif sebagai salah satu strategi (bukan cuma "Email verification code"/magic link) — ini yang membuat field password muncul di widget
- [ ] **User & Authentication → Social Connections** → **Google** berstatus **Enabled**, dengan Client ID/Secret dari Google Cloud Console sudah terisi
- [ ] Buka `/register` di browser (setelah deploy) → pastikan widget menampilkan **dua-duanya**: field email/password DAN tombol "Continue with Google" dalam satu tampilan, bukan cuma salah satu
- [ ] Cek urutan tampilan (Clerk Dashboard → Customization) — pastikan tidak membingungkan (biasanya default Clerk sudah menaruh social login di atas, form password di bawah dengan pemisah "or")

## Checklist Verifikasi

- [ ] Buka `/superadmin` tanpa login sama sekali → redirect ke `/superadmin/login`, bukan `/login` (Clerk)
- [ ] Login lewat `/superadmin/login` pakai akun `role = SUPERADMIN` → berhasil masuk ke `/superadmin`
- [ ] Login lewat `/superadmin/login` pakai akun biasa (non-superadmin, kalau masih ada sisa data lama) → ditolak/redirect ke `/`, sesuai perilaku lama
- [ ] Buka `/superadmin/login` berkali-kali tanpa submit apa pun → tidak terjadi infinite redirect
- [ ] `curl -s https://scota.web.id/robots.txt` → `/superadmin/` tetap ter-disallow
- [ ] `/register` menampilkan opsi Google DAN email/password sekaligus (setelah konfigurasi dashboard di atas selesai)
- [ ] Data `admin_accounts` lama (non-superadmin) sudah dibersihkan, baris `SUPERADMIN` tetap ada dan bisa dipakai login

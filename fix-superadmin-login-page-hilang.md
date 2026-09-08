# Perbaikan: Halaman `/superadmin/login` Hilang & Proteksi Halaman Superadmin Hilang

## Masalah

1. `SuperadminLoginForm.tsx` sudah dibuat tapi **tidak ada `page.tsx`** yang merendernya — rute `/superadmin/login` tidak eksis sama sekali.
2. `middleware.ts` versi terbaru cuma memproteksi `/api/superadmin/**` (data API) — proteksi untuk **halaman** `/superadmin/**` (redirect pengunjung tanpa sesi/non-superadmin) sudah hilang dari refactor sebelumnya.
3. Di dalam `SuperadminLoginForm.tsx`, ada residu pola lama yang berbahaya:
   ```ts
   if (data.token) {
     localStorage.setItem("nota_admin_token", data.token)
   }
   if (data.user?.username) {
     localStorage.setItem("nota_admin_user", data.user.username)
     localStorage.setItem("nota_admin_role", data.user.role || "SUPERADMIN")
   }
   ```
   Ini peninggalan sistem lama (`authClient.ts`) yang dulu mengirim header `x-admin-user`/`x-admin-role` dari `localStorage` dan **dipercaya mentah-mentah oleh backend** — celah itu sudah ditutup di `authHelper.ts` (sekarang cuma percaya cookie JWT terverifikasi), jadi baris ini sekarang **tidak lagi berpengaruh ke autentikasi**. Tapi tetap berbahaya untuk dibiarkan: menyimpan data mirip token di `localStorage` (bisa dibaca skrip apa pun kalau ada celah XSS di masa depan, beda dengan cookie `httpOnly`), dan berisiko ada yang tidak sadar lalu membangun ulang logic yang mempercayai nilai ini di kemudian hari — membuka lagi celah yang sama persis.

## Solusi

### 1. `src/app/superadmin/login/page.tsx` (baru)

```tsx
import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"

export const metadata = {
  title: "Internal Access",
  robots: { index: false, follow: false },
}

export default function SuperadminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <SuperadminLoginForm />
    </div>
  )
}
```

Tidak perlu mengirim prop `onSuccess` — komponennya sudah punya default behavior (`router.push("/superadmin")` kalau `onSuccess` tidak diisi), jadi cukup dipanggil polos begini.

### 2. Bersihkan residu `localStorage` di `SuperadminLoginForm.tsx`

```tsx
// SEBELUM
const data = await res.json()
if (!res.ok) {
  setError(data.error || "Akses ditolak. Kredensial tidak valid.")
  return
}

if (data.token) {
  localStorage.setItem("nota_admin_token", data.token)
}
if (data.user?.username) {
  localStorage.setItem("nota_admin_user", data.user.username)
  localStorage.setItem("nota_admin_role", data.user.role || "SUPERADMIN")
}

if (onSuccess) {
  onSuccess()
} else {
  router.push("/superadmin")
  router.refresh()
}
```

```tsx
// SESUDAH -- cookie httpOnly dari /api/auth/login sudah cukup, tidak perlu simpan apa pun manual di client
const data = await res.json()
if (!res.ok) {
  setError(data.error || "Akses ditolak. Kredensial tidak valid.")
  return
}

if (onSuccess) {
  onSuccess()
} else {
  router.push("/superadmin")
  router.refresh()
}
```

Cookie sesi (`nota_admin_session`, `httpOnly`) sudah otomatis di-set oleh browser lewat response `/api/auth/login` — tidak ada satu pun bagian dari aplikasi yang butuh baca `nota_admin_token`/`nota_admin_user`/`nota_admin_role` dari `localStorage` lagi setelah migrasi ke sistem JWT signed. Aman dihapus total.

### 3. Kembalikan proteksi halaman `/superadmin/**` di `middleware.ts`

```ts
export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // BARU -- proteksi HALAMAN /superadmin/** (bukan API-nya, itu sudah ditangani terpisah di bawah)
  if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login") {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      return NextResponse.redirect(new URL("/superadmin/login", req.url))
    }

    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  }

  // 1. Proteksi API Superadmin (/api/superadmin/**) -- TIDAK BERUBAH
  if (pathname.startsWith("/api/superadmin")) {
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader

    if (!token) {
      return NextResponse.json({ error: "Akses ditolak. Sesi Superadmin tidak valid." }, { status: 401 })
    }

    const session = await verifySessionToken(token)
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Akses ditolak. Endpoint khusus Superadmin." }, { status: 403 })
    }

    return NextResponse.next()
  }

  // 2. Proteksi API Routes Non-Publik (/api/**) -- TIDAK BERUBAH
  if (pathname.startsWith("/api/") && !isPublicRoute(req)) {
    const { userId } = await auth()
    const sessionCookie = req.cookies.get("nota_admin_session")?.value
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
    const token = sessionCookie || authHeader
    const hasLegacySession = token && (await verifySessionToken(token))

    if (!userId && !hasLegacySession) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login terlebih dahulu." }, { status: 401 })
    }
  }

  return NextResponse.next()
})
```

Urutan pengecekan `pathname !== "/superadmin/login"` **wajib** ada — kalau tidak, halaman login superadmin sendiri akan ikut dianggap butuh sesi, memicu *infinite redirect* (belum ada token → redirect ke `/superadmin/login` → dicek lagi, belum ada token → redirect lagi, dst).

### 4. Tambahkan `/superadmin/login` ke `isPublicRoute`

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
  "/superadmin/login",   // <- baru, supaya konsisten walau saat ini belum ada logic /api/ yang butuh ini
  "/api/ping",
  "/api/quota",
  "/api/parse-receipt",
  "/api/auth/(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/subscription(.*)",
])
```

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/superadmin/login/page.tsx` | **Baru** — merender `SuperadminLoginForm` |
| `src/components/SuperadminLoginForm.tsx` | Hapus 2 blok `localStorage.setItem` yang sudah tidak diperlukan |
| `src/middleware.ts` | Tambah blok proteksi halaman `/superadmin/**` (dengan pengecualian `/superadmin/login`), tambah ke `isPublicRoute` |

## Catatan Penting

- Pastikan urutan blok di middleware: cek `/superadmin` (halaman) **sebelum** cek `/api/superadmin` — kedua pattern memang tidak akan tumpang tindih (satu untuk halaman HTML, satu untuk `/api/`), tapi menaruh yang lebih spesifik lebih dulu tetap kebiasaan yang lebih aman untuk menghindari bug serupa di masa depan.
- Setelah perbaikan ini, verifikasi dulu kredensial superadmin masih valid (sesuai catatan di dokumen sebelumnya) sebelum mengumumkan/pakai fitur ini lagi secara rutin.

## Checklist Verifikasi

- [ ] Buka `/superadmin` tanpa login sama sekali → redirect ke `/superadmin/login`, TIDAK menampilkan sidebar/layout apa pun
- [ ] Buka `/superadmin/login` langsung → form tampil normal, tidak ada infinite redirect
- [ ] Login dengan akun `role = SUPERADMIN` yang valid → berhasil masuk ke `/superadmin`
- [ ] Login dengan akun biasa (non-superadmin) → ditolak/redirect ke `/`
- [ ] Cek DevTools → Application → Local Storage setelah login → tidak ada lagi `nota_admin_token`/`nota_admin_user`/`nota_admin_role` yang tersimpan
- [ ] Endpoint `/api/superadmin/**` tetap berfungsi seperti sebelumnya (tidak terpengaruh perubahan ini, cuma halaman UI-nya yang diperbaiki)

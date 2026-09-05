# Fix: Login Google Gagal — Path Internal Auth.js Terblokir Middleware

## Masalah

Screenshot menunjukkan mengakses `/api/auth/error` mengembalikan `{"error":"Sesi tidak valid. Silakan login."}` — ini bukan halaman error asli milik Auth.js, tapi respons blokir dari `middleware.ts` milik Scota sendiri.

`PUBLIC_API_ROUTES` di `src/middleware.ts` sudah mencakup `/api/auth/callback` (untuk menerima balasan dari Google), tapi **belum** mencakup beberapa path internal lain yang juga wajib bisa diakses tanpa sesi supaya alur OAuth Google bisa selesai:

| Path | Fungsi dalam alur Auth.js | Status |
|---|---|---|
| `/api/auth/csrf` | Auth.js mengambil token CSRF ini **sebelum** memulai proses signin | ❌ Terblokir |
| `/api/auth/providers` | Dipanggil secara internal untuk memvalidasi provider yang aktif | ❌ Terblokir |
| `/api/auth/signin` | Endpoint yang memulai redirect ke halaman login Google | ❌ Terblokir |
| `/api/auth/error` | Menampilkan detail kalau OAuth gagal/dibatalkan pengguna | ❌ Terblokir (ini yang muncul di screenshot) |

Karena `csrf` dan `providers` gagal duluan (kena `401` dari middleware), seluruh proses "Login dengan Google" gagal sejak langkah paling awal — sebelum sempat redirect ke Google sama sekali.

## Solusi

Tambahkan keempat path ke `PUBLIC_API_ROUTES` di `src/middleware.ts`:

```ts
const PUBLIC_API_ROUTES = [
  "/api/ping",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/demo-login",
  "/api/auth/callback",
  "/api/auth/signin",     // baru -- memulai redirect ke Google
  "/api/auth/error",      // baru -- tampilkan error OAuth
  "/api/auth/csrf",       // baru -- token CSRF, diambil sebelum signin
  "/api/auth/providers",  // baru -- daftar provider aktif
  "/api/parse-receipt",
  "/api/quota",
]
```

Tidak ada perubahan lain di bagian middleware — pola pengecekan (`pathname === route || pathname.startsWith(route + "/")`) yang sudah ada otomatis berlaku untuk path baru ini juga, termasuk sub-path seperti `/api/auth/signin/google`.

## Catatan Penting — Potensi Konflik `/api/auth/session`

Scota sudah punya route custom `src/app/api/auth/session/route.ts` untuk sistem login password biasa. Auth.js juga punya endpoint bawaan dengan nama path **persis sama** (`/api/auth/session`) untuk mengecek sesi Auth.js miliknya sendiri.

Karena Next.js selalu memprioritaskan file route statis (punya Scota) dibanding catch-all dinamis (`[...nextauth]`) untuk path yang sama persis, endpoint bawaan Auth.js di path ini **tidak akan pernah terpanggil** — semua request ke `/api/auth/session` akan selalu dijawab oleh route custom Scota.

Ini **aman diabaikan** selama frontend tidak pernah memakai hook `useSession()` dari `next-auth/react` (yang mengharapkan format response bawaan Auth.js). Kalau alur Google login sejauh ini murni lewat halaman custom (`/demo/masuk`, `/demo/callback`) tanpa hook tersebut, tidak perlu tindakan tambahan. Kalau nanti ada bagian UI yang mau memakai `useSession()`, perlu diganti pakai pengecekan sesi custom Scota (`getSession`/fetch ke `/api/auth/session` milik sendiri) supaya tidak salah baca format data.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/middleware.ts` | Tambah 4 path (`signin`, `error`, `csrf`, `providers`) ke `PUBLIC_API_ROUTES` |

## Checklist Verifikasi

- [ ] Buka `/api/auth/csrf` langsung di browser → tidak lagi `401`, mengembalikan token CSRF dari Auth.js
- [ ] Klik "Login dengan Google" dari `/demo/masuk` → berhasil redirect ke halaman pilih akun Google (bukan macet/gagal di awal)
- [ ] Setelah approve di Google → berhasil kembali ke `/demo/callback` dan masuk dashboard demo
- [ ] Coba batalkan proses login Google di tengah jalan → diarahkan ke `/api/auth/error` dan menampilkan halaman error **asli** Auth.js, bukan JSON blokir middleware
- [ ] Pastikan endpoint lain yang sengaja masih tertutup (`backup`, `receipts/export`, dll) tetap `401` tanpa sesi — tidak ada yang ikut ke-whitelist secara tidak sengaja

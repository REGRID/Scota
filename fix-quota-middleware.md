# Fix: `/api/quota` Ikut Terblokir Middleware

## Masalah

`src/middleware.ts` menutup semua `/api/**` secara default kecuali yang ada di `PUBLIC_API_ROUTES`. `/api/parse-receipt` sengaja dibiarkan publik untuk fitur "coba scan sebelum login", tapi `/api/quota` — endpoint yang dipanggil `ReceiptImageUpload.tsx` untuk menampilkan sisa kuota scan hari ini — tidak ikut dimasukkan:

```ts
const PUBLIC_API_ROUTES = [
  "/api/ping",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/parse-receipt", // publik by design untuk scan sebelum login
]
```

Dampaknya: pengguna yang belum login tetap bisa melakukan scan (`parse-receipt` publik), tapi UI yang menampilkan "sisa kuota hari ini" gagal memuat karena `/api/quota` sekarang mengembalikan `401` untuk siapa pun tanpa sesi. Fitur scan-sebelum-login jadi setengah jalan — bisa scan, tapi indikator kuotanya rusak.

## Solusi

Tambahkan `/api/quota` ke daftar publik, karena secara fungsi ia satu paket dengan `/api/parse-receipt` — keduanya sama-sama berbasis rate limit per-IP (`rateLimiter.ts`), bukan data milik tenant tertentu, jadi aman dibuka tanpa sesi:

```ts
// src/middleware.ts
const PUBLIC_API_ROUTES = [
  "/api/ping",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/parse-receipt", // publik by design untuk scan sebelum login
  "/api/quota",         // satu paket dengan parse-receipt -- menampilkan sisa kuota IP, bukan data tenant
]
```

Tidak ada perubahan lain yang dibutuhkan — `src/app/api/quota/route.ts` sendiri sudah aman dari awal (cuma membaca rate limit berbasis IP lewat `checkRateLimit`, tidak pernah menyentuh data tenant mana pun), jadi membukanya untuk publik tidak membuka celah baru.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/middleware.ts` | Tambah `"/api/quota"` ke `PUBLIC_API_ROUTES` |

## Catatan Penting

- Kalau ke depannya `/api/quota` diubah untuk juga menampilkan kuota tenant yang sudah login (bukan cuma kuota IP publik), route handler-nya perlu di-update untuk membedakan dua kasus: kalau ada sesi valid tampilkan kuota tenant (dari tabel `subscriptions`), kalau tidak ada sesi tampilkan kuota IP seperti sekarang. Middleware tidak perlu diubah lagi untuk itu — cukup route handler-nya yang jadi lebih pintar.

## Checklist Verifikasi

- [ ] `curl /api/quota` tanpa cookie/sesi → tetap `200`, mengembalikan sisa kuota IP seperti sebelumnya
- [ ] Buka halaman scan tanpa login → indikator "sisa kuota hari ini" tampil normal, tidak error
- [ ] Endpoint publik lain (`parse-receipt`, `login`, dll) tidak terpengaruh oleh perubahan ini
- [ ] Endpoint yang memang harus tetap privat (`backup`, `receipts/export`, dll) tetap `401` tanpa sesi — pastikan tidak ada yang ikut tertambah ke daftar publik secara tidak sengaja

# Fix: `/register` & `/login` Tertahan di Loading Screen Sebelum Form Muncul

## Masalah

`src/app/register/page.tsx` dan `src/app/login/page.tsx` sama-sama merender `MainApp` — komponen yang sama dipakai untuk landing, auth, DAN dashboard:

```tsx
export default function RegisterPage() {
  return <MainApp initialView="register" />
}
```

Di dalam `MainApp.tsx`, urutan render-nya:
```tsx
if (showLanding) { return <IntroductionDashboard ... /> }

// <- untuk /register & /login, showLanding = false, jadi lanjut ke sini:
if (isAuthenticated === null) {
  return <div>...<p>Memverifikasi Sesi Admin...</p></div>   // <- SELALU tampil dulu
}

if (isAuthenticated === false) {
  return <AdminLoginScreen initialMode={authInitialMode} ... />   // <- form baru muncul di sini
}
```

Karena `isAuthenticated` selalu mulai dari `null` sampai fetch `/api/auth/session` selesai, **setiap** kunjungan ke `/register` atau `/login` — termasuk dari pengunjung yang jelas-jelas belum pernah login — harus menunggu network round-trip dulu sebelum form pendaftaran/login muncul. Untuk kasus paling umum (orang baru, belum pernah login), pengecekan ini hampir selalu berakhir "tidak terautentikasi" — jadi delay ini murni biaya tanpa manfaat buat mayoritas pengunjung, sekaligus kata-katanya ("Memverifikasi Sesi **Admin**") tidak relevan buat orang yang belum pernah punya sesi sama sekali.

## Solusi

Balik urutan prioritasnya: **form tampil duluan secara default**, dan pengecekan sesi berjalan di belakang layar cuma untuk menangani kasus "ternyata sudah login" (lalu diarahkan ke dashboard) — bukan menahan form muncul untuk semua orang demi kasus yang jarang ini.

### `src/components/MainApp.tsx`

```tsx
// SEBELUM
if (isAuthenticated === null) {
  return (
    <div className="min-h-screen ... flex items-center justify-center">
      <Loader2 className="animate-spin" />
      <p>Memverifikasi Sesi Admin...</p>
    </div>
  )
}

if (isAuthenticated === false) {
  return <AdminLoginScreen initialMode={authInitialMode} ... />
}
```

```tsx
// SESUDAH
// Halaman /register dan /login: tampilkan form LANGSUNG, jangan tunggu isAuthenticated resolve.
// Cek sesi tetap jalan di background (lihat useEffect checkSession yang sudah ada) --
// begitu ketahuan user TERNYATA sudah login, baru redirect ke dashboard.
if (initialView === "register" || initialView === "login") {
  if (isAuthenticated === true) {
    router.replace("/dashboard")
    return null   // render kosong sesaat sebelum redirect selesai, bukan loading screen panjang
  }
  return (
    <AdminLoginScreen
      initialMode={authInitialMode}
      onLoginSuccess={(_token, user) => {
        setAdminUser(user)
        setIsAuthenticated(true)
        fetchSubscription()
        router.push("/dashboard")
      }}
      onBackToLanding={() => {
        setShowLanding(true)
        router.push("/")
      }}
    />
  )
}

// Untuk /dashboard dan rute lain yang MEMANG butuh sesi valid, logika lama tetap dipakai --
// di situ menunggu isAuthenticated memang perlu, karena kalau belum login harus diarahkan ke login dulu.
if (isAuthenticated === null) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans">
      <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      <p className="text-xs font-semibold text-slate-400">Memuat Dashboard...</p>
    </div>
  )
}

if (isAuthenticated === false) {
  return <AdminLoginScreen initialMode={authInitialMode} ... />
}
```

### Kenapa ini aman

- Form register/login memang dirancang untuk pengunjung **tanpa** sesi — menampilkannya dulu sebelum tahu status sesi bukan kebocoran apa pun (formnya sendiri tidak mengandung data sensitif, cuma input kosong).
- Kalau ternyata pengunjung memang sudah login (kasus jarang: buka `/register` di tab baru padahal sedang login di tab lain), begitu `checkSession()` selesai dan `isAuthenticated` jadi `true`, langsung di-redirect ke `/dashboard` — tidak ada celah "form register kepakai dobel" atau semacamnya, cuma tertunda sepersekian detik sampai fetch selesai (dan selama itu, form yang tampil toh cuma form kosong, tidak berbahaya dilihat sebentar).
- Halaman yang **memang butuh** sesi valid (`/dashboard` dan seluruh isinya) tidak berubah sama sekali — tetap menunggu `isAuthenticated` resolve dulu seperti sebelumnya, karena di situ menunggu memang perlu (tidak masuk akal render dashboard duluan baru ketahuan belum login).

## Rekap 2 Perbaikan Sebelumnya yang Masih Tertunda

Saat mengecek ulang, dua perbaikan dari sesi sebelumnya **belum di-deploy** (dokumennya sempat terhapus dari repo, tapi kodenya juga belum diubah):

| Perbaikan | Lokasi | Status |
|---|---|---|
| Footer "Buka Dashboard →" tampil ke semua orang tanpa cek login | `IntroductionDashboard.tsx` baris ~1246 | ❌ Belum diperbaiki |
| Metadata Open Graph mengarah ke `scota.id`, bukan `scota.web.id` | `layout.tsx` baris 21 & 52 | ❌ Belum diperbaiki |

Detail lengkap kedua fix ini (kode persis yang perlu diganti) ada di riwayat percakapan sebelumnya — cukup diterapkan kapan pun sempat, tidak saling bergantung dengan perbaikan loading screen di dokumen ini.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/components/MainApp.tsx` | Tambah cabang khusus untuk `initialView === "register" \| "login"` yang render form langsung, redirect ke dashboard di background kalau ternyata sudah login |

## Checklist Verifikasi

- [ ] Buka `/register` di mode incognito (pasti belum login) → form pendaftaran langsung muncul, tidak ada teks "Memverifikasi Sesi Admin..." yang terlihat
- [ ] Buka `/login` sama → form login langsung muncul
- [ ] Login dulu di satu tab, lalu buka `/register` di tab baru → otomatis ter-redirect ke `/dashboard`, tidak nyangkut di form register
- [ ] Buka `/dashboard` tanpa login → perilaku lama tetap sama (loading sebentar, lalu diarahkan ke `AdminLoginScreen`)
- [ ] `curl -s https://scota.web.id/register` (tanpa menjalankan JS) → HTML yang dikembalikan sudah memuat elemen form, bukan cuma teks loading

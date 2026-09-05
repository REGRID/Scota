# Perbaikan `parse-receipt`: Info Disclosure & Proxy API Key Terbuka

## Masalah 1 — Pesan Error Membocorkan Detail Konfigurasi Server

`src/app/api/parse-receipt/route.ts` baris 159:

```ts
if (!apiKey || apiKey.length < 10) {
  return NextResponse.json(
    {
      error: "INVALID_API_KEY",
      message: "Kunci GEMINI_API_KEY belum dikonfigurasi di lingkungan server (.env.local) atau Vercel. Silakan buat API Key gratis di https://aistudio.google.com/app/apikey",
    },
    { status: 400 }
  )
}
```

Pesan ini dikirim mentah-mentah ke browser siapa pun yang mencoba fitur scan — termasuk nama persis environment variable (`GEMINI_API_KEY`), lokasi file konfigurasi (`.env.local`), dan platform hosting (Vercel). Ini bukan celah yang langsung dieksploitasi, tapi memberi info internal cuma-cuma ke siapa pun yang iseng mencoba endpoint publik ini.

### Solusi

Pisahkan pesan **untuk log server** (detail teknis lengkap, berguna buat developer debug) dari pesan **untuk pengguna** (generik, tidak membocorkan apa pun):

```ts
if (!apiKey || apiKey.length < 10) {
  console.error("[parse-receipt] GEMINI_API_KEY tidak ditemukan di environment server.")
  return NextResponse.json(
    {
      error: "SERVICE_UNAVAILABLE",
      message: "Layanan pemindaian sedang tidak tersedia. Silakan coba lagi beberapa saat lagi.",
    },
    { status: 503 }
  )
}
```

Terapkan pola yang sama di baris 69 (`GOOGLE_API_KEY_INVALID`) dan baris 79 (`MODEL_NOT_FOUND`) — keduanya juga saat ini mengirim detail teknis (nama model, instruksi bikin API key) langsung ke client:

```ts
// SEBELUM (baris 69)
const invalidErr = new Error("GOOGLE_API_KEY_INVALID: API Key tidak valid. Silakan buat API Key gratis di https://aistudio.google.com/app/apikey")

// SESUDAH
console.error("[parse-receipt] API Key Gemini tidak valid (dari server atau client).")
const invalidErr = new Error("GOOGLE_API_KEY_INVALID")
;(invalidErr as any).userMessage = "Layanan pemindaian sedang bermasalah. Tim kami sudah diberitahu."
```

Lalu di titik yang menangkap error ini (baris ~251), kirim `userMessage` yang generik ke client, bukan `err.message` mentah:

```ts
if (err.message?.includes("GOOGLE_API_KEY_INVALID")) {
  return NextResponse.json({ error: "SERVICE_UNAVAILABLE", message: err.userMessage || "Layanan pemindaian sedang bermasalah." }, { status: 503 })
}
```

**Pengecualian yang boleh tetap ditampilkan ke user**: pesan soal ukuran gambar terlalu besar (baris 212) atau kuota harian habis (baris 107) — ini bukan detail konfigurasi server, tapi informasi yang memang relevan buat pengguna supaya tahu apa yang harus dilakukan.

## Masalah 2 — Endpoint Publik Bisa Dipakai Jadi Proxy API Key Siapa Saja

```ts
const apiKey =
  req.headers.get("x-gemini-api-key") ||
  clientApiKey ||
  process.env.GEMINI_API_KEY
```

Endpoint ini **publik** (tidak perlu login, cuma dibatasi rate limit 2x/hari per IP). Tapi baris di atas menerima API key Gemini dari **siapa pun** yang mengirim header `x-gemini-api-key` atau field `apiKey` — kalau ada yang dikirim, server memakainya untuk memanggil Gemini, bukan pakai key milik server sendiri.

Fitur "bawa API key sendiri" ini sebenarnya legitimate — dipakai `ApiKeyModal.tsx` supaya pengguna bisa pakai kuota Gemini miliknya sendiri (disimpan di `localStorage`, dikirim tiap request). Masalahnya, karena endpoint ini publik, **siapa pun di internet** bisa memakai server Scota sebagai perantara untuk memanggil Gemini API pakai API key apa pun yang mereka kirim — termasuk key curian/bocor yang ingin mereka tes validitasnya, tanpa perlu login ke Scota sama sekali. Traffic itu akan tercatat datang dari IP server Scota, bukan dari mereka.

### Solusi

Batasi jalur `clientApiKey`/`x-gemini-api-key` **hanya untuk request yang sudah login** — pengguna anonim (termasuk demo) selalu pakai key milik server (yang sudah dilindungi rate limit & kuota). Pengguna yang sudah login tetap boleh pakai key mereka sendiri (fitur `ApiKeyModal` tetap jalan untuk mereka, itu tanggung jawab & kuota mereka sendiri):

```ts
import { getSession } from "@/lib/authHelper"

// ...di dalam POST, setelah parsing body...

const session = await getSession(req) // boleh null -- endpoint ini tetap publik untuk demo

const rawClientApiKey = req.headers.get("x-gemini-api-key") || clientApiKey

// Kunci milik client HANYA dipakai kalau request datang dari sesi yang sudah login.
// Pengguna anonim/demo TIDAK BOLEH mengarahkan key sembarangan lewat server ini.
const apiKey = (session ? rawClientApiKey : "") || process.env.GEMINI_API_KEY

if (!session && rawClientApiKey) {
  console.warn(`[parse-receipt] Percobaan kirim API key custom dari request anonim, diabaikan. IP: ${cleanIp}`)
}
```

Dengan ini:
- Request anonim (landing page, demo) **selalu** pakai `GEMINI_API_KEY` milik server — tidak bisa dipakai buat menyalurkan key orang lain.
- Pengguna yang sudah login tetap bisa pakai key sendiri lewat `ApiKeyModal` seperti biasa, karena mereka sudah teridentifikasi (bukan anonim di internet).

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/api/parse-receipt/route.ts` | Pesan error ke client dibuat generik (detail lengkap cukup di `console.error`); `clientApiKey`/`x-gemini-api-key` hanya dipakai kalau ada sesi login |

## Catatan Penting

- Ini tidak menghapus fitur "bawa API key sendiri" — cuma membatasi siapa yang boleh memakainya lewat endpoint ini. Pengguna yang login tetap dapat manfaatnya penuh.
- Setelah perubahan ini, `ApiKeyModal.tsx` di halaman yang bisa diakses tanpa login (kalau ada) sebaiknya juga disembunyikan/dinonaktifkan, supaya tidak membingungkan pengguna anonim yang mengisi key tapi ternyata tidak pernah benar-benar dipakai.

## Checklist Verifikasi

- [ ] Matikan `GEMINI_API_KEY` di server (sementara, untuk tes) → pesan ke user jadi generik ("Layanan sedang tidak tersedia"), detail lengkap cuma muncul di log server
- [ ] Kirim `parse-receipt` dari request **tanpa login** dengan header `x-gemini-api-key: <key-apa-pun>` → server tetap pakai `GEMINI_API_KEY` miliknya sendiri, key yang dikirim diabaikan
- [ ] Login lalu kirim `parse-receipt` dengan `x-gemini-api-key` milik sendiri (dari `ApiKeyModal`) → key tersebut yang dipakai, fitur BYOK tetap jalan normal untuk pengguna yang login
- [ ] Cek log server saat error API key → detail lengkap (nama env var, dll) tetap tercatat untuk keperluan debug, tapi tidak pernah dikirim ke response client

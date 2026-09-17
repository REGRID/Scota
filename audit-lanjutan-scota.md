# Audit Lanjutan — Scota (Kualitas Kode, "Sandwich Code", Fitur & Verifikasi Temuan Lama)

**Repo:** `REGRID/Scota` · **Live:** `scota.web.id`
**Cakupan:** verifikasi 6 temuan dari `audit-keamanan-scota-lengkap.md`, plus audit baru untuk kode aneh/berlapis, celah keamanan baru, dan fitur yang tidak maksimal.

---

## 1. Verifikasi Temuan Audit Sebelumnya

Ada file `audit-keamanan-scota-lengkap.md` di repo dari audit sebelumnya. Saya cek satu-satu apakah sudah diperbaiki di kode saat ini:

| # | Temuan Lama | Status Sekarang |
|---|---|---|
| 1 | VAPID private key hardcoded | ✅ **Sudah fix** — sekarang murni dari `process.env`, fail-closed dengan warning kalau kosong |
| 2 | POS webhook secret hardcoded | ✅ **Sudah fix** — sama, fail-closed |
| 3 | Broadcast push lintas-tenant | ✅ **Sudah fix** — `push/test/route.ts` sekarang pakai `requireRole(["OWNER","ADMIN"])`, kirim `tenantId`, validasi `url` harus path internal, batas panjang title/message |
| 4 | Spoofing IP untuk skip kuota demo | ✅ **Sudah fix** — ada `getClientIp()` terpusat di `rateLimiter.ts`, prioritas `x-vercel-forwarded-for` → nilai **terakhir** dari `x-forwarded-for` → `x-real-ip`, lengkap dengan komentar peringatan supaya tidak diubah balik lagi |
| 5 | `/api/settings(.*)` & `/api/tenants(.*)` di daftar rute publik | ✅ **Sudah fix** — kedua pola sudah tidak ada lagi di `isPublicRoute` |
| 6 | `pos/test-sync` tanpa batasan role | ✅ **Sudah fix** — sekarang pakai `requireRole(["OWNER","ADMIN"])` |

Bagus — semua 6 temuan lama sudah ditangani dengan benar, termasuk detail teknisnya (fail-closed, bukan cuma tutup celah tapi juga cegah regresi). Sekarang ke temuan baru dari audit kali ini.

---

## 2. Temuan Baru — Keamanan

### 🟠 2.1 Token sesi disimpan di `localStorage`, menggerus proteksi httpOnly cookie

**File:** `src/app/api/auth/login/route.ts` + `MainApp.tsx`, `IntroductionDashboard.tsx`, `settings/page.tsx`, `pricing/page.tsx`

Saat login berhasil, server dengan benar mengirim session token sebagai **httpOnly cookie** (`nota_admin_session`) — cookie ini tidak bisa dibaca oleh JavaScript, jadi aman dari XSS. Tapi di respons JSON yang sama, token mentahnya juga dikirim (`token: sessionToken`), dan di sisi client token itu disimpan lagi ke `localStorage.setItem("nota_admin_token", ...)` di 4 tempat berbeda, lalu dipakai sebagai `Authorization: Bearer` di request berikutnya.

**Kenapa ini masalah:** ini menghilangkan manfaat utama httpOnly cookie. Kalau suatu saat ada celah XSS di mana pun di aplikasi (form nota, nama staf, catatan, dll — banyak titik input user di app pencatatan nota), skrip penyerang tinggal `localStorage.getItem("nota_admin_token")` untuk mencuri sesi penuh, alih-alih harus mencari cara mencuri cookie yang sudah dilindungi. Dua mekanisme (cookie + localStorage) berjalan berdampingan, padahal cookie httpOnly saja sudah cukup untuk semua request browser normal.

**Saran:** pakai cookie httpOnly sebagai satu-satunya mekanisme sesi untuk browser. Kalau `Authorization: Bearer` di localStorage dipakai untuk kasus lain (mis. akses dari luar browser/mobile wrapper), pisahkan jalurnya dan jangan taruh token itu di localStorage untuk sesi web biasa.

### 🟡 2.2 Superadmin diidentifikasi lewat env var `NEXT_PUBLIC_*`

**File:** `src/lib/superadmin.ts` (baris 125, 294, 328), `src/lib/subscriptionServer.ts` (baris 37)

Email superadmin utama diambil dari `process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL`. Prefix `NEXT_PUBLIC_` di Next.js berarti nilainya **ikut ter-bundle ke JS yang dikirim ke browser** — bisa dilihat siapa pun lewat "view source" / devtools. Untuk hal murni informatif ini tidak masalah, tapi di sini nilainya dipakai untuk logika otorisasi (`isSuperadminEmail`). Mengetahui email superadmin saja tidak langsung membuka akses (masih perlu password/sesi valid), tapi ini pola yang berisiko: variabel yang seharusnya rahasia arsitektural malah otomatis publik karena salah prefix.

**Saran:** ganti ke `SUPERADMIN_EMAIL` (tanpa `NEXT_PUBLIC_`) supaya tidak ter-bundle ke client, lalu cari semua pemakaian dan sesuaikan.

---

## 3. "Sandwich Code" & Cara Kerja yang Aneh

### 🔴 3.1 Dua pipeline OCR berjalan paralel di setiap scan — satu di antaranya nyaris tidak berguna

**File:** `src/components/MainApp.tsx` baris ~576-590, `src/lib/ocr.ts`

Setiap kali user scan nota, ada **dua** proses OCR yang jalan bersamaan:

1. `/api/parse-receipt` → server-side, pakai Gemini AI (`@google/genai`) — ini yang benar-benar mem-parsing nota jadi data terstruktur (item, harga, total). Hasil inilah yang dipakai aplikasi.
2. `extractTextFromReceipt()` → **client-side**, pakai Tesseract.js (OCR berbasis WASM, berat, butuh download model bahasa) — dipanggil di baris yang sama, paralel dengan #1.

Saya telusuri hasil dari proses kedua (`rawOcrText`) ternyata **hanya dipakai untuk menampilkan panel "Teks mentah" di layar verifikasi** (`VerificationSplitScreen.tsx` baris 707) — sekadar referensi visual, bukan bagian dari logika bisnis.

**Kenapa ini "sandwich code":** ini pola khas sisa migrasi — dulu kemungkinan Tesseract.js adalah mesin OCR utama, lalu diganti ke Gemini AI, tapi kode lama tidak dihapus, cuma "dibungkus ulang" jadi fitur sampingan. Akibatnya:
- Setiap scan nota membebani CPU/baterai HP pengguna dua kali lipat dari yang seharusnya (WASM OCR itu berat, bisa makan beberapa detik di HP low-end).
- Bundle aplikasi ikut membawa Tesseract.js + model bahasa yang cukup besar, padahal manfaatnya cuma panel referensi.
- Kalau `extractTextFromReceipt` gagal, fallback-nya cuma teks generik `"Nota Belanja"` — jadi panel itu sering tidak akurat juga.

**Saran:** kalau panel "teks mentah" memang mau dipertahankan, minta Gemini API mengembalikan raw text sekalian di response yang sama (satu API call, bukan dua pipeline OCR terpisah). Kalau tidak penting, hapus saja Tesseract.js dari dependency — akan mengurangi ukuran bundle dan beban device pengguna secara nyata.

### 🟡 3.2 Sistem sesi berlapis (Clerk + JWT custom lama) berjalan bersamaan di semua endpoint

**File:** `src/lib/authHelper.ts`, `src/lib/clerkBridge.ts`, `src/middleware.ts`

Kode ini sendiri menyebutnya "Multi-layer Session Resolver" — setiap request dicek lewat **3 jalur** berurutan: (1) cookie/token JWT legacy custom, (2) Clerk JWT lewat Bearer token, (3) Clerk session via `auth()`. Ini didokumentasikan sebagai transisi dari sistem auth lama ke Clerk, jadi bukan bug — tapi ini menambah permukaan serangan (3 jalur auth berarti 3 tempat yang harus benar semua) dan kompleksitas yang harus dijaga konsisten di setiap endpoint baru. Selama migrasi belum tuntas ini memang perlu, tapi sebaiknya jadi item roadmap: pilih satu sistem final (kemungkinan besar Clerk) dan matikan jalur lama begitu semua akun lama sudah dimigrasikan — supaya "kompleksitas sementara" ini tidak jadi permanen.

### 🟡 3.3 Pemilihan email pengguna baru Clerk mengutamakan yang mengandung kata "dev"

**File:** `src/lib/clerkBridge.ts` baris 27-29

```ts
const email =
  user.emailAddresses?.find((e: any) => e.emailAddress?.includes("dev"))?.emailAddress ||
  user.emailAddresses?.[0]?.emailAddress ||
  ""
```

Saat user baru dari Clerk di-provision ke database, kode ini **mencari email mana pun yang mengandung substring `"dev"`** dan mengutamakannya di atas email utama/primer user. Ini terlihat seperti sisa kode debugging (mungkin dulu dipakai untuk menguji dengan akun ber-email `+dev` atau domain internal) yang lolos ke produksi.

**Dampak nyata:** kalau seorang user punya lebih dari satu email terdaftar di Clerk, dan salah satunya kebetulan mengandung "dev" di mana pun (contoh: `steven@devcorp.id`, atau `devi.lestari@gmail.com`), sistem akan salah pilih — bukan email utama akun mereka — untuk pencocokan data di tabel `admin_accounts`/`users`. Ini bisa menyebabkan akun ganda atau salah pemetaan tenant.

**Saran:** hapus prioritas `"dev"` ini, langsung pakai `user.primaryEmailAddress?.emailAddress` (field resmi dari Clerk) sebagai sumber utama.

---

## 4. Fitur yang Tidak Maksimal / Perlu Perhatian

- **Panel "teks mentah" OCR** (lihat 3.1) — fiturnya sendiri tidak salah, tapi cara implementasinya boros resource untuk manfaat yang kecil.
- **Folder `scripts/` menumpuk ~30 file migrasi & test one-off** (`migrate-004-dynamic-roles.ts`, `run-migration-006.js` s/d `011`, `reconcile-tenant-migration.js`, dll). Ini wajar untuk proyek yang sedang aktif migrasi skema tenant, tapi kalau migrasi sudah stabil di produksi, ini layak dirapikan/diarsipkan supaya tidak membingungkan kontributor baru soal mana skrip yang masih relevan dijalankan dan mana yang sudah usang.
- **Repo bersifat publik** dengan file audit keamanan lengkap (termasuk detail arsitektur auth, nama tabel, dan pola query) ikut ter-commit di dalamnya. Ini bagus untuk transparansi/dokumentasi, tapi juga berarti siapa pun bisa mempelajari persis bagaimana sistem otorisasi bekerja untuk mencari celah baru. Pertimbangkan repo privat, atau minimal jangan commit laporan audit detail ke repo publik yang sama.

---

## 5. Ringkasan Prioritas

| Prioritas | Item | Effort |
|---|---|---|
| 🔴 Tinggi | Hapus/refactor pipeline Tesseract.js paralel (3.1) | Sedang |
| 🟠 Sedang | Hilangkan token dari localStorage, andalkan httpOnly cookie saja (2.1) | Sedang |
| 🟡 Rendah | Ganti `NEXT_PUBLIC_SUPERADMIN_EMAIL` → non-public env var (2.2) | Kecil |
| 🟡 Rendah | Hapus logika prioritas email "dev" di `clerkBridge.ts` (3.3) | Kecil |
| 🟡 Rendah | Rencanakan penonaktifan jalur auth legacy setelah migrasi Clerk selesai (3.2) | Besar (roadmap) |
| 🟡 Rendah | Bersihkan/arsipkan skrip migrasi lama di `scripts/` | Kecil |

Tidak ditemukan celah SQL injection baru (interpolasi dinamis di query sudah diperiksa dan aman, termasuk penamaan schema per-tenant yang sudah divalidasi lewat regex whitelist), dan indexing tabel besar (`receipts`) untuk `tenantId` sudah ada.

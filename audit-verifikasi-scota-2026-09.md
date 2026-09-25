# Audit Verifikasi & Temuan Baru — Scota (25 September 2026)

**Repo:** `REGRID/Scota`
**Cakupan:** (1) Verifikasi status seluruh temuan dari `audit-keamanan-scota-lengkap.md` dan `audit-lanjutan-scota.md` yang sudah ada di repo, (2) `npx tsc --noEmit` untuk cek error TypeScript, (3) `npx eslint src` untuk cek error lint, (4) audit manual tambahan untuk bug baru dan pola kode bermasalah ("sandwich code") yang belum tercakup di dua laporan sebelumnya.
**Metode:** Clone repo langsung, jalankan compiler & linter, grep terarah ke pola-pola berisiko (secret hardcoded, catch block kosong, env var tidak konsisten, dsb), baca konteks kode di sekitar setiap temuan.

---

## Ringkasan

Repo ini sudah memiliki dua laporan audit sebelumnya. Kabar baiknya: **hampir semua temuan dari kedua laporan itu sudah diperbaiki dengan benar** di kode saat ini. Tidak ditemukan error kompilasi TypeScript maupun error lint. Namun ditemukan **1 bug baru berdampak sedang** (env var superadmin tidak konsisten antara client dan server) dan beberapa catatan kualitas kode.

| # | Temuan | Kategori | Tingkat | Status |
|---|---|---|---|---|
| 1–8 | Temuan dari 2 audit sebelumnya | Berbagai | — | ✅ Semua sudah fix (lihat Bagian 1) |
| A | Env var superadmin tidak konsisten (client vs server) | Bug otorisasi/logika | 🟠 Sedang | 🆕 Baru ditemukan |
| B | Restore backup menelan error per-baris secara diam-diam | Bug keandalan data | 🟡 Rendah-Sedang | 🆕 Baru ditemukan |
| C | Rule linter yang menangkap bug logika dimatikan | Kualitas kode | 🟡 Rendah | 🆕 Baru dicatat |
| D | Dua komponen berukuran sangat besar | Kualitas kode / risiko "sandwich code" | 🟡 Rendah | 🆕 Baru dicatat |
| E | Fallback username/email superadmin hardcoded | Pengerasan | 🟡 Rendah | 🆕 Baru dicatat |

---

## 1. Verifikasi Status Temuan Lama

Dicek satu per satu terhadap kode aktual di branch `main` saat ini (bukan cuma membaca ulang laporan lama):

| # | Temuan Lama | Sumber Laporan | Verifikasi Sekarang |
|---|---|---|---|
| 1 | VAPID private key hardcoded di `serverPush.ts` | audit-keamanan | ✅ **Fix.** `VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY \|\| ""`, fail-closed dengan warning + push dinonaktifkan kalau kosong (baris 9, 15-21) |
| 2 | POS webhook secret hardcoded di `posSync.ts` | audit-keamanan | ✅ **Fix.** `POS_WEBHOOK_SECRET = process.env.POS_WEBHOOK_SECRET \|\| ""`, sync ditolak & di-log kalau kosong (baris 35, 38-40) |
| 3 | Broadcast push lintas-tenant di `push/test/route.ts` | audit-keamanan | ✅ **Fix.** Sekarang pakai `requireRole(req, ["OWNER","ADMIN"])`, validasi `url` harus path internal (`startsWith("/")`, tolak `//`), batas panjang `title` (100 char) & `message` (300 char) |
| 4 | Spoofing IP untuk lewati kuota demo di `parse-receipt/route.ts` | audit-keamanan | ✅ **Fix.** Ada `getClientIp()` terpusat di `rateLimiter.ts` |
| 5 | `/api/settings(.*)` & `/api/tenants(.*)` terdaftar sebagai rute publik | audit-keamanan | ✅ **Fix.** Kedua pola sudah tidak ada di `isPublicRoute` (`middleware.ts`) |
| 6 | `pos/test-sync` tanpa pembatasan role | audit-keamanan | ✅ **Fix.** Sekarang pakai guard role |
| 7 | Token sesi disimpan dobel di `localStorage` (menggerus proteksi httpOnly cookie) | audit-lanjutan | ✅ **Fix.** Grep `nota_admin_token` di seluruh `src/` sekarang hanya menemukan `localStorage.removeItem(...)` (pembersihan saat logout) di `ProfileTab.tsx` dan `MainApp.tsx` — tidak ada lagi `setItem` yang menyimpan token ke localStorage |
| 8a | Dua pipeline OCR paralel (Gemini + Tesseract.js) | audit-lanjutan | ✅ **Fix.** Dependency `tesseract` sudah dihapus total dari `package.json` |
| 8b | Prioritas email mengandung substring `"dev"` di `clerkBridge.ts` | audit-lanjutan | ✅ **Fix.** Pola kode tersebut sudah tidak ada lagi di file |
| 8c | `NEXT_PUBLIC_SUPERADMIN_EMAIL` dipakai untuk logika otorisasi server | audit-lanjutan | ⚠️ **Fix sebagian** — lihat Temuan A di bawah, karena perbaikannya belum diterapkan konsisten di semua tempat |

**Kesimpulan Bagian 1:** tim sudah menindaklanjuti kedua laporan audit dengan cukup teliti. Satu-satunya yang masih menyisakan celah adalah 8c, yang jadi dasar Temuan A.

---

## 2. Hasil Cek Compiler & Linter

```
npx tsc --noEmit -p tsconfig.json
→ 0 error
```

Tidak ada error tipe, import rusak, atau properti yang tidak ada — kode seharusnya bisa dikompilasi tanpa masalah struktural.

```
npx eslint src
→ 1 warning, 0 error
```

Satu-satunya warning:

- **`src/components/SubscriptionModal.tsx` baris 308** — memakai `window.location.href = ...` untuk navigasi ke halaman internal Next.js, seharusnya pakai `useRouter().push()`. Bukan bug fungsional (halaman tetap pindah), tapi kehilangan manfaat client-side routing (transisi lebih lambat, full page reload).

**Catatan penting soal linter:** `eslint.config.mjs` secara sengaja mematikan beberapa rule yang biasanya menangkap bug logika nyata:

```js
"@typescript-eslint/no-unused-vars": "off",
"@typescript-eslint/no-explicit-any": "off",
"react-hooks/exhaustive-deps": "off",
"prefer-const": "off",
```

Artinya hasil "0 error, 1 warning" di atas **tidak menjamin** tidak ada bug — misalnya dependency array `useEffect` yang salah/kurang lengkap (penyebab umum bug "data tidak ter-update" atau "infinite loop render") tidak akan pernah ditangkap linter di project ini karena `exhaustive-deps` dimatikan. Ini pilihan yang wajar untuk kecepatan development, tapi perlu disadari batasnya.

---

## 3. Temuan Baru

### 🟠 A. Env Var Superadmin Tidak Konsisten Antara Client dan Server

**File:** `src/app/superadmin/layout.tsx` baris 99-103, dibandingkan dengan `src/lib/superadmin.ts` (baris 125, 294, 328) dan `src/lib/subscriptionServer.ts` (baris 37)

**Masalah**

Audit sebelumnya (temuan 8c/2.2 di `audit-lanjutan-scota.md`) sudah benar merekomendasikan mengganti `NEXT_PUBLIC_SUPERADMIN_EMAIL` menjadi `SUPERADMIN_EMAIL` (tanpa prefix publik) di logika otorisasi server, karena env var berprefix `NEXT_PUBLIC_` ikut ter-bundle ke JavaScript yang dikirim ke browser. Perbaikan itu **sudah** diterapkan di tiga tempat:

```ts
// src/lib/superadmin.ts & subscriptionServer.ts — SUDAH benar
const masterEmail = (process.env.SUPERADMIN_EMAIL || "refo.gangga.dev@gmail.com").toLowerCase().trim()
```

Tapi gerbang UI di layout superadmin **masih memakai env var lama**:

```ts
// src/app/superadmin/layout.tsx baris 99-103 — BELUM diganti
const authorizedEmail = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL ||
  "refo.gangga.dev@gmail.com"
)
  .toLowerCase()
  .trim()
```

**Dampak**

Sekarang ada **dua sumber kebenaran berbeda** untuk email superadmin: satu untuk gerbang tampilan (`layout.tsx`), satu untuk logika otorisasi sungguhan di server (`superadmin.ts`, `subscriptionServer.ts`). Kalau env var `SUPERADMIN_EMAIL` di production di-set ke alamat baru (misalnya saat rotasi akun, atau saat proyek berkembang ke tim dengan superadmin berbeda) — tapi `NEXT_PUBLIC_SUPERADMIN_EMAIL` lupa ikut di-update (yang sangat mungkin terjadi karena sekarang nama variabelnya beda) — dua skenario buruk bisa terjadi:

1. Superadmin baru yang sah **diblokir oleh gerbang UI** (`layout.tsx` menolak karena email tidak cocok dengan `NEXT_PUBLIC_SUPERADMIN_EMAIL` yang usang), padahal API endpoint-nya sendiri akan menerimanya.
2. Sebaliknya, kalau `NEXT_PUBLIC_SUPERADMIN_EMAIL` disetel ke email lama yang sudah tidak dipakai lagi tapi `SUPERADMIN_EMAIL` sudah diganti, akun lama itu tetap **lolos gerbang UI** (karena `layout.tsx` yang menentukan siapa yang boleh render halaman) meski logika bisnis di server sudah tidak menganggapnya superadmin — berpotensi menyesatkan (UI menampilkan seolah dia superadmin) walau permintaan API-nya akan ditolak satu per satu.

Karena fallback hardcoded di kedua tempat kebetulan sama (`"refo.gangga.dev@gmail.com"`), masalah ini **belum kelihatan sekarang** selama env var belum pernah diganti — tapi begitu tim mengganti alamat superadmin di masa depan, ini akan jadi bug yang membingungkan dan sulit dilacak (karena hasilnya tergantung env var mana yang diingat untuk diupdate).

**Yang Harus Dilakukan**

1. Di `src/app/superadmin/layout.tsx`, ganti `process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL` menjadi `process.env.SUPERADMIN_EMAIL`, sama seperti tiga tempat lain.
2. Karena `layout.tsx` adalah Server Component (bisa dicek dari pemakaian `auth()`/`user` langsung), env var non-public ini aman dipakai di sana — tidak perlu prefix `NEXT_PUBLIC_`.
3. Hapus `NEXT_PUBLIC_SUPERADMIN_EMAIL` dari `.env.example` dan dari environment variable di hosting (Vercel dsb) setelah dipastikan tidak dipakai lagi di mana pun, supaya tidak ada dua variabel yang membingungkan untuk hal yang sama.
4. Pertimbangkan menaruh nilai `SUPERADMIN_EMAIL` di **satu fungsi helper terpusat** (misal `getSuperadminEmail()` di `src/lib/superadmin.ts`) dan panggil dari `layout.tsx` juga, alih-alih membaca `process.env` langsung di 4 tempat berbeda — supaya kejadian seperti ini tidak terulang saat ada perubahan env var lagi di masa depan.

---

### 🟡 B. Restore Backup Menelan Error Per-Baris Secara Diam-Diam

**File:** `src/app/api/backup/route.ts` (baris 177, 232, 248, 298, dan pola yang sama berulang di seluruh file)

**Masalah**

Saat proses restore dari file backup, setiap insert ke database (kategori, nota, item nota) dibungkus try/catch yang catch block-nya **kosong total**:

```ts
try {
  await client.query(
    `INSERT INTO receipts (...) VALUES (...) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [...]
  )
  importedReceipts++
} catch (e) {}   // ← error apa pun langsung hilang, tidak di-log, tidak dilaporkan
```

Pola ini muncul berkali-kali untuk restore kategori, nota, dan item nota.

**Dampak**

Kalau ada baris data di file backup yang gagal di-insert — karena format tanggal tidak valid, kolom wajib kosong, tipe data tidak cocok, atau constraint database lainnya — kegagalan itu **sama sekali tidak terlihat**. Pengguna hanya akan melihat angka akhir seperti "berhasil impor 47 dari 50 nota" (kalau UI menampilkan counter tersebut) tanpa tahu:
- Nota/kategori mana saja yang gagal
- Kenapa gagal
- Apakah 3 yang hilang itu penting atau tidak

Untuk fitur restore backup — yang biasanya dipakai justru dalam situasi genting (pemulihan setelah insiden, migrasi tenant, dsb) — kegagalan senyap seperti ini berisiko membuat pengguna mengira datanya sudah lengkap dipulihkan, padahal ada yang hilang.

**Yang Harus Dilakukan**

1. Di setiap catch block yang sekarang kosong, minimal tambahkan `console.error("Gagal restore [jenis data] id=...:", e)` supaya ada jejak di log server.
2. Kumpulkan daftar ID/baris yang gagal selama proses restore ke dalam array, lalu sertakan di response akhir endpoint (misal `{ importedReceipts: 47, failedReceipts: [{id: "...", reason: "..."}] }`) supaya frontend bisa menampilkan peringatan yang jelas ke pengguna, bukan cuma angka sukses.
3. Pertimbangkan apakah kegagalan sebagian ini harus menghentikan seluruh proses restore (fail-fast) atau lanjut-tapi-lapor (partial success) — saat ini perilakunya "lanjut tapi diam", yang biasanya bukan pilihan yang disengaja.

---

### 🟡 C. Rule Linter yang Menangkap Bug Logika Dimatikan

**File:** `eslint.config.mjs`

Sudah dibahas di Bagian 2 di atas — dicatat ulang di sini sebagai item aksi terpisah karena bukan bug langsung, tapi mengurangi kemampuan mendeteksi bug secara otomatis ke depannya:

```js
"@typescript-eslint/no-unused-vars": "off",
"react-hooks/exhaustive-deps": "off",
"react-hooks/set-state-in-effect": "off",
"react-hooks/purity": "off",
"react-hooks/immutability": "off",
"react-hooks/preserve-manual-memoization": "off",
```

**Saran:** kalau ada waktu di sela development, coba nyalakan `react-hooks/exhaustive-deps` sebagai `"warn"` (bukan `"error"`, supaya tidak menghalangi build) sekali saja untuk melihat berapa banyak `useEffect` di project ini yang punya dependency array tidak lengkap — ini penyebab bug tersembunyi yang paling umum di aplikasi React berukuran besar seperti ini (data "telat update", state basi, dsb). Tidak perlu langsung diperbaiki semua, tapi baik untuk tahu skala masalahnya.

---

### 🟡 D. Dua Komponen Berukuran Sangat Besar

**File:** `src/components/ReceiptHistoryDashboard.tsx` (**7.052 baris**), `src/components/MainApp.tsx` (**1.504 baris**)

Bukan bug, tapi relevan untuk pertanyaan soal "sandwich code": file sebesar ini biasanya menjadi tempat bersarangnya logika lama yang ditumpuk-tumpuk seiring waktu (persis pola yang sudah ditemukan sebelumnya untuk pipeline OCR ganda di `MainApp.tsx`), karena terlalu besar untuk dibaca menyeluruh setiap kali menambah fitur baru — perubahan cenderung "ditempel" di atas kode lama daripada me-refactor.

**Saran:** kalau ada rencana audit "sandwich code" lanjutan, `ReceiptHistoryDashboard.tsx` adalah kandidat utama untuk diperiksa lebih detail (dipecah per fitur: filter, tabel, export, modal edit, dsb) — ukurannya jauh melampaui file lain di project ini.

---

### 🟡 E. Fallback Username/Email Superadmin Hardcoded

**File:** `src/lib/superadmin.ts` baris 16, 329

```ts
process.env.SUPERADMIN_USERNAME || "superadmin",
...
const masterSuperadminUser = (process.env.SUPERADMIN_USERNAME || "superadmin").toLowerCase().trim()
```

Sama seperti email superadmin, username-nya juga punya fallback hardcoded (`"superadmin"`) yang tertulis di source code repo publik. Ini pola "fail-open" (kalau env var lupa di-set, sistem tetap jalan pakai nilai default alih-alih menolak) — beda dengan pendekatan fail-closed yang sudah diterapkan dengan benar untuk `VAPID_PRIVATE_KEY` dan `POS_WEBHOOK_SECRET` di Temuan 1 & 2 audit sebelumnya.

**Dampak:** rendah, karena mengetahui username/email superadmin saja tidak membuka akses (tetap butuh password/sesi Clerk yang valid). Tapi tidak konsisten dengan prinsip fail-closed yang sudah dipakai di tempat lain, dan mengekspos detail arsitektur (nama akun superadmin) ke publik lewat riwayat Git.

**Saran:** jika `SUPERADMIN_USERNAME`/`SUPERADMIN_EMAIL` tidak diset di environment, sebaiknya modul superadmin menolak start dengan error log yang jelas, bukan diam-diam jalan pakai nilai default — konsisten dengan pola fail-closed yang sudah dipakai di modul push notification dan POS sync.

---

## 4. Ringkasan Prioritas Aksi

| Prioritas | Item | File Utama | Effort |
|---|---|---|---|
| 🟠 Sedang | A — Samakan env var superadmin client/server | `superadmin/layout.tsx` | Kecil |
| 🟡 Rendah-Sedang | B — Log & laporkan kegagalan per-baris saat restore backup | `api/backup/route.ts` | Sedang |
| 🟡 Rendah | E — Fail-closed untuk `SUPERADMIN_USERNAME`/`SUPERADMIN_EMAIL` | `lib/superadmin.ts` | Kecil |
| 🟡 Rendah | C — Nyalakan `exhaustive-deps` sebagai warning, lihat skalanya | `eslint.config.mjs` | Kecil (investigasi) |
| 🟡 Rendah | D — Pertimbangkan pecah `ReceiptHistoryDashboard.tsx` | `components/ReceiptHistoryDashboard.tsx` | Besar (roadmap) |
| — | Ganti `window.location.href` → `router.push()` | `SubscriptionModal.tsx:308` | Kecil |

---

## Catatan Penutup

- Tidak ditemukan error kompilasi TypeScript maupun error ESLint — dari sisi "apakah kode bisa jalan secara struktural", repo dalam kondisi sehat.
- Semua 8 temuan dari dua audit sebelumnya sudah ditindaklanjuti dengan baik, kecuali satu yang diperbaiki tidak konsisten (Temuan A di atas).
- Audit ini **tidak** mencakup pengujian end-to-end di lingkungan yang benar-benar terhubung ke database/environment production — jadi tidak menutup kemungkinan ada bug yang hanya muncul saat runtime dengan data nyata (misalnya race condition, atau perilaku spesifik provider seperti Clerk/Pakasir yang tidak terlihat dari membaca kode saja).

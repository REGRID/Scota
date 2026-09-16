# Laporan Audit Keamanan & Bug — Scota (September 2026)

**Repo:** `REGRID/Scota` (status: **publik** — siapa pun bisa membaca seluruh source code)
**Cakupan audit:** Seluruh `src/app/api/**` (53 endpoint), `src/lib/**`, `src/middleware.ts`, `database/schema.sql`
**Metode:** Pemetaan guard autentikasi per-endpoint, pelacakan aliran data lintas-tenant, pencarian interpolasi SQL, pencarian rahasia ter-hardcode

---

## Ringkasan Temuan

| # | Temuan | Kategori | Tingkat | Perlu Login? | Effort Perbaikan |
|---|---|---|---|---|---|
| 1 | Kunci privat VAPID (push) ter-hardcode di repo publik | Kebocoran rahasia | 🔴 **Kritis** | Tidak | Kecil (+ rotasi kunci) |
| 2 | Secret webhook POS ter-hardcode di repo publik | Kebocoran rahasia | 🔴 Kritis | Tidak | Kecil |
| 3 | Broadcast push notification lintas-tenant | Kebocoran otorisasi | 🔴 Tinggi | Ya (role apa pun) | Kecil |
| 4 | Batas scan gratis bisa dilewati via spoofing IP | Penyalahgunaan biaya | 🟠 Sedang-Tinggi | Tidak | Sedang |
| 5 | `/api/settings(.*)` & `/api/tenants(.*)` masuk daftar rute publik | Pengerasan | 🟠 Sedang | — | Kecil |
| 6 | Endpoint uji coba POS tanpa pembatasan role | Pengerasan | 🟡 Rendah | Ya | Kecil |

---

## ✅ Bagian yang Sudah Aman (Tidak Perlu Diubah)

Supaya jelas apa yang **tidak** perlu disentuh, berikut hasil pengecekan yang lolos:

- **Semua 7 endpoint superadmin** dilindungi ganda: middleware (`middleware.ts` baris 55-70) memverifikasi token + role `SUPERADMIN`, lalu route-nya sendiri memanggil `requireSuperadmin` lagi.
- **Sistem permission dinamis** (`src/lib/dynamicRoles.ts`): permission bertanda `isOwnerOnly = TRUE` ditolak secara eksplisit saat pembuatan custom role — pencegahan privilege escalation yang benar.
- **SQL injection:** seluruh interpolasi `${...}` ke dalam query sudah diperiksa satu per satu. `sortDirection` berasal dari whitelist (`order === "desc" ? "DESC" : "ASC"`), `limit` dipaksa numerik lewat `Math.min(Math.max(Number(...), 1), 1000)` sehingga input non-angka menghasilkan `NaN` yang bersifat falsy (klausa `LIMIT` tidak ikut terpasang). Tidak ditemukan celah injeksi.
- **Webhook pembayaran** (`api/webhooks/pakasir`): fail-closed (tanpa `PAKASIR_API_KEY`, webhook ditolak dengan 503), status pembayaran diverifikasi lewat panggilan balik ke gateway, dan ada pengecekan idempotensi.
- **Role lock** (Owner tidak boleh merangkap staf) terpusat rapi di `src/lib/roleLockGuard.ts`.
- **Isolasi tenant pada endpoint staf/undangan:** semua memakai `requirePermission(req, "manage_staff")` dan memfilter dengan `auth.tenantId`.
- **Tidak ada file `.env` yang ter-commit** — hanya `.env.example`.

---

# 🔴 Temuan 1 — Kunci Privat VAPID Ter-hardcode di Repo Publik

**File:** `src/lib/serverPush.ts` baris 9-11

## Masalah

```ts
export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "ZFrM4s75bYa7BITthm3kVzdKQtfQankA-Mwvhsd9TI0"
```

Kunci **privat** VAPID tertulis langsung sebagai nilai cadangan di source code, dan repo ini bersifat **publik** di GitHub.

## Kenapa Ini Kritis

Kunci privat VAPID adalah identitas kriptografis yang membuktikan "pengirim notifikasi ini benar-benar Scota". Dengan kunci ini di tangan, siapa pun di internet bisa:

- Mengirim push notification ke perangkat pengguna Scota **langsung ke server push browser** (FCM/Mozilla/Apple), **tanpa melewati aplikasi Scota sama sekali** — artinya semua perbaikan otorisasi di Temuan 3 pun tidak akan menghentikannya.
- Notifikasi akan tampil di HP korban sebagai notifikasi resmi dari domain Scota, lengkap dengan URL tujuan bebas (vektor phishing).

Penyerang masih perlu tahu *endpoint subscription* korban untuk mengirim, tapi kombinasi kunci bocor + Temuan 3 (yang membocorkan kemampuan broadcast) membuat risiko ini jauh lebih besar.

## Yang Harus Dilakukan

1. **Rotasi kunci VAPID** — generate pasangan kunci baru (`npx web-push generate-vapid-keys`). Ini **wajib**, karena kunci lama sudah ada di riwayat Git publik selamanya, tidak cukup hanya dihapus dari kode.
2. Simpan kunci baru **hanya** di environment variable (Vercel/hosting), jangan di kode.
3. Ubah kode supaya **fail-closed** — kalau env var tidak ada, jangan diam-diam pakai nilai cadangan, tapi catat error dan nonaktifkan fitur push.
4. **Konsekuensi yang harus disadari:** mengganti kunci VAPID membuat **semua subscription push yang sudah ada menjadi tidak valid**. Semua pengguna harus mendaftar ulang notifikasi. Sebaiknya tabel `push_subscriptions` dikosongkan setelah rotasi, dan pengguna diminta mengaktifkan ulang notifikasi dari halaman pengaturan.
5. Pertimbangkan membuat repo jadi **privat** kalau memang tidak ada alasan kuat untuk publik.

---

# 🔴 Temuan 2 — Secret Webhook POS Ter-hardcode

**File:** `src/lib/posSync.ts` baris 34

## Masalah

```ts
const POS_WEBHOOK_SECRET = process.env.POS_WEBHOOK_SECRET || "scota_pos_secret_key_2026"
```

Sama seperti Temuan 1: nilai rahasia tertulis di source code repo publik.

## Dampak

Secret ini dipakai untuk membuktikan ke sistem POS bahwa permintaan sinkronisasi benar-benar datang dari Scota. Dengan secret yang sudah diketahui publik, pihak lain bisa mengirim data stok/transaksi palsu ke sistem POS seolah-olah dari Scota.

## Yang Harus Dilakukan

1. Ganti secret dengan nilai baru yang acak dan panjang.
2. Simpan hanya di environment variable.
3. Buat kode fail-closed: kalau `POS_WEBHOOK_SECRET` tidak diset, fitur sinkronisasi POS dinonaktifkan dan dicatat di log — jangan pakai nilai cadangan.

---

# 🔴 Temuan 3 — Broadcast Push Notification Lintas-Tenant

**File:** `src/app/api/push/test/route.ts`, terkait `src/lib/serverPush.ts` baris 65-90

## Masalah

Endpoint memanggil fungsi pengiriman push **tanpa menyertakan `tenantId`**:

```ts
const result = await sendWebPushNotification({
  title,      // ← bebas dari body request
  message,    // ← bebas dari body request
  url,        // ← bebas dari body request
  tag: `test-push-${Date.now()}`,
})
```

Di `serverPush.ts`, filter tenant hanya diterapkan **kalau `tenantId` ada**:

```ts
if (tenantId) {
  params.push(tenantId)
  query += ` AND ("tenantId" = $${params.length} OR "tenantId" IS NULL)`
}
```

Karena `tenantId` bernilai `undefined`, kondisi ini dilewati — query akhirnya menjadi `SELECT ... FROM push_subscriptions WHERE 1=1`, yang mengambil **seluruh langganan push dari semua tenant**.

## Dampak

Pengguna login mana pun — termasuk `KARYAWAN` dengan hak akses paling rendah, di tenant mana pun — bisa mengirim satu permintaan dan menghasilkan notifikasi yang muncul di **HP seluruh pengguna Scota di semua tenant**, dengan judul, isi, dan **URL tujuan yang sepenuhnya dia tentukan sendiri**.

Ini merusak dua hal sekaligus: prinsip isolasi antar-tenant yang sudah susah payah dibangun di Fase 1-5, dan membuka vektor phishing (notifikasi tampak resmi dari Scota, tapi mengarah ke mana saja).

Middleware memang menahan yang belum login (`/api/push/*` tidak termasuk rute publik), tapi tidak membedakan role maupun tenant.

## Yang Harus Dilakukan

1. **Perbaiki akar masalah di `serverPush.ts`:** jadikan `tenantId` **wajib** di `SendPushOptions` (hapus tanda `?`). Kalau ada pemanggil yang benar-benar butuh broadcast global (misal pengumuman superadmin), buatkan opsi terpisah yang eksplisit seperti `scope: "GLOBAL"`, supaya broadcast lintas-tenant hanya terjadi ketika memang **disengaja dan tertulis jelas**, bukan sebagai efek samping parameter yang lupa diisi.
2. **Tambahkan guard** di `push/test/route.ts`: `requireRole(req, ["OWNER", "ADMIN"])`, lalu kirim `tenantId: auth.tenantId` ke fungsi push.
3. **Batasi isi notifikasi:** untuk endpoint yang bernama "test", parameter `url` sebaiknya tidak bebas sepenuhnya — paksa ke path internal (misal hanya menerima path yang diawali `/`, tolak URL absolut ke domain luar).
4. Periksa juga pemanggil `sendWebPushNotification` lain di seluruh kode setelah `tenantId` dijadikan wajib — TypeScript akan otomatis menunjukkan mana saja yang belum mengirimnya.

---

# 🟠 Temuan 4 — Batas Scan Gratis Bisa Dilewati via Spoofing IP

**File:** `src/app/api/parse-receipt/route.ts` baris 165-169

## Masalah

```ts
const rawIp =
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip") ||
  "127.0.0.1"
const cleanIp = normalizeIp(rawIp)
```

Kuota demo (2 scan/hari, 3 nota maksimal) dikunci berdasarkan IP pengunjung. Tapi IP-nya diambil dari header `X-Forwarded-For`, yang **dikirim oleh klien** dan bisa diisi nilai apa pun.

Kode mengambil **nilai pertama** dari daftar (`.split(",")[0]`). Pada arsitektur proxy/CDN, nilai yang dikirim klien berada di posisi paling depan, sedangkan IP asli yang ditambahkan oleh platform hosting berada di belakangnya. Jadi justru nilai yang dikontrol penyerang yang terpakai.

## Dampak

Penyerang cukup mengganti nilai header `X-Forwarded-For` di setiap permintaan untuk mendapat "identitas IP" baru terus-menerus, sehingga:

- Batas 2 scan/hari menjadi tidak berarti — OCR gratis tanpa batas.
- Endpoint ini **publik** (tidak perlu login sama sekali — terdaftar di `isPublicRoute` middleware) dan memanggil layanan OCR berbayar, sehingga ini **langsung membebani biaya operasional**.
- Setiap "IP" baru juga membuat baris tenant demo baru (`getOrCreateDemoTenant`), sehingga tabel `tenants` bisa membengkak dengan data sampah.

## Yang Harus Dilakukan

Karena aplikasi ini dijalankan di belakang proxy hosting, solusinya adalah **mengambil IP dari posisi yang tidak bisa dikontrol klien**:

1. **Kalau di Vercel:** gunakan header `x-vercel-forwarded-for` (diisi oleh platform, tidak bisa ditimpa klien) sebagai sumber utama, dengan `x-forwarded-for` hanya sebagai cadangan terakhir.
2. **Alternatif umum:** ambil nilai **terakhir** dari daftar `X-Forwarded-For`, bukan yang pertama — nilai terakhir adalah yang ditambahkan oleh proxy terdekat dengan server, sehingga lebih tepercaya. (Perlu disesuaikan dengan jumlah lapisan proxy yang dipakai.)
3. **Tambahkan lapisan kedua yang tidak bergantung IP sama sekali**, karena IP saja selalu bisa diakali (misal lewat botnet/proxy sungguhan). Opsi yang wajar untuk aplikasi ini: batasi juga total scan demo secara global per hari (misal maksimal N scan demo/hari untuk seluruh platform), sehingga kalaupun batas per-IP dilewati, kerugian biaya tetap ada plafonnya.
4. Pertimbangkan menambahkan verifikasi manusia (CAPTCHA) pada mode demo kalau penyalahgunaan terus terjadi.

---

# 🟠 Temuan 5 — Rute Sensitif Terdaftar Sebagai Publik di Middleware

**File:** `src/middleware.ts` baris 20 & 28

## Masalah

```ts
const isPublicRoute = createRouteMatcher([
  ...
  "/api/tenants(.*)",    // ← seluruh endpoint tenant
  "/api/settings(.*)",   // ← seluruh endpoint pengaturan
  ...
])
```

Kedua pola ini membuat middleware **melewatkan pengecekan autentikasi** untuk semua endpoint di bawahnya.

## Status Saat Ini: Belum Berbahaya, Tapi Rapuh

Saya periksa satu per satu, dan **semua** endpoint di bawah kedua path ini sudah punya guard sendiri di level route:

- `/api/settings/staff/*` → `requirePermission(req, "manage_staff")`
- `/api/settings/invites/*` → `requirePermission(req, "manage_staff")`
- `/api/settings/roles` → `requireRole(req, ["OWNER", "ADMIN"])` / `["OWNER"]`
- `/api/settings/features` → `requireRole(req, ["OWNER"])`
- `/api/tenants/create-branch` → `requireRole(req, ["OWNER"])`
- `/api/tenants/my-branches`, `switch-branch` → `getSession`

Jadi tidak ada kebocoran saat ini. **Masalahnya ada di masa depan:** konfigurasi ini menghapus lapisan pengaman kedua. Kalau nanti ada endpoint baru ditambahkan di bawah `/api/settings/...` dan lupa diberi guard, endpoint itu akan **langsung terbuka penuh ke internet** tanpa peringatan apa pun — persis pola kesalahan yang paling sering terjadi saat aplikasi berkembang cepat.

## Yang Harus Dilakukan

1. Hapus `"/api/settings(.*)"` dan `"/api/tenants(.*)"` dari daftar `isPublicRoute`.
2. Kalau ada **endpoint spesifik** di bawahnya yang memang harus publik, daftarkan hanya endpoint itu secara tepat (misal `"/api/tenants/public-info"`), bukan seluruh cabangnya dengan wildcard.
3. Setelah diubah, jalankan ulang seluruh alur aplikasi untuk memastikan tidak ada fitur yang rusak karena sekarang butuh sesi.

---

# 🟡 Temuan 6 — Endpoint Uji Coba POS Tanpa Pembatasan Role

**File:** `src/app/api/pos/test-sync/route.ts`

## Masalah

Endpoint tidak memanggil guard apa pun. Middleware menahan pengunjung yang belum login, tapi **pengguna login mana pun** (termasuk `KARYAWAN`) bisa memicu pengiriman data uji ke webhook POS berkali-kali.

## Dampak

Relatif kecil — data yang dikirim adalah payload uji statis, bukan data tenant sungguhan. Tapi bisa dipakai untuk membanjiri sistem POS dengan entri uji, dan tidak ada alasan seorang karyawan biasa perlu akses ke fungsi pengujian integrasi.

## Yang Harus Dilakukan

Tambahkan `requireRole(req, ["OWNER", "ADMIN"])` di awal handler, konsisten dengan endpoint pengaturan lain.

---

# Urutan Pengerjaan yang Disarankan

Dikelompokkan supaya bisa dikerjakan bertahap tanpa saling mengganggu:

| Tahap | Isi | Alasan urutan |
|---|---|---|
| **A** | Temuan 1 & 2 (rotasi rahasia) | Rahasia yang sudah bocor terus berisiko selama belum dirotasi — waktu berjalan melawan kita di sini |
| **B** | Temuan 3 (push lintas-tenant) | Perbaikan otorisasi terbesar; sebaiknya setelah Tahap A karena keduanya menyentuh sistem push yang sama |
| **C** | Temuan 5 & 6 (pengerasan) | Perubahan kecil, risiko rendah, tapi butuh pengujian alur menyeluruh |
| **D** | Temuan 4 (spoofing IP) | Paling butuh penyesuaian dengan platform hosting; kerjakan terakhir saat bisa diuji langsung di lingkungan produksi |

---

# Prompt Siap Pakai (Vibe Coding)

## Prompt A — Temuan 1 & 2: Hapus Rahasia Ter-hardcode

```
Ada dua rahasia yang ter-hardcode sebagai nilai cadangan (fallback) di
source code, padahal repo ini bersifat PUBLIK di GitHub. Perbaiki supaya
aplikasi fail-closed (menolak berjalan / menonaktifkan fitur terkait)
kalau environment variable tidak diset, bukan diam-diam memakai nilai
cadangan yang sudah bocor.

1. Di src/lib/serverPush.ts baris 9-11:
   export const VAPID_PRIVATE_KEY =
     process.env.VAPID_PRIVATE_KEY ||
     "ZFrM4s75bYa7BITthm3kVzdKQtfQankA-Mwvhsd9TI0"

   Hapus nilai cadangan tersebut. Kalau process.env.VAPID_PRIVATE_KEY
   tidak ada, jangan panggil webpush.setVapidDetails(), catat pesan error
   yang jelas di console, dan buat fungsi sendWebPushNotification()
   langsung mengembalikan { success: false, sentCount: 0, error: "..." }
   tanpa mencoba mengirim apa pun. Lakukan hal yang sama untuk
   VAPID_PUBLIC_KEY (boleh tetap ada nilai publik default karena sifatnya
   memang publik, tapi kalau privat tidak ada, fitur tetap harus mati).

2. Di src/lib/posSync.ts baris 34:
   const POS_WEBHOOK_SECRET = process.env.POS_WEBHOOK_SECRET ||
     "scota_pos_secret_key_2026"

   Hapus nilai cadangan tersebut. Kalau env var tidak diset, fungsi
   sinkronisasi POS harus menolak berjalan dengan pesan error yang jelas
   di log, bukan mengirim permintaan memakai secret yang sudah bocor.

3. Perbarui file .env.example, tambahkan entri untuk VAPID_PRIVATE_KEY,
   VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, dan POS_WEBHOOK_SECRET
   (isi dengan placeholder, JANGAN nilai asli), supaya jelas variabel apa
   saja yang wajib diset saat deploy.

4. Buat file catatan singkat docs/SECURITY-ROTATION.md yang menjelaskan
   langkah rotasi yang harus saya lakukan manual di luar kode:
   - Cara generate pasangan kunci VAPID baru (npx web-push
     generate-vapid-keys)
   - Peringatan bahwa mengganti kunci VAPID membuat SEMUA subscription
     push yang sudah ada tidak valid, sehingga tabel push_subscriptions
     sebaiknya dikosongkan dan pengguna diminta mengaktifkan ulang
     notifikasi dari halaman pengaturan
   - Pengingat mengganti POS_WEBHOOK_SECRET dengan nilai acak baru dan
     menyetelnya juga di sisi sistem POS

JANGAN mencoba menjalankan rotasi kunci secara otomatis - cukup siapkan
kodenya supaya membaca dari env var, saya yang akan mengatur nilainya.

Tunjukkan diff lengkap semua perubahan.
```

## Prompt B — Temuan 3: Perbaiki Broadcast Push Lintas-Tenant

```
Perbaiki celah otorisasi di sistem push notification yang memungkinkan
pengguna login mana pun (termasuk role KARYAWAN di tenant mana pun)
mengirim notifikasi ke SELURUH pengguna di SEMUA tenant, dengan judul,
isi, dan URL yang bebas ditentukan.

AKAR MASALAH:
Di src/app/api/push/test/route.ts, fungsi sendWebPushNotification()
dipanggil tanpa menyertakan tenantId. Di src/lib/serverPush.ts (sekitar
baris 79-86), filter tenant hanya diterapkan kalau tenantId ada:
  if (tenantId) { query += ` AND ("tenantId" = $... OR "tenantId" IS NULL)` }
Karena tenantId undefined, query menjadi "WHERE 1=1" yang mengambil
seluruh baris push_subscriptions dari semua tenant.

YANG HARUS DILAKUKAN:

1. Di src/lib/serverPush.ts, ubah interface SendPushOptions supaya
   tenantId menjadi WAJIB (hapus tanda tanya pada "tenantId?: string").
   Tambahkan juga field opsional baru: scope?: "TENANT" | "GLOBAL" yang
   default-nya "TENANT". Broadcast ke seluruh tenant HANYA boleh terjadi
   kalau scope secara eksplisit diisi "GLOBAL" - bukan sebagai efek
   samping dari tenantId yang lupa diisi. Sesuaikan logic query-nya:
   filter tenant diterapkan kecuali scope === "GLOBAL".

2. Karena langkah 1 membuat tenantId wajib, TypeScript akan menandai
   semua pemanggil yang belum mengirimnya. Periksa SEMUA pemanggil
   sendWebPushNotification() di seluruh folder src/, dan pastikan
   masing-masing mengirim tenantId yang benar sesuai konteksnya.
   Laporkan daftar file yang kamu ubah.

3. Di src/app/api/push/test/route.ts:
   - Tambahkan guard di awal handler: requireRole(req, ["OWNER", "ADMIN"])
     dari src/lib/roleGuard.ts, dengan pola yang konsisten dengan endpoint
     lain seperti src/app/api/settings/roles/route.ts
   - Kirim tenantId: auth.tenantId ke sendWebPushNotification(), sehingga
     notifikasi uji hanya sampai ke staf di tenant milik pemanggil
   - Validasi parameter "url" dari body request: tolak (400) kalau
     nilainya bukan path internal yang diawali karakter "/" - ini untuk
     mencegah endpoint dipakai mengirim notifikasi yang mengarah ke
     domain luar (vektor phishing). URL absolut seperti "https://..."
     harus ditolak.
   - Batasi juga panjang title dan message (misal maksimal 100 dan 300
     karakter) untuk mencegah penyalahgunaan.

JANGAN mengubah logic pengiriman push yang lain (VAPID, retry,
pembersihan subscription kedaluwarsa) - fokus pada isolasi tenant dan
guard otorisasi saja.

Tunjukkan diff lengkap dan daftar semua pemanggil yang ikut diperbarui.
```

## Prompt C — Temuan 5 & 6: Pengerasan Rute

```
Lakukan dua perbaikan pengerasan keamanan (hardening).

1. Di src/middleware.ts, hapus dua pola berikut dari daftar
   isPublicRoute (sekitar baris 20 dan 28):
     "/api/tenants(.*)",
     "/api/settings(.*)",

   Kedua pola ini membuat middleware melewatkan pengecekan autentikasi
   untuk SELURUH endpoint di bawahnya. Saat ini semua endpoint di bawah
   kedua path itu memang sudah punya guard sendiri (requirePermission /
   requireRole), jadi belum ada kebocoran - tapi konfigurasi ini
   menghapus lapisan pengaman kedua, sehingga endpoint baru yang lupa
   diberi guard akan langsung terbuka penuh ke internet.

   Setelah menghapusnya, periksa setiap endpoint di bawah
   /api/settings/** dan /api/tenants/** untuk memastikan semuanya masih
   berfungsi dengan autentikasi middleware aktif (semua seharusnya
   sudah aman karena memakai guard sendiri, tapi konfirmasi satu per
   satu dan laporkan hasilnya). Kalau menemukan endpoint yang memang
   HARUS publik, daftarkan hanya endpoint spesifik itu di isPublicRoute
   (misal "/api/tenants/nama-endpoint-spesifik"), JANGAN pakai wildcard
   untuk seluruh cabang.

2. Di src/app/api/pos/test-sync/route.ts, tambahkan guard
   requireRole(req, ["OWNER", "ADMIN"]) di awal handler POST, dengan
   pola yang konsisten dengan endpoint lain di project ini. Saat ini
   endpoint ini bisa dipanggil pengguna login mana pun termasuk
   KARYAWAN, padahal ini fungsi pengujian integrasi yang seharusnya
   hanya untuk pemilik/admin toko.

Tunjukkan diff lengkap dan laporan hasil pemeriksaan di langkah 1.
```

## Prompt D — Temuan 4: Perbaiki Spoofing IP pada Kuota Demo

```
Perbaiki celah yang memungkinkan batas scan demo gratis (2 scan/hari
per IP) dilewati tanpa batas, sehingga membebani biaya OCR berbayar.

AKAR MASALAH:
Di src/app/api/parse-receipt/route.ts (sekitar baris 165-169), IP
pengunjung diambil seperti ini:
  const rawIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"

Header X-Forwarded-For dikirim oleh klien dan bisa dipalsukan bebas.
Kode mengambil nilai PERTAMA dari daftar, yang justru merupakan nilai
yang dikontrol penyerang (nilai dari proxy platform ada di belakangnya).
Akibatnya penyerang cukup mengganti header ini tiap request untuk
mendapat identitas IP baru terus-menerus. Endpoint ini publik (tidak
perlu login) dan memanggil layanan OCR berbayar.

YANG HARUS DILAKUKAN:

1. Buat fungsi helper terpusat untuk mendapatkan IP klien yang
   tepercaya, letakkan di src/lib/rateLimiter.ts (di file yang sama
   dengan normalizeIp yang sudah ada). Urutan prioritas sumber IP:
   a. Header "x-vercel-forwarded-for" kalau ada (diisi oleh platform
      Vercel, tidak bisa ditimpa klien)
   b. Kalau tidak ada, ambil nilai TERAKHIR dari daftar
      "x-forwarded-for" (bukan yang pertama) - nilai terakhir
      ditambahkan oleh proxy terdekat dengan server sehingga lebih
      tepercaya daripada yang pertama
   c. Terakhir baru "x-real-ip"
   Lewatkan hasilnya ke normalizeIp() yang sudah ada.

   Beri komentar penjelasan di fungsi ini kenapa TIDAK boleh mengambil
   nilai pertama dari x-forwarded-for, supaya tidak ada yang
   mengembalikannya di masa depan.

2. Ganti pengambilan IP di src/app/api/parse-receipt/route.ts supaya
   memakai helper baru tersebut. Cari juga tempat lain di seluruh src/
   yang mengambil IP dengan pola ".split(",")[0]" yang sama, dan
   seragamkan semuanya memakai helper ini. Laporkan semua lokasi yang
   kamu temukan dan ubah.

3. Tambahkan lapisan pengaman kedua yang TIDAK bergantung pada IP,
   karena IP selalu bisa diakali lewat proxy sungguhan: buat pembatasan
   total scan demo secara global per hari untuk seluruh platform (misal
   konstanta GLOBAL_DEMO_SCAN_LIMIT_PER_DAY). Implementasinya: hitung
   jumlah scan demo hari ini dari seluruh tenant demo, dan kalau sudah
   melewati plafon, kembalikan response 429 dengan pesan yang ramah
   (misal mengarahkan pengunjung untuk mendaftar akun bisnis). Letakkan
   pengecekan ini SEBELUM pemanggilan layanan OCR supaya tidak ada
   biaya yang terlanjur keluar.

4. Pastikan tenant demo yang dibuat lewat getOrCreateDemoTenant tidak
   membuat baris sampah berlebihan - periksa apakah sudah ada mekanisme
   pembersihan tenant demo lama, dan kalau belum, laporkan saja (jangan
   buat dulu, itu task terpisah).

Tunjukkan diff lengkap dan laporan dari langkah 2 dan 4.
```

---

# Catatan Penutup

- **Repo publik:** karena `REGRID/Scota` bisa diakses siapa pun tanpa login, semua rahasia yang pernah masuk ke riwayat Git harus dianggap sudah bocor permanen — menghapusnya dari kode saja tidak cukup, **harus dirotasi**. Pertimbangkan menjadikan repo privat kalau tidak ada alasan kuat untuk tetap publik.
- **Yang tidak ikut diaudit dalam laporan ini:** kualitas kode frontend, performa query, dan kelengkapan fitur bisnis. Fokus laporan ini murni pada keamanan, otorisasi, dan bug sistem.
- **Jangan lupa jalankan ulang** seluruh script test yang sudah ada di `scripts/test-*.ts` setelah setiap tahap perbaikan, untuk memastikan tidak ada regresi pada perlindungan yang sudah berfungsi sebelumnya.

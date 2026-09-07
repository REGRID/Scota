# Fix Skema DB #1 — Dual Source of Truth: Data Langganan Terduplikasi di Dua Tabel

**File/Tabel terdampak:**
`database/schema.sql` (tabel `admin_accounts` & `subscriptions`), `src/lib/adminAccounts.ts`, `src/lib/superadmin.ts`, `src/lib/subscriptionServer.ts`
**Tingkat risiko:** 🔴 Kritis — sudah terbukti jadi celah data tidak konsisten, bahkan sudah dibuatkan test eksploitasi sendiri oleh developer sebelumnya
**Tipe pekerjaan:** Perbaikan skema database + refactor query terkait (bukan cuma bug kecil di satu fungsi)

---

## 1. Masalah Secara Detail

### Bukti: kolom yang sama ada di dua tabel

Di `database/schema.sql`, kolom `tier`, `validUntil`, `monthlyScanLimit`, `usedScansThisMonth` didefinisikan **dua kali**, di tabel yang berbeda:

```sql
-- Tabel admin_accounts (baris ~138-155)
CREATE TABLE IF NOT EXISTS admin_accounts (
    ...
    tier TEXT DEFAULT 'starter',
    "validUntil" TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
    "monthlyScanLimit" INTEGER DEFAULT 150,
    "usedScansThisMonth" INTEGER DEFAULT 0,
    ...
);

-- Tabel subscriptions (baris ~171-189)
CREATE TABLE IF NOT EXISTS subscriptions (
    ...
    tier TEXT NOT NULL DEFAULT 'starter',
    "validUntil" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    "monthlyScanLimit" INTEGER NOT NULL DEFAULT 150,
    "usedScansThisMonth" INTEGER NOT NULL DEFAULT 0,
    ...
);
```

Kedua tabel ini merepresentasikan **satu konsep yang sama** (status langganan sebuah tenant), tapi disimpan terpisah dan harus disinkronkan manual oleh kode aplikasi setiap kali salah satunya berubah.

### Bukti: ada 3 tempat berbeda yang menulis ke kedua tabel secara manual

**Lokasi A — Registrasi publik** (`src/lib/adminAccounts.ts`, sekitar baris 384-421):

```ts
// 2. Buat Subscription Khusus untuk Tenant Baru (Selalu Trial 14 hari)
await queryPg(
  `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", ...)
   VALUES ($1, 'trial', $2, $3, 0, ...)`,
  [createdTenantId, validUntilDate.toISOString(), tierConfig.monthlyScanLimit, ...]
)

// 3. Masukkan Akun Admin baru terikat ke createdTenantId dengan tier trial
await queryPg(
  `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, email, tier, "tenantId", "googleId", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, $5, $6, $7, 'trial', $8, $9, NOW(), NOW())`,
  [cleanUser, hashed, role, params.fullName || "", businessName, params.phone || "", cleanEmail || null, createdTenantId, cleanGoogleId]
)
```

**Perhatikan:** INSERT ke `admin_accounts` di sini **hanya mengisi kolom `tier`**, tidak mengisi `validUntil`, `monthlyScanLimit`, atau `usedScansThisMonth`. Karena kolom-kolom itu tidak diisi, PostgreSQL memakai nilai `DEFAULT` tabel:

- `admin_accounts."validUntil"` → jatuh ke default **`now() + 30 hari`**
- `subscriptions."validUntil"` → benar diisi **`now() + 14 hari`** (sesuai kebijakan trial)

**Ini bukan cuma potensi risiko — ini bug yang sudah terjadi.** Begitu user baru daftar, kedua tabel langsung tidak sinkron sejak detik pertama: `admin_accounts` bilang trial berlaku 30 hari, `subscriptions` bilang 14 hari. Begitu juga `monthlyScanLimit`: `subscriptions` diisi sesuai `TIER_CONFIG.trial`, sementara `admin_accounts` jatuh ke default `150` yang belum tentu sama.

**Lokasi B — Superadmin membuat tenant manual** (`src/lib/superadmin.ts`, fungsi `createTenantManual`, sekitar baris 452-508):

```ts
// Create subscription in subscriptions table
await queryPg(`INSERT INTO subscriptions (...) VALUES (...)`)

// Insert into admin_accounts
await queryPg(`INSERT INTO admin_accounts (..., tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", ...) VALUES (...)`)
```

Di sini kedua tabel **sudah diisi konsisten** — tapi ini menunjukkan pola yang sama harus diulang manual di setiap tempat, dan gampang lupa (seperti yang terjadi di Lokasi A).

**Lokasi C — Superadmin mengubah tier tenant** (`src/lib/superadmin.ts`, fungsi `updateTenantSubscription`, sekitar baris 296-312):

```ts
await queryPg(`UPDATE admin_accounts SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, ... WHERE LOWER(username) = LOWER($4)`)

// Sync to subscriptions table
const userAcc = await getUserAccountDetails(cleanUser)
if (userAcc?.tenantId) {
  await queryPg(`UPDATE subscriptions SET tier = $1, "validUntil" = $2, "monthlyScanLimit" = $3, ... WHERE "tenantId" = $4`)
}
```

Komentar `// Sync to subscriptions table` di kode ini **secara eksplisit mengakui** bahwa developer sadar dua tabel ini harus disinkron manual setiap saat.

### Bukti developer sudah pernah khawatir soal ini

Ada file `scripts/test-tier-exploit.ts` yang isinya secara spesifik membandingkan `admin_accounts.tier` vs `subscriptions.tier` untuk memastikan keduanya tidak bisa "diakali" jadi beda nilai. Keberadaan test ini menunjukkan risiko ini **sudah pernah jadi perhatian serius** (kemungkinan pernah ada insiden atau kekhawatiran soal eksploitasi upgrade tier), tapi solusinya baru berupa test manual, bukan perbaikan struktural di skema.

### Mana yang sebenarnya dipakai untuk keputusan akses?

`src/lib/subscriptionServer.ts` (fungsi `getSubscriptionInfo`, yang dipakai untuk mengecek kuota scan & fitur sesuai tier) membaca **hanya dari tabel `subscriptions`**:

```ts
const pgRes = await queryPg(`SELECT * FROM subscriptions WHERE "tenantId" = $1 LIMIT 1`, [targetTenantId])
```

Sementara `src/lib/superadmin.ts` fungsi `getAllTenants` (dipakai untuk daftar tenant di panel superadmin) mengutamakan `subscriptions` lewat JOIN, tapi punya **jalur fallback** yang membaca `admin_accounts` sendirian kalau JOIN gagal:

```ts
const tier = (acc.subTier || acc.tier || "starter") as SubscriptionTier
```

Artinya: kalau JOIN ke `subscriptions` gagal (error koneksi, dsb), tampilan superadmin akan diam-diam jatuh ke data `admin_accounts` yang — seperti dibuktikan di Lokasi A — bisa saja sudah tidak sinkron sejak awal.

---

## 2. Dampak Nyata

- Tenant trial baru bisa punya masa berlaku yang **berbeda tergantung tabel mana yang dibaca**: 14 hari (benar, sesuai kebijakan) atau 30 hari (salah, dari default kolom).
- Superadmin bisa melihat data kuota/masa berlaku yang salah saat fallback query aktif, berisiko mengambil keputusan bisnis (menagih, memperpanjang, menegur tenant) berdasarkan data yang keliru.
- Setiap fitur baru yang menyentuh tier/kuota harus "ingat" untuk update dua tabel sekaligus — beban kognitif dan risiko bug bertambah terus seiring aplikasi berkembang.
- Tidak ada jaminan atomicity: `subscriptions` dan `admin_accounts` di-UPDATE lewat dua query terpisah tanpa transaksi. Kalau query kedua gagal (network blip, dsb), tabel akan tertinggal tidak sinkron tanpa ada mekanisme untuk mendeteksinya otomatis.

---

## 3. Kriteria Solusi (Acceptance Criteria)

- [ ] Ada **satu** sumber kebenaran untuk data langganan (`tier`, `validUntil`, `monthlyScanLimit`, `usedScansThisMonth`) — direkomendasikan tabel `subscriptions`, karena itu yang sudah dipakai untuk keputusan akses sebenarnya (`subscriptionServer.ts`).
- [ ] Tidak ada lagi kode yang menulis nilai tier/kuota ke `admin_accounts` secara terpisah dari `subscriptions`.
- [ ] Semua pembacaan data tier/kuota (termasuk fallback query di `getAllTenants`) mengambil dari `subscriptions`, bukan `admin_accounts`.
- [ ] Data yang sudah terlanjur tidak sinkron di production (kalau ada) diperbaiki lewat query migrasi satu kali sebelum kolom lama dihapus.
- [ ] Tidak ada breaking change pada endpoint publik/response API yang sudah dipakai frontend — perubahan ini murni di lapisan data & query internal.
- [ ] `scripts/test-tier-exploit.ts` tetap bisa dijalankan dan lolos (atau disesuaikan jika strukturnya berubah karena kolom di `admin_accounts` sudah dihapus).

---

## 4. Rencana Implementasi — 2 Fase

Karena ini menyentuh skema database yang sudah berjalan (bukan cuma logic aplikasi), kerjakan bertahap. **Jangan langsung ke Fase 2 tanpa Fase 1 dulu.**

### Fase 1 (Hotfix cepat, risiko rendah) — Kerjakan lebih dulu

Tujuan: hentikan pendarahan tanpa mengubah skema dulu.

1. Perbaiki **Lokasi A** (`src/lib/adminAccounts.ts`) — tambahkan `validUntil`, `monthlyScanLimit`, `usedScansThisMonth` ke query `INSERT INTO admin_accounts` saat registrasi publik, dengan nilai yang **sama persis** dengan yang dikirim ke `subscriptions` (pakai variabel yang sama, jangan hitung ulang).
2. Jalankan query satu-kali untuk memperbaiki data yang sudah terlanjur tidak sinkron di production:

   ```sql
   UPDATE admin_accounts a
   SET tier = s.tier,
       "validUntil" = s."validUntil",
       "monthlyScanLimit" = s."monthlyScanLimit",
       "usedScansThisMonth" = s."usedScansThisMonth"
   FROM subscriptions s
   WHERE a."tenantId" = s."tenantId"
     AND (a.tier IS DISTINCT FROM s.tier
       OR a."validUntil" IS DISTINCT FROM s."validUntil"
       OR a."monthlyScanLimit" IS DISTINCT FROM s."monthlyScanLimit");
   ```

   > Jalankan `SELECT` versi query ini dulu (ganti `UPDATE ... SET` jadi `SELECT a.username, a.tier, s.tier, a."validUntil", s."validUntil" ...`) untuk lihat berapa banyak baris yang akan terdampak, sebelum benar-benar menjalankan `UPDATE`.

3. Bungkus 3 `INSERT` berurutan (tenants → subscriptions → admin_accounts) di **Lokasi A** dan **Lokasi B** dengan transaksi database (`BEGIN ... COMMIT`, rollback kalau ada yang gagal), supaya tidak ada state "setengah jadi" kalau salah satu insert gagal di tengah jalan.

### Fase 2 (Perbaikan struktural) — Kerjakan setelah Fase 1 stabil beberapa waktu

Tujuan: hilangkan duplikasi permanen di level skema, supaya bug seperti ini tidak bisa terjadi lagi di masa depan.

1. Audit semua tempat yang membaca `tier`/`validUntil`/`monthlyScanLimit`/`usedScansThisMonth` dari `admin_accounts` (termasuk fallback di `getAllTenants`), ubah semua jadi baca dari `subscriptions` (lewat JOIN kalau perlu data akun+langganan sekaligus).
2. Audit semua tempat yang menulis kolom tersebut ke `admin_accounts`, hapus penulisannya — cukup tulis ke `subscriptions` saja.
3. Setelah dipastikan tidak ada kode yang membaca/menulis kolom tersebut dari `admin_accounts` (grep ulang untuk memastikan), baru jalankan migrasi untuk **menghapus** kolom `tier`, `validUntil`, `monthlyScanLimit`, `usedScansThisMonth` dari tabel `admin_accounts`.
4. Update `scripts/test-tier-exploit.ts` supaya tidak lagi membandingkan dua tabel (karena sudah tidak ada duplikasi), melainkan cukup memverifikasi `subscriptions.tier` tidak bisa diubah lewat jalur yang tidak sah.

---

## 5. Rencana Pengujian

| # | Skenario | Ekspektasi |
|---|----------|------------|
| 1 | Registrasi tenant baru lewat form publik | `subscriptions."validUntil"` dan `admin_accounts."validUntil"` sama persis (14 hari dari sekarang) |
| 2 | Superadmin buat tenant manual dengan tier "pro" | Kedua tabel konsisten tier="pro" dan `monthlyScanLimit` sesuai `TIER_CONFIG.pro` |
| 3 | Superadmin ubah tier tenant existing dari "starter" ke "enterprise" | Kedua tabel ter-update bersamaan, tidak ada yang tertinggal |
| 4 | Jalankan ulang query audit (langkah Fase 1 no. 2) setelah Fase 1 selesai | Hasilnya nol baris (tidak ada lagi ketidaksesuaian) |
| 5 | Simulasikan kegagalan di tengah proses insert (mis. matikan koneksi DB manual di tengah transaksi saat testing) | Tidak ada tenant baru yang "setengah jadi" — transaksi rollback penuh |
| 6 | Jalankan `scripts/test-tier-exploit.ts` | Tetap lolos setelah perubahan |

---

## 6. Prompt Siap Pakai (Vibe Coding)

### Prompt A — Fase 1 (kerjakan ini dulu)

```
Ada bug data tidak sinkron antara dua tabel di database PostgreSQL: admin_accounts
dan subscriptions. Keduanya sama-sama menyimpan kolom tier, validUntil,
monthlyScanLimit, usedScansThisMonth untuk merepresentasikan status langganan
tenant yang sama, dan harus disinkronkan manual oleh kode aplikasi.

BUG SPESIFIK yang harus diperbaiki dulu:
Di file src/lib/adminAccounts.ts, pada fungsi yang menangani registrasi tenant
baru (bagian yang melakukan INSERT INTO subscriptions lalu INSERT INTO
admin_accounts secara berurutan), INSERT ke tabel admin_accounts HANYA mengisi
kolom `tier`, TIDAK mengisi `validUntil`, `monthlyScanLimit`, dan
`usedScansThisMonth`. Akibatnya kolom-kolom itu di admin_accounts jatuh ke
DEFAULT tabel (30 hari, 150 scan) yang berbeda dari nilai sebenarnya yang
dikirim ke tabel subscriptions (14 hari trial, sesuai TIER_CONFIG.trial).

YANG HARUS DILAKUKAN:
1. Perbaiki query INSERT INTO admin_accounts di fungsi registrasi tersebut
   supaya ikut mengisi validUntil, monthlyScanLimit, dan usedScansThisMonth,
   dengan NILAI YANG SAMA PERSIS (pakai variabel yang sama, jangan hitung
   ulang) dengan yang dikirim ke INSERT INTO subscriptions tepat di atasnya.
2. Bungkus kedua INSERT (ke subscriptions dan ke admin_accounts) plus INSERT
   ke tenants sebelumnya, dalam satu transaksi database (BEGIN...COMMIT,
   dengan ROLLBACK kalau salah satu gagal), supaya tidak ada state "setengah
   jadi" kalau salah satu query gagal di tengah jalan. Sesuaikan dengan cara
   pool koneksi pg yang dipakai di project ini (lihat src/lib/pgDb.ts untuk
   pola akses database yang sudah ada).
3. Lakukan hal yang sama (audit + bungkus transaksi) untuk fungsi serupa di
   src/lib/superadmin.ts bagian createTenantManual, yang juga melakukan 3
   INSERT berurutan (tenants, subscriptions, admin_accounts) tanpa transaksi.
4. Setelah perubahan kode selesai, buatkan juga satu file SQL migrasi
   terpisah (mis. database/migrations/001_sync_admin_subscription_data.sql)
   berisi query untuk memperbaiki data yang sudah terlanjur tidak sinkron di
   database yang sudah berjalan:

   UPDATE admin_accounts a
   SET tier = s.tier,
       "validUntil" = s."validUntil",
       "monthlyScanLimit" = s."monthlyScanLimit",
       "usedScansThisMonth" = s."usedScansThisMonth"
   FROM subscriptions s
   WHERE a."tenantId" = s."tenantId"
     AND (a.tier IS DISTINCT FROM s.tier
       OR a."validUntil" IS DISTINCT FROM s."validUntil"
       OR a."monthlyScanLimit" IS DISTINCT FROM s."monthlyScanLimit");

   Sertakan juga versi SELECT dari query ini (tanpa UPDATE) sebagai query
   "dry-run" di komentar file yang sama, supaya saya bisa cek dulu berapa
   baris yang akan terdampak sebelum menjalankan UPDATE sungguhan.

JANGAN dulu menghapus kolom tier/validUntil/monthlyScanLimit/usedScansThisMonth
dari tabel admin_accounts di tahap ini — itu perbaikan struktural fase
berikutnya yang akan dikerjakan terpisah setelah hotfix ini stabil.

Tunjukkan diff lengkap dari semua perubahan yang dilakukan.
```

### Prompt B — Fase 2 (jalankan hanya setelah Fase 1 sudah live & stabil)

```
Sekarang lakukan perbaikan struktural untuk menghilangkan duplikasi data
langganan yang tadinya ada di dua tabel (admin_accounts dan subscriptions).

LANGKAH:
1. Cari SEMUA tempat di src/ dan scripts/ yang membaca kolom tier,
   validUntil, monthlyScanLimit, atau usedScansThisMonth dari tabel
   admin_accounts (baik lewat SELECT langsung maupun lewat hasil JOIN
   dengan fallback ke admin_accounts, seperti di fungsi getAllTenants pada
   src/lib/superadmin.ts). Daftar semua lokasi yang ditemukan sebelum mulai
   mengubah apa pun.
2. Ubah semua lokasi tersebut supaya membaca kolom-kolom itu HANYA dari
   tabel subscriptions (pakai JOIN ke subscriptions kalau butuh data akun
   dan langganan sekaligus dalam satu query).
3. Cari SEMUA tempat yang menulis (INSERT/UPDATE) kolom-kolom itu ke tabel
   admin_accounts, dan hapus bagian yang menulis ke admin_accounts —
   cukup tulis ke subscriptions saja. Pastikan tidak menghapus penulisan ke
   kolom lain di admin_accounts yang memang bukan bagian dari data
   langganan (mis. password, status, fullName tetap boleh ditulis ke
   admin_accounts).
4. Setelah semua kode di atas selesai diubah dan tidak ada lagi referensi
   ke kolom tier/validUntil/monthlyScanLimit/usedScansThisMonth pada tabel
   admin_accounts, buatkan file migrasi SQL baru untuk menghapus kolom-
   kolom tersebut dari admin_accounts:

   ALTER TABLE admin_accounts DROP COLUMN IF EXISTS tier;
   ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "validUntil";
   ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "monthlyScanLimit";
   ALTER TABLE admin_accounts DROP COLUMN IF EXISTS "usedScansThisMonth";

   JANGAN jalankan migrasi DROP COLUMN ini secara otomatis — tulis saja
   filenya, saya yang akan menjalankannya manual setelah backup database.
5. Update scripts/test-tier-exploit.ts supaya tidak lagi membandingkan
   admin_accounts.tier vs subscriptions.tier (karena kolom itu sudah
   dihapus dari admin_accounts), tapi tetap menguji bahwa tier di
   subscriptions tidak bisa diubah lewat jalur registrasi/update yang
   tidak sah.

Tunjukkan dulu hasil audit langkah 1 dan 3 (daftar lokasi yang ditemukan)
sebelum melakukan perubahan, supaya saya bisa review dulu.
```

---

## 7. Catatan Tambahan

- Duplikasi serupa juga terjadi pada data profil bisnis (`businessName`, `tagline`, `address`, `phone`, `logoUrl`, `invoiceFooter`, `taxNumber`) yang ada di tabel `tenants` **dan** `subscriptions`. Ini sengaja **tidak** dimasukkan ke prompt di atas supaya scope perbaikan tetap kecil dan aman — tangani sebagai task terpisah setelah Fase 1 & 2 di atas selesai dan terbukti stabil.
- Sebelum menjalankan Fase 2 di lingkungan production, **backup database dulu** — `ALTER TABLE ... DROP COLUMN` tidak bisa dibatalkan begitu saja setelah dijalankan.

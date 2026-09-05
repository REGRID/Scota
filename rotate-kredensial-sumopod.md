# Rotate & Hapus Kredensial DB yang Bocor (Kejadian Kedua — Database Sumopod)

## Masalah Saat Ini

Pola persis yang sama dengan kebocoran kredensial Supabase sebelumnya, terulang lagi — kali ini di database baru (Sumopod, hasil migrasi hosting). Connection string Postgres **asli** production ter-commit di **2 file baru** yang ditambahkan bersamaan dengan perbaikan-perbaikan lain:

```
postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@pgsql-dbas-jkt1-006.sumobase.my.id:6432/db33373ff3cdb95673
```

| File | Baris | Konteks |
|---|---|---|
| `scripts/audit-tenants.js` | 5 | Script audit tenant tier non-trial |
| `scripts/test-tier-exploit.ts` | 24 | Script test simulasi exploit tier |

Kemungkinan besar ini terjadi karena kedua script ini dibuat untuk keperluan development/testing lokal, dan saat menulisnya, connection string asli dari `.env.local` ter-copy-paste langsung ke kode sebagai "fallback biar gampang dijalankan" — bukan dengan sengaja, tapi dampaknya sama persis: **kredensial database production sekarang terlihat oleh siapa pun yang bisa membaca repo ini**.

Poin penting yang perlu digarisbawahi: `src/lib/pgDb.ts` — file inti aplikasi — sudah **bersih dan benar** (murni dari `process.env`, tanpa fallback). Artinya perbaikan sebelumnya berhasil diterapkan dengan benar di kode utama, tapi polanya kembali muncul di file-file baru yang dibuat setelahnya. Ini menunjukkan masalahnya bukan cuma "satu file yang lupa dibersihkan", tapi kebiasaan menulis kredensial asli saat membuat script baru — yang berarti bisa terulang lagi di file berikutnya kalau tidak ada pencegahan otomatis.

## Solusi

### Langkah 1 — Rotate password database Sumopod (lakukan ini duluan, sebelum langkah lain)

1. Masuk ke dashboard Sumopod (atau hubungi provider-nya kalau reset password harus lewat mereka).
2. Reset/generate password baru untuk database `db33373ff3cdb95673`.
3. Salin connection string baru.
4. **Belum** ditempel ke kode manapun — simpan dulu ke environment variable di langkah 3.

Sama seperti kejadian sebelumnya: mengubah kode tanpa rotate password **tidak menutup celah apa pun** — kredensial lama tetap valid dan tetap bisa dipakai siapa saja yang sempat membaca repo ini, kapan pun sebelum rotate dilakukan.

### Langkah 2 — Hapus fallback hardcoded di kedua file

**`scripts/audit-tenants.js`:**
```js
// SEBELUM
const { Pool } = require("pg")

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@pgsql-dbas-jkt1-006.sumobase.my.id:6432/db33373ff3cdb95673"
```

```js
// SESUDAH
const { Pool } = require("pg")

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL belum diset. Set environment variable ini sebelum menjalankan script.")
  process.exit(1)
}
```

**`scripts/test-tier-exploit.ts`:** — script ini sebenarnya sudah punya logic yang benar untuk memuat `.env.local` ke `process.env` di baris atas sebelum fallback dipakai, jadi fallback hardcoded-nya **tidak pernah benar-benar diperlukan** dalam kondisi normal — hapus saja:

```ts
// SEBELUM (baris ~22-24)
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@pgsql-dbas-jkt1-006.sumobase.my.id:6432/db33373ff3cdb95673"
```

```ts
// SESUDAH
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL belum diset (cek .env.local). Script dihentikan.")
  process.exit(1)
}
```

Karena kode pemuat `.env.local` di bagian atas file itu sudah menjalankan tugasnya sebelum baris ini dieksekusi, `process.env.DATABASE_URL` seharusnya sudah terisi kalau `.env.local` ada dan benar — fallback hardcoded di situ murni risiko tanpa manfaat.

### Langkah 3 — Update `.env.local` dengan kredensial baru

```env
DATABASE_URL="postgresql://<user-baru>:<password-baru>@pgsql-dbas-jkt1-006.sumobase.my.id:6432/<db-baru-jika-diganti>"
```

Update juga di environment production (VPS/PM2 sesuai `ecosystem.config.cjs` yang sudah ada) dan di GitHub Actions secrets kalau `deploy.yml` memakai `DATABASE_URL` untuk proses deploy/migrasi.

### Langkah 4 — Bersihkan riwayat git

Sama seperti kasus sebelumnya — commit baru yang menghapus baris ini tidak menghapusnya dari histori. Karena kredensial sudah di-rotate (langkah 1), risiko dari histori lama sudah dinetralkan, tapi kalau ingin repo benar-benar bersih:

```bash
pip install git-filter-repo
git filter-repo --replace-text <(echo '[OLD_LEAKED_PASSWORD]==>REDACTED')
```

Semua kolaborator perlu re-clone repo setelah ini, bukan `git pull`.

### Langkah 5 — Pencegahan otomatis (ini yang paling penting sekarang)

Ini kejadian **kedua** dengan pola identik. Review manual jelas tidak cukup untuk mencegah ini terulang lagi di file berikutnya — dibutuhkan pemeriksaan otomatis yang berjalan setiap kali ada commit/push:

**Opsi A — GitHub secret scanning & push protection** (paling mudah, tidak perlu setup tambahan di sisi developer):
Repo Settings → Code security → aktifkan **Secret scanning** dan **Push protection**. Ini otomatis mendeteksi pola seperti connection string database dan menolak push-nya sebelum sempat masuk ke repo sama sekali — bukan cuma memberi peringatan setelah kejadian.

**Opsi B — pre-commit hook lokal dengan `gitleaks`** (lapisan tambahan, jalan sebelum sempat push):
```bash
npm install -D gitleaks husky
npx husky init
echo 'gitleaks protect --staged --verbose' > .husky/pre-commit
```

Idealnya keduanya dipasang sekaligus — push protection sebagai jaring pengaman utama (bekerja walau developer lupa install hook lokal), gitleaks lokal sebagai lapisan yang menangkap lebih awal sebelum push.

### Langkah 6 — Buat template script yang aman untuk dicontoh ke depannya

Supaya script berikutnya tidak mengulangi pola yang sama, tambahkan satu contoh baku di `scripts/README.md` (atau komentar di `scripts/setup-postgres.js` yang sudah ada):

```js
// Pola BAKU untuk semua script yang butuh koneksi database:
// JANGAN PERNAH menaruh connection string asli sebagai fallback.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL belum diset. Copy .env.local.example ke .env.local dan isi nilainya.")
  process.exit(1)
}
```

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `scripts/audit-tenants.js` | Hapus fallback hardcoded, exit kalau `DATABASE_URL` kosong |
| `scripts/test-tier-exploit.ts` | Hapus fallback hardcoded (loader `.env.local` yang sudah ada tetap dipakai) |
| `.env.local` (lokal & production) | Update ke kredensial Sumopod yang baru |
| `.github/workflows/deploy.yml` / GitHub Secrets | Update `DATABASE_URL` kalau dipakai di proses deploy |
| Repo Settings → Code security | Aktifkan secret scanning + push protection |
| `.husky/pre-commit` | **Baru** (opsional tapi disarankan) — `gitleaks protect --staged` |
| Sumopod Dashboard | Password database di-reset |

## Catatan Penting

- **Urutan wajib sama seperti kejadian sebelumnya: rotate dulu (langkah 1), baru ubah kode.** Kredensial yang sudah bocor tetap valid sampai benar-benar diganti di sisi provider.
- Karena ini kejadian kedua dengan pola yang sama persis, langkah 5 (secret scanning otomatis) **jangan dianggap opsional** kali ini — tanpa itu, kemungkinan besar akan ada kejadian ketiga di script/file berikutnya yang dibuat tim.
- Cek juga apakah `test-tier-exploit.ts` dan `audit-tenants.js` ini pernah/akan dijalankan lewat CI (`deploy.yml`) — kalau iya, pastikan environment CI juga sudah punya `DATABASE_URL` sebagai secret, bukan bergantung pada fallback yang baru saja dihapus.

## Checklist Verifikasi

- [ ] Password database Sumopod baru berhasil di-generate
- [ ] `grep -rn "[OLD_PASSWORD]\|[OLD_USERNAME]" .` di seluruh repo → hasil kosong
- [ ] `scripts/audit-tenants.js` dan `scripts/test-tier-exploit.ts` tetap bisa jalan normal dengan `DATABASE_URL` dari env, dan langsung exit dengan pesan jelas kalau env kosong
- [ ] GitHub Secret Scanning & Push Protection aktif untuk repo ini
- [ ] Coba commit file dummy berisi pola connection string Postgres → ditolak otomatis oleh push protection (atau oleh gitleaks lokal kalau dipasang)
- [ ] Cek Sumopod database logs untuk aktivitas dari IP tak dikenal sebelum tanggal rotate
- [ ] Deployment production (PM2/VPS) tetap berjalan normal setelah `DATABASE_URL` diupdate ke kredensial baru

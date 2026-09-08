# Arsitektur Isolasi Tenant — Fase 4: Migrasi Data Tenant yang Sudah Ada

**Prasyarat:** Fase 1-3 selesai (schema kosong bisa dibuat, aplikasi bisa query ke schema tenant lewat flag `schemaMigrated`, RLS policy sudah aktif dan lolos test).
**Tujuan Fase 4:** Memindahkan data tenant yang **sudah ada sekarang** (di tabel shared/lama) ke schema masing-masing — satu tenant per satu tenant, aman untuk dibatalkan (rollback) kapan saja kalau ada yang tidak beres.

---

## 1. Prinsip Desain: "Salin Dulu, Pindah Belakangan"

Ini keputusan paling penting di Fase 4: **data lama TIDAK dihapus** di fase ini. Prosesnya adalah **menyalin** (copy), bukan memotong-tempel (cut-paste):

1. Data di tabel lama (`public.receipts`, dst, difilter `tenantId`) **tetap dibiarkan ada**.
2. Data yang sama disalin ke tabel di schema tenant yang baru.
3. Setelah disalin dan diverifikasi cocok, baru flag `schemaMigrated` tenant tersebut diubah jadi `true`.
4. Sejak flag itu `true`, aplikasi (sesuai desain Fase 2) otomatis membaca dari schema baru untuk tenant itu.

**Kenapa ini penting:** kalau ternyata ada masalah setelah cutover (misal ada data yang kelewat, atau ada bug lain yang baru ketahuan), rollback-nya **sangat sederhana** — tinggal kembalikan flag `schemaMigrated` ke `false`, dan tenant itu otomatis kembali baca dari tabel lama yang **masih utuh, tidak pernah disentuh**. Tidak ada proses "kembalikan data yang sudah terlanjur dihapus" yang berisiko.

Penghapusan data lama baru dilakukan jauh di belakang, di **Fase 6 (cutover final)**, setelah semua tenant sudah pindah dan terbukti stabil dalam beberapa waktu.

---

## 2. Alur Migrasi per Tenant

Untuk satu tenant, urutan yang aman:

1. **Pastikan schema tenant sudah ada** — panggil ulang fungsi provisioning dari Fase 1 (aman dijalankan berkali-kali / idempotent, jadi tidak masalah kalau ternyata sudah pernah dibuat).
2. **Catat waktu mulai migrasi** (`migrationStartedAt = sekarang`) — dipakai nanti di langkah pengecekan susulan.
3. **Salin data**, tabel per tabel, **urut sesuai ketergantungan** supaya tidak melanggar foreign key di dalam schema tenant:
   - `receipts` dulu (tidak bergantung tabel lain)
   - `receipt_items` (butuh `receiptId` yang sudah ada di `receipts`)
   - `pending_approvals` (butuh `receiptId` yang sudah ada di `receipts`)
   - `custom_categories`, `push_subscriptions`, `notifications` (tidak saling bergantung, bebas urutan)

   ```sql
   INSERT INTO tenant_xxx.receipts
   SELECT * FROM public.receipts WHERE "tenantId" = $1
   ON CONFLICT (id) DO NOTHING;
   ```

   `ON CONFLICT (id) DO NOTHING` membuat proses ini **aman diulang** — kalau script sempat gagal di tengah dan dijalankan ulang, baris yang sudah tersalin tidak akan dobel atau error.

4. **Bandingkan jumlah baris** antara tabel lama (`WHERE tenantId = $1`) dan tabel baru di schema tenant, untuk keenam tabel. Kalau ada yang tidak cocok, **hentikan proses**, jangan lanjut ke langkah berikutnya — laporkan tabel mana yang bermasalah.
5. **Baru jika semua cocok**, ubah `tenants."schemaMigrated"` jadi `true` untuk tenant tersebut.
6. **Catat hasil migrasi** (tenant mana, kapan, berapa baris per tabel) ke semacam log/tabel riwayat migrasi, supaya ada jejak audit.

---

## 3. Menangani Risiko "Data Baru Masuk Saat Migrasi Berlangsung"

Ini pertanyaan yang wajar muncul: bagaimana kalau ada transaksi/struk baru masuk **persis** saat proses salin data sedang berjalan?

Untuk aplikasi seperti ini (pembukuan UMKM, bukan sistem transaksi finansial real-time berkecepatan tinggi), pendekatan yang proporsional — tidak berlebihan tapi tetap aman — adalah:

1. **Proses salin data itu sendiri berlangsung cepat** (hitungan detik sampai menit tergantung jumlah struk tenant tersebut), dan selama proses ini tenant masih dilayani sepenuhnya oleh jalur lama (belum ada perubahan perilaku).
2. Setelah salin data selesai dan sebelum flag diubah, jalankan **satu kali lagi salinan tambahan** ("delta copy") khusus untuk baris yang dibuat **setelah** `migrationStartedAt` — menangkap data yang sempat masuk selama proses salin berlangsung.
3. Setelah delta copy ini, baru flag diubah jadi `true`.
4. Sebagai jaring pengaman terakhir, dibuat **script rekonsiliasi terpisah** yang bisa dijalankan kapan saja (termasuk beberapa hari setelah migrasi) untuk memeriksa: adakah baris di tabel lama milik tenant yang sudah `schemaMigrated = true`, tapi belum ada padanannya di schema baru? Kalau ketemu, itu tandanya ada celah kecil yang lolos — script ini akan menyalinnya dan melaporkan temuan tersebut supaya bisa diselidiki kenapa bisa terjadi.

Pendekatan ini **jauh lebih sederhana** daripada membuat mekanisme "kunci sementara" di seluruh endpoint yang bisa menulis data (yang akan menyentuh puluhan file dan menambah kompleksitas besar), dan cukup memadai untuk skala serta sifat aplikasi ini. Kalau di kemudian hari volume/skala berubah drastis, pendekatan yang lebih ketat bisa dipertimbangkan ulang — tapi itu di luar cakupan fase ini.

---

## 4. Komponen yang Dibangun

### A. `scripts/migrate-tenant-data.js`

Dipanggil manual: `node scripts/migrate-tenant-data.js <tenantId>`. Melakukan seluruh alur di bagian 2 & 3 untuk **satu** tenant. Tidak otomatis dijalankan untuk semua tenant sekaligus — supaya beberapa tenant pertama bisa diawasi manual dulu sebelum yakin script ini aman dijalankan berulang untuk sisanya.

### B. `scripts/reconcile-tenant-migration.js`

Dipanggil manual: `node scripts/reconcile-tenant-migration.js <tenantId>`. Jaring pengaman dari bagian 3 poin 4 — bisa dijalankan kapan saja setelah migrasi, termasuk berkala (misal harian) selama beberapa hari pasca-migrasi sebagai pemeriksaan tambahan.

### C. Tabel riwayat migrasi

Tabel kecil baru di schema `public` (control plane) untuk mencatat jejak migrasi:

```sql
CREATE TABLE IF NOT EXISTS tenant_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES tenants(id),
    "startedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "rowCounts" JSONB,
    status TEXT NOT NULL DEFAULT 'in_progress',
    "errorMessage" TEXT
);
```

Berguna untuk melihat riwayat siapa saja yang sudah dimigrasi, kapan, dan kalau ada yang gagal, kenapa.

---

## 5. Kriteria Selesai (Acceptance Criteria)

- [ ] `scripts/migrate-tenant-data.js` berhasil memindahkan data satu tenant uji coba (pakai tenant di database development, bukan langsung production), dengan jumlah baris yang cocok persis antara sumber dan tujuan untuk keenam tabel.
- [ ] Script bersifat idempotent — dijalankan dua kali untuk tenant yang sama tidak menghasilkan data dobel maupun error.
- [ ] Kalau sengaja dibuat ketidakcocokan (misal menambah 1 baris manual ke tabel lama setelah salin pertama tapi sebelum delta copy), delta copy berhasil menangkapnya.
- [ ] `scripts/reconcile-tenant-migration.js` berhasil mendeteksi & menyalin baris yang sengaja "diloloskan" untuk keperluan test (simulasi race condition).
- [ ] Tabel `tenant_migration_log` tercatat dengan benar setiap kali migrasi dijalankan, termasuk saat gagal.
- [ ] Setelah satu tenant uji coba selesai dimigrasi dan `schemaMigrated = true`, seluruh alur di endpoint pilot (`GET /api/receipts` dari Fase 2 & 3) menampilkan data yang identik dengan sebelum migrasi (dari sudut pandang pengguna, tidak ada bedanya).
- [ ] Data lama tenant tersebut **tetap ada** di tabel shared setelah migrasi (belum dihapus) — bisa dicek manual.
- [ ] Rollback manual (ubah `schemaMigrated` balik ke `false`) terbukti membuat tenant tersebut kembali berfungsi normal dari data lama tanpa ada yang hilang.

---

## 6. Rencana Pengujian

| # | Skenario | Ekspektasi |
|---|----------|------------|
| 1 | Migrasi tenant uji coba dengan data receipts, items, kategori yang bervariasi | Semua tersalin, jumlah baris cocok di log |
| 2 | Jalankan `migrate-tenant-data.js` dua kali berturut-turut untuk tenant yang sama | Tidak ada error, tidak ada data dobel |
| 3 | Selama proses salin (jeda manual sebelum delta copy), tambahkan 1 baris baru langsung ke `public.receipts` untuk tenant tersebut | Delta copy menangkap baris baru ini sebelum flag diubah jadi `true` |
| 4 | Setelah cutover, jalankan `reconcile-tenant-migration.js` | Melaporkan "tidak ada temuan" (kondisi sehat) |
| 5 | Simulasi kegagalan: hentikan proses migrasi paksa di tengah jalan (mis. matikan script manual) | `tenants.schemaMigrated` tetap `false` (tidak sempat diubah), tenant tetap dilayani dari data lama tanpa gangguan |
| 6 | Setelah tenant migrasi sukses, ubah manual `schemaMigrated` kembali ke `false` (simulasi rollback) | Tenant kembali membaca dari data lama, tidak ada data yang hilang karena memang belum pernah dihapus |

---

## 7. Prompt Siap Pakai (Vibe Coding) — Fase 4

```
Lanjutkan pekerjaan arsitektur multi-tenant (schema-per-tenant + RLS).
Fase 1 (provisioning schema), Fase 2 (withTenantSchema + flag
schemaMigrated), dan Fase 3 (RLS policy + withSuperadminSchemaAccess)
sudah selesai. Sekarang kerjakan FASE 4: memindahkan data tenant yang
SUDAH ADA dari tabel shared (di schema public, difilter tenantId) ke
schema masing-masing tenant.

PRINSIP UTAMA yang harus diikuti: proses ini adalah MENYALIN data, BUKAN
memindahkan/menghapus. Data di tabel lama TIDAK BOLEH dihapus di fase
ini - itu pekerjaan fase terpisah nanti setelah dipastikan semuanya
stabil. Ini penting untuk kemampuan rollback: kalau ada masalah, cukup
kembalikan flag schemaMigrated ke false dan tenant otomatis kembali ke
data lama yang masih utuh.

YANG HARUS DIBUAT:

1. Tambahkan tabel baru ke database/schema.sql (tetap di schema public):

   CREATE TABLE IF NOT EXISTS tenant_migration_log (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       "tenantId" UUID NOT NULL REFERENCES tenants(id),
       "startedAt" TIMESTAMPTZ NOT NULL,
       "completedAt" TIMESTAMPTZ,
       "rowCounts" JSONB,
       status TEXT NOT NULL DEFAULT 'in_progress',
       "errorMessage" TEXT
   );

2. Buat scripts/migrate-tenant-data.js yang menerima argumen command-line
   tenantId, lalu:
   a. Pastikan schema tenant sudah dibuat - panggil fungsi provisioning
      dari Fase 1 (scripts/provision-tenant-schema.js), jangan duplikat
      logicnya, panggil/import fungsinya langsung. Kalau fungsi itu
      belum bisa dipanggil secara programatik (cuma bisa lewat CLI),
      refactor dulu supaya logic intinya jadi fungsi yang bisa
      diimport, sambil tetap mempertahankan cara pemanggilan CLI yang
      lama supaya tidak ada yang rusak.
   b. Catat waktu mulai (migrationStartedAt) dan insert baris baru ke
      tenant_migration_log dengan status 'in_progress'.
   c. Salin data untuk keenam tabel (receipts, receipt_items,
      pending_approvals, custom_categories, push_subscriptions,
      notifications) dari public.<table> WHERE "tenantId" = tenantId ke
      <schema_tenant>.<table>, memakai INSERT ... SELECT ... ON CONFLICT
      (id) DO NOTHING supaya aman dijalankan berulang. Urutkan
      penyalinan: receipts dulu, baru receipt_items dan
      pending_approvals (karena keduanya referensi ke receipts.id),
      baru sisanya.
   d. Setelah salin pertama, tunggu jeda singkat (beberapa detik, buat
      konfigurable lewat variabel), lalu lakukan SALINAN TAMBAHAN
      (delta copy) khusus untuk baris di tabel lama yang "createdAt"
      atau "updatedAt"-nya lebih baru dari migrationStartedAt -
      menangkap data yang mungkin masuk selama proses salin
      berlangsung.
   e. Bandingkan jumlah baris (COUNT) antara tabel lama (filter
      tenantId) dan tabel baru di schema tenant, untuk keenam tabel.
      Kalau ada yang TIDAK cocok, JANGAN ubah flag schemaMigrated,
      update tenant_migration_log jadi status 'failed' dengan pesan
      error yang jelas menyebutkan tabel mana yang tidak cocok, lalu
      keluar dengan exit code error.
   f. Kalau semua cocok, update tenants.schemaMigrated jadi true, dan
      update tenant_migration_log jadi status 'completed' dengan
      completedAt dan rowCounts (JSON berisi jumlah baris per tabel).
   g. Tampilkan log yang jelas di setiap langkah ke console.

3. Buat scripts/reconcile-tenant-migration.js yang menerima argumen
   tenantId, lalu:
   a. Ambil migrationStartedAt dari tenant_migration_log terakhir untuk
      tenant ini (yang statusnya 'completed').
   b. Cari baris di tabel lama (public.<table> WHERE tenantId = ...)
      yang BELUM ada padanannya (berdasarkan id) di schema tenant,
      untuk keenam tabel.
   c. Kalau ditemukan, salin baris-baris tersebut ke schema tenant
      (idempotent, ON CONFLICT DO NOTHING), dan laporkan dengan jelas
      berapa baris ditemukan & disalin per tabel - ini seharusnya
      jarang/tidak pernah terjadi kalau delta copy di langkah 2d
      bekerja dengan benar, jadi kalau script ini menemukan sesuatu,
      itu sinyal yang perlu diselidiki lebih lanjut.
   d. Kalau tidak ditemukan apa pun, laporkan dengan jelas bahwa
      kondisi sehat (tidak ada data yang tertinggal).

JANGAN menghapus data apa pun dari tabel lama di kedua script ini. JANGAN
mengubah endpoint aplikasi mana pun di iterasi ini - fokus murni pada
kedua script migrasi.

Setelah selesai, jelaskan cara saya bisa mencoba kedua script ini secara
manual di database development dengan satu tenant contoh, termasuk cara
mensimulasikan skenario "ada data baru masuk saat proses migrasi
berlangsung" untuk menguji delta copy-nya benar-benar bekerja.
```

---

## 8. Yang Masih Belum Dibahas (Fase Berikutnya)

- Update alur registrasi tenant baru & pembuatan tenant oleh superadmin supaya otomatis langsung dapat schema sendiri sejak awal, tanpa perlu proses migrasi (Fase 5) — jadi Fase 4 ini murni untuk tenant yang **sudah ada sebelum** perubahan arsitektur ini dimulai.
- Rollout pola pilot ke 17 titik endpoint lain hasil audit Fase 2, supaya tenant yang sudah `schemaMigrated = true` benar-benar dilayani penuh dari schema barunya di semua fitur, bukan cuma satu endpoint pilot.
- Pembersihan data lama & tabel shared setelah semua tenant stabil di schema baru (Fase 6).

Setelah Fase 4 ini kamu coba dengan satu-dua tenant uji coba dan hasilnya sesuai ekspektasi, kabari saya untuk lanjut ke Fase 5 (provisioning otomatis untuk tenant baru).

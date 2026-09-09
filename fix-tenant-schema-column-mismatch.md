# Fix Kritis — Selaraskan Struktur Kolom Schema Tenant & Cegah Kehilangan Data Migrasi

**File terdampak:** `database/tenant-schema-template.sql`, `src/app/api/receipts/route.ts`, `scripts/migrate-tenant-data.js`
**Tingkat risiko:** 🔴 Kritis — Fase 4 (migrasi data) saat ini akan menyebabkan **error runtime** untuk tenant yang sudah dimigrasi, dan berpotensi **menghilangkan data secara diam-diam**
**Prasyarat:** Fase 1-4 (versi saat ini di repo) sudah ada.
**Sifat pekerjaan:** Perbaikan skema + query, harus selesai **sebelum** ada tenant sungguhan yang dimigrasi lewat `migrate-tenant-data.js`.

---

## 1. Masalah Secara Detail

### Bukti: Query Path A mereferensikan kolom yang tidak ada di template

Di `src/app/api/receipts/route.ts`, query untuk tenant yang sudah `schemaMigrated = true` ("Path A") mengambil kolom-kolom berikut:

```sql
SELECT
  r.id, r."merchantName", r.date, r."imageUrl", r.subtotal,
  r."discountAmount", r."taxAmount", r."totalAmount", r."paymentMethod",
  r."paymentStatus",        -- ❌ tidak ada di template
  r.note,                   -- ❌ tidak ada di template (nama sebenarnya: "notes")
  r."staffName",            -- ❌ tidak ada di template
  r."createdByRole",
  r."createdByUsername",    -- ❌ tidak ada di template
  r."createdAt", r."updatedAt",
  ...
  'price', i.price,         -- ❌ tidak ada di receipt_items template (nama sebenarnya: "unitPrice")
  'quantity', i.quantity    -- ❌ tidak ada di receipt_items template (nama sebenarnya: "qty")
```

Sementara `database/tenant-schema-template.sql` yang sekarang berlaku, tabel `receipts` isinya:

```sql
CREATE TABLE IF NOT EXISTS receipts (
    id, "tenantId", "merchantName", date, "imageUrl", subtotal,
    "discountAmount", "taxAmount", "totalAmount", "paymentMethod",
    category, status, "createdByName", "createdByRole",
    "confidenceScore", "processingTimeMs", "validationErrors",
    notes,                    -- bukan "note"
    "isApproved", "approvedBy", "approvedAt", "approvalStatus",
    "rejectedBy", "rejectedAt", "rejectionReason", "rawParsedText",
    "posSynced", "posSyncedAt", "createdAt", "updatedAt"
);
```

Tidak ada `paymentStatus`, `staffName`, `createdByUsername`. Begitu juga `receipt_items` template pakai `qty` + `unitPrice` + `totalPrice`, bukan `quantity` + `price`, dan **tidak punya kolom `subCategory` sama sekali**.

**Akibatnya:** begitu satu tenant berhasil `schemaMigrated = true`, endpoint `GET /api/receipts` untuk tenant itu akan gagal dengan error `column "paymentStatus" does not exist` (atau kolom lain yang hilang) — fitur utama aplikasi langsung tidak bisa dipakai untuk tenant tersebut.

### Kenapa ini terjadi

Struktur `receipts`/`receipt_items` di aplikasi sudah berkembang seiring fitur baru (alur approval, status verifikasi OCR, dsb.), dan `tenant-schema-template.sql` dibuat mengikuti struktur **terbaru** ini. Tapi query Path A di `receipts/route.ts` sepertinya masih memakai daftar kolom dari versi **lama**, tidak sempat disesuaikan saat template dibuat.

### Bukti kedua: Risiko kehilangan data saat migrasi

`scripts/migrate-tenant-data.js` menyalin data dengan mencari kolom yang **namanya dan tipenya cocok persis** antara tabel lama dan tabel baru (lewat `information_schema.columns`). Kolom yang tidak match otomatis **tidak ikut disalin** — tanpa error, tanpa peringatan.

Karena `paymentStatus`, `staffName`, `createdByUsername` (di `receipts`), dan `subCategory` (di `receipt_items`) tidak ada di template baru, data-data ini **akan hilang secara diam-diam** saat tenant dimigrasi. Ini bukan cuma cacat kosmetik:

- `paymentStatus` (Lunas/Belum Lunas) adalah data keuangan penting untuk pembukuan.
- `subCategory` dipakai aktif oleh fitur pencarian & filter kategori (ingat perbaikan bug `search`/`category` di awal-awal kerja kita) — kalau kolom ini hilang di schema tenant, fitur filter kategori akan berhenti berfungsi dengan benar untuk tenant yang sudah bermigrasi.

---

## 2. Prinsip Perbaikan

Ada dua jenis ketidakcocokan di sini, dan masing-masing diperbaiki dengan cara **berbeda**, tergantung apakah konsepnya benar-benar hilang atau cuma berganti nama:

| Kasus | Kolom lama | Kolom baru (template) | Keputusan |
|---|---|---|---|
| Cuma ganti nama, konsepnya sama | `note` | `notes` | **Perbaiki query** — pakai `notes`, jangan tambah kolom baru yang duplikat |
| Cuma ganti nama, konsepnya sama | `price`, `quantity` | `unitPrice`, `qty` | **Perbaiki query** — pakai nama baru, karena `totalPrice` yang sudah dihitung otomatis di migrasi (`unitPrice × qty`) memang desain yang lebih baik untuk didukung ke depan (misal kalau nanti ada diskon per-item) |
| Konsepnya benar-benar hilang, tidak ada padanan di template | `paymentStatus` | *(tidak ada)* | **Tambahkan kolom baru ke template** — jangan dipaksa gabung ke kolom lain, karena bisa mencampur dua makna berbeda tanpa dasar yang jelas |
| Konsepnya benar-benar hilang, tidak ada padanan di template | `staffName`, `createdByUsername` | *(tidak ada — ada `createdByName` tapi belum tentu makna yang sama persis)* | **Tambahkan kolom baru ke template**, jangan asal digabung ke `createdByName` tanpa konfirmasi bahwa keduanya memang dimaksudkan sama |
| Konsepnya benar-benar hilang, aktif dipakai fitur lain | `subCategory` | *(tidak ada)* | **Tambahkan kolom baru ke template** — wajib, karena fitur filter kategori bergantung ke kolom ini |

Prinsip ini penting diikuti supaya tidak ada keputusan "menggabungkan data" yang diambil sembarangan tanpa dasar yang jelas — kalau ternyata `staffName` dan `createdByName` memang dimaksudkan sebagai hal yang sama, itu keputusan konsolidasi yang bisa diambil **belakangan**, secara sadar, bukan efek samping tidak sengaja dari proses migrasi ini.

---

## 3. Kriteria Solusi (Acceptance Criteria)

- [ ] `database/tenant-schema-template.sql` — tabel `receipts` ditambah kolom: `"paymentStatus" TEXT NOT NULL DEFAULT 'Lunas'`, `"staffName" TEXT DEFAULT 'Admin'`, `"createdByUsername" TEXT`.
- [ ] `database/tenant-schema-template.sql` — tabel `receipt_items` ditambah kolom: `"subCategory" TEXT DEFAULT 'Umum'`.
- [ ] `src/app/api/receipts/route.ts` (Path A / blok `isMigrated`) — semua referensi `r.note` diganti `r.notes`, semua referensi `i.price` diganti `i."unitPrice"`, semua referensi `i.quantity` diganti `i.qty`. Referensi ke `r."paymentStatus"`, `r."staffName"`, `r."createdByUsername"`, `i."subCategory"` **tetap seperti sekarang** (sudah benar, tinggal kolomnya yang perlu ditambahkan ke template).
- [ ] `scripts/migrate-tenant-data.js` — blok khusus untuk `receipt_items` (yang sebelumnya hardcode karena perbedaan `price`/`quantity` vs `unitPrice`/`qty`) diperbarui supaya ikut menyalin `subCategory` (passthrough langsung, karena sekarang namanya sama persis di kedua sisi).
- [ ] Query Path A dan Path B (jalur lama, untuk tenant yang belum migrasi) **tetap menghasilkan bentuk response JSON yang identik** dari sudut pandang frontend — perbaikan ini murni internal (nama kolom SQL & tempat penyimpanan), tidak boleh mengubah kontrak API yang sudah dipakai halaman lain.
- [ ] Setelah perbaikan, migrasi ulang satu tenant uji coba (pakai `scripts/migrate-tenant-data.js`) menghasilkan **nol** kolom yang hilang — bandingkan manual isi baris sebelum & sesudah migrasi untuk memastikan `paymentStatus`, `staffName`, `createdByUsername`, `subCategory` benar-benar tersalin, bukan cuma "tidak error".
- [ ] `GET /api/receipts` untuk tenant uji coba yang sudah `schemaMigrated = true` berhasil dipanggil tanpa error, dan data yang tampil (termasuk `paymentStatus`, kategori/sub-kategori item) sama persis dengan sebelum migrasi.
- [ ] Fitur filter kategori & pencarian (yang sebelumnya sudah diperbaiki bug-nya di awal) tetap berfungsi normal untuk tenant yang sudah migrasi ke schema barunya.

---

## 4. Rencana Pengujian

| # | Skenario | Ekspektasi |
|---|----------|------------|
| 1 | Tenant uji coba dengan struk yang punya `paymentStatus = 'Belum Lunas'`, di-migrasi | Setelah migrasi, data di schema tenant tetap menunjukkan `paymentStatus = 'Belum Lunas'`, bukan default `'Lunas'` |
| 2 | Tenant uji coba dengan item struk yang punya `subCategory` custom (misal "Minuman Ringan"), di-migrasi | Setelah migrasi, `subCategory` tetap tersimpan sama, filter kategori berdasarkan sub-kategori ini tetap berfungsi |
| 3 | `GET /api/receipts` untuk tenant yang sudah `schemaMigrated = true` | Tidak ada error SQL, response menampilkan semua field yang sama seperti sebelum migrasi |
| 4 | `GET /api/receipts?category=Minuman` untuk tenant yang sudah migrasi | Struk dengan item sub-kategori terkait "Minuman" tetap muncul di hasil filter |
| 5 | Bandingkan response JSON `GET /api/receipts` untuk tenant yang **belum** migrasi (Path B, jalur lama) sebelum & sesudah perbaikan ini | Tidak ada perubahan sama sekali — perbaikan ini tidak boleh menyentuh perilaku Path B |
| 6 | Jalankan ulang `scripts/migrate-tenant-data.js` untuk tenant yang **sudah pernah** dimigrasi sebelum perbaikan ini (kalau ada) | Delta/kolom yang sebelumnya hilang ikut tersalin saat script dijalankan ulang (berkat `ON CONFLICT DO NOTHING` yang idempotent) — perlu pengecekan manual karena baris yang sudah lebih dulu tersalin tanpa kolom-kolom ini tidak akan otomatis "diperbarui" oleh `INSERT ... ON CONFLICT DO NOTHING` (baris duplikat berdasarkan `id` akan dilewati, bukan di-update) |

> **Catatan untuk skenario 6:** kalau ternyata sudah ada tenant yang telanjur dimigrasi **sebelum** perbaikan ini (dengan data yang hilang), `ON CONFLICT (id) DO NOTHING` di script migrasi **tidak akan memperbaiki** baris yang sudah lebih dulu masuk — perlu langkah tambahan (`UPDATE` manual, bukan `INSERT`) untuk mengisi kolom yang sebelumnya kosong pada baris yang sudah terlanjur ada. Ini dibahas di langkah 5 di bawah untuk berjaga-jaga.

---

## 5. Prompt Siap Pakai (Vibe Coding)

```
Perbaiki ketidaksesuaian struktur kolom antara database/tenant-schema-
template.sql dengan query di src/app/api/receipts/route.ts, yang saat
ini akan menyebabkan error SQL untuk tenant yang sudah schemaMigrated =
true, dan menyebabkan kehilangan data diam-diam saat migrasi lewat
scripts/migrate-tenant-data.js.

MASALAH:
1. Path A (blok kode yang dijalankan ketika isMigrated true) di
   src/app/api/receipts/route.ts mereferensikan kolom r."paymentStatus",
   r.note, r."staffName", r."createdByUsername", i.price, i.quantity -
   TIDAK SATU PUN kolom ini ada di database/tenant-schema-template.sql
   saat ini.
2. Akibatnya, scripts/migrate-tenant-data.js (yang menyalin data hanya
   untuk kolom yang namanya+tipenya cocok persis di kedua sisi) diam-
   diam TIDAK menyalin data payment status, nama staf, dan sub-kategori
   item, karena kolom tujuan yang cocok tidak ada.

YANG HARUS DILAKUKAN:

1. Di database/tenant-schema-template.sql, tambahkan ke tabel receipts
   (tempatkan berdekatan dengan kolom-kolom terkait yang sudah ada,
   sebelum ALTER TABLE ... ENABLE ROW LEVEL SECURITY di bagian bawah
   file):
   "paymentStatus" TEXT NOT NULL DEFAULT 'Lunas',
   "staffName" TEXT DEFAULT 'Admin',
   "createdByUsername" TEXT,

   JANGAN mengubah atau menghapus kolom "notes" yang sudah ada - kolom
   itu tetap dipakai, cuma nanti direferensikan dengan nama yang benar
   di query (lihat langkah 3).

2. Di database/tenant-schema-template.sql, tambahkan ke tabel
   receipt_items:
   "subCategory" TEXT DEFAULT 'Umum',

3. Di src/app/api/receipts/route.ts, HANYA di dalam blok Path A (kode
   yang dijalankan saat variabel isMigrated bernilai true, memakai
   withTenantSchema) - JANGAN ubah Path B (jalur lama untuk tenant yang
   belum migrasi):
   - Ganti semua referensi r.note menjadi r.notes
   - Ganti semua referensi i.price menjadi i."unitPrice"
   - Ganti semua referensi i.quantity menjadi i.qty
   - JANGAN ubah referensi r."paymentStatus", r."staffName",
     r."createdByUsername", i."subCategory" - itu sudah benar,
     tinggal kolomnya yang perlu ditambahkan lewat langkah 1 & 2.
   - Pastikan nama field yang dikembalikan ke frontend di response JSON
     TIDAK berubah (misal kalau sebelumnya response memakai key
     "price" dan "quantity" untuk tiap item, tetap gunakan key yang
     sama di JSON walau sumber datanya sekarang dari kolom "unitPrice"
     dan "qty" - supaya tidak ada breaking change untuk frontend yang
     sudah memakai response ini).

4. Di scripts/migrate-tenant-data.js, cari blok kode khusus untuk
   table === 'receipt_items' yang sudah ada (ada di dua tempat: initial
   copy dan delta copy), lalu tambahkan kolom "subCategory" ke daftar
   kolom yang disalin - sumbernya dari ri."subCategory" (kolom yang
   sudah ada di public.receipt_items dengan nama yang sama), disalin
   langsung tanpa perlu transformasi (berbeda dengan qty/unitPrice/
   totalPrice yang memang butuh perhitungan/rename).

5. Buat SATU file migrasi tambahan, database/migrations/005_backfill_
   missing_tenant_columns.sql, khusus untuk tenant yang MUNGKIN SUDAH
   TERLANJUR dimigrasi sebelum perbaikan ini (kalau ada). Isinya query
   template (dengan komentar penjelasan cara pakainya) yang melakukan
   UPDATE, bukan INSERT, untuk mengisi ulang kolom yang sebelumnya
   kosong pada baris yang sudah ada di schema tenant, dengan mengambil
   nilai dari tabel public yang sesuai. Jelaskan di komentar file ini
   bahwa script ini HANYA perlu dijalankan kalau memang sudah ada
   tenant yang dimigrasi sebelum perbaikan ini diterapkan - kalau belum
   ada tenant yang dimigrasi sama sekali, file ini tidak perlu
   dijalankan.

JANGAN mengubah struktur tabel lain (custom_categories, pending_
approvals, push_subscriptions, notifications) - berdasarkan pengecekan,
tabel-tabel itu tidak punya masalah ketidakcocokan kolom yang sama.

Setelah selesai, tunjukkan diff lengkap semua perubahan, dan jelaskan
langkah untuk menguji migrasi ulang satu tenant uji coba yang punya
data paymentStatus dan subCategory yang bervariasi, untuk memverifikasi
tidak ada lagi data yang hilang.
```

---

## 6. Catatan Tambahan

- Kolom-kolom baru di `receipts` template yang **tidak ada padanan lamanya** (`status`, `isApproved`, `approvalStatus`, `confidenceScore`, dst.) **tidak perlu** langkah khusus — untuk data lama yang dimigrasi, kolom-kolom ini otomatis memakai nilai `DEFAULT` yang sudah ditetapkan di template (misal `isApproved = true`, `approvalStatus = 'approved'`), yang secara logis sudah tepat: struk lama memang belum pernah melalui alur approval yang baru, jadi wajar dianggap "sudah selesai/disetujui" secara default.
- Setelah perbaikan ini selesai, sebaiknya jalankan ulang test dari Fase 2, 3, dan 4 (`scripts/test-tenant-isolation-fase2.ts`, `fase3.ts`, `fase4.ts`) untuk memastikan tidak ada regresi dari perubahan struktur kolom ini.
- Perbaikan ini murni menyelaraskan struktur — belum saatnya lanjut ke Fase 5 sampai ini beres, karena Fase 5 (provisioning tenant baru otomatis) akan memakai template yang sama, jadi kalau template masih salah, tenant baru pun akan mewarisi masalah yang sama sejak awal.

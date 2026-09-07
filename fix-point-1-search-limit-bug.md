# Fix #1 — Bug: Filter Search/Category Ter-apply Setelah `LIMIT` SQL

**File terdampak:** `src/app/api/receipts/route.ts` (fungsi `GET`)
**Tingkat risiko:** 🔴 Tinggi — data pencarian bisa salah/tidak lengkap
**Tipe pekerjaan:** Perbaikan logic query, tanpa mengubah skema database

---

## 1. Masalah Secara Detail

### Kode saat ini (root cause)

```ts
// 1) Query ke Postgres — LIMIT diterapkan di sini
const pgRes = await queryPg(
  `SELECT r.id, r."tenantId", r."merchantName", ...
   FROM receipts r
   LEFT JOIN receipt_items i ON i."receiptId" = r.id
   WHERE r."tenantId" = $1
   GROUP BY r.id
   ORDER BY r."createdAt" DESC
   ${limit ? `LIMIT ${limit}` : ""}`,
  [targetTenantId]
)
receipts = pgRes.rows || []

// 2) Filter search/category BARU dijalankan di JavaScript, SETELAH data dibatasi
if (search || category) {
  receipts = receipts.filter((r) => {
    const matchesSearch = ... // cek merchantName, note, paymentMethod, items
    const matchesCategory = ... // cek category/subCategory item
    return matchesSearch && matchesCategory
  })
}
```

### Kenapa ini bug

Urutan eksekusinya salah:

1. Database dulu memotong hasil jadi maksimal `limit` baris (misal 50 struk terbaru).
2. **Baru setelah itu** aplikasi mencari kata kunci `search` di antara 50 baris tersebut.

Kalau struk yang cocok dengan pencarian user ternyata ada di baris ke-51 dan seterusnya, struk itu **tidak akan pernah muncul** — bukan karena tidak ada di database, tapi karena sudah terpotong duluan sebelum sempat dicek kecocokannya.

### Skenario nyata yang terdampak

- User mengetik nama toko di kolom pencarian, tapi transaksi tersebut terjadi 2 bulan lalu dan tenant sudah punya ratusan struk baru sesudahnya → hasil pencarian kosong, padahal datanya ada.
- Frontend yang mengirim `limit`/`take` bersamaan dengan `search` (umum untuk pagination) akan selalu berisiko kena bug ini.
- Efek sampingnya: developer atau user bisa mengira "data hilang" atau "salah simpan", padahal sebenarnya bug di lapisan query.

### Masalah tambahan (terkait, level lebih rendah)

Ketika `search`/`category` dipakai **tanpa** `limit`, kode saat ini menarik **seluruh baris tenant** ke memory Node.js dulu baru difilter. Untuk tenant dengan struk sangat banyak, ini boros memori & lambat dibanding memfilter langsung di database.

---

## 2. Kriteria Solusi (Acceptance Criteria)

Perbaikan dianggap selesai jika semua berikut terpenuhi:

- [ ] Filter `search` dan `category` dijalankan **di dalam query SQL** (klausa `WHERE`), bukan di JavaScript setelah data ditarik.
- [ ] `LIMIT` tetap diterapkan **setelah** semua filter, sehingga hasil yang dibatasi adalah hasil yang sudah benar-benar cocok dengan pencarian.
- [ ] Pencarian tetap mencakup semua field yang sebelumnya dicek: `merchantName`, `note`, `paymentMethod` (level struk), serta `name`, `category`, `subCategory` (level item struk).
- [ ] Filter `category` tetap mendukung pola lama: kategori penuh (`"Makanan/Minuman Ringan"`) maupun kata kunci induk saja (`"Makanan"` cocok ke semua sub-kategori di bawahnya).
- [ ] Isolasi tenant (`WHERE r."tenantId" = $1`) **tidak berubah** — tetap parameterized, tidak boleh ada celah kebocoran data antar tenant.
- [ ] Struk yang lolos filter tetap membawa **seluruh item miliknya** di array `items` (bukan cuma item yang cocok pencarian) — perilaku ini harus sama seperti sebelumnya.
- [ ] Tidak ada SQL injection baru: semua nilai dari `search`/`category`/`limit` tetap masuk lewat parameter query (`$1, $2, ...`), tidak digabung langsung ke string SQL.
- [ ] `cacheKey` untuk in-memory list cache tetap valid dan tidak perlu diubah strukturnya.
- [ ] Endpoint lain yang memanggil fungsi/pola serupa (kalau ada) ikut diperiksa — tapi untuk iterasi ini fokus hanya di `GET` pada `src/app/api/receipts/route.ts`.

---

## 3. Rencana Implementasi

### Langkah 1 — Pahami kenapa tidak bisa langsung `WHERE i.column ILIKE ...`

Query ini pakai `LEFT JOIN receipt_items i` + `json_agg(...)` untuk mengumpulkan semua item per struk dalam satu baris. Kalau filter `search`/`category` ditaruh langsung di `WHERE i.name ILIKE ...`, itu akan **memfilter baris JOIN sebelum agregasi**, sehingga:

- Item yang tidak cocok akan hilang dari `json_agg` (padahal seharusnya semua item struk tetap tampil), **atau**
- Struk yang cocok hanya lewat field level-struk (misal `merchantName`) tapi tidak ada item yang cocok, malah ikut ter-drop karena JOIN-nya jadi INNER secara efektif.

Solusinya: gunakan **subquery `EXISTS`** untuk menentukan struk mana yang lolos filter, sementara `LEFT JOIN` + `json_agg` utama tetap mengumpulkan semua item apa adanya.

### Langkah 2 — Susun ulang query dengan `WHERE ... EXISTS (...)`

Ganti query di dalam blok `if (isDatabaseConfigured)` menjadi seperti berikut (parameter disusun urut: tenantId, search, search-like, category, category-like, root-like):

```ts
const searchTrim = search.trim()
const categoryTrim = category.trim()
const rootTrim = rootKeyword.trim()

const params: any[] = [targetTenantId]
const conditions: string[] = [`r."tenantId" = $1`]

if (searchTrim) {
  params.push(`%${searchTrim}%`)
  const p = `$${params.length}`
  conditions.push(`(
    r."merchantName" ILIKE ${p} OR
    r.note ILIKE ${p} OR
    r."paymentMethod" ILIKE ${p} OR
    EXISTS (
      SELECT 1 FROM receipt_items si
      WHERE si."receiptId" = r.id
        AND (si.name ILIKE ${p} OR si.category ILIKE ${p} OR si."subCategory" ILIKE ${p})
    )
  )`)
}

if (categoryTrim) {
  params.push(`%${categoryTrim}%`)
  const catP = `$${params.length}`
  params.push(`%${rootTrim}%`)
  const rootP = `$${params.length}`
  conditions.push(`EXISTS (
    SELECT 1 FROM receipt_items ci
    WHERE ci."receiptId" = r.id
      AND (ci.category ILIKE ${catP} OR ci."subCategory" ILIKE ${catP} OR ci.category ILIKE ${rootP})
  )`)
}

const whereClause = conditions.join(" AND ")
const limitClause = limit ? `LIMIT ${limit}` : ""

const pgRes = await queryPg(
  `SELECT
     r.id,
     r."tenantId",
     r."merchantName",
     r.date,
     r."imageUrl",
     r.subtotal,
     r."discountAmount",
     r."taxAmount",
     r."totalAmount",
     r."paymentMethod",
     r."paymentStatus",
     r.note,
     r."staffName",
     r."createdAt",
     r."updatedAt",
     COALESCE(
       json_agg(
         json_build_object(
           'id', i.id,
           'name', i.name,
           'category', i.category,
           'subCategory', i."subCategory",
           'price', i.price,
           'quantity', i.quantity
         )
       ) FILTER (WHERE i.id IS NOT NULL),
       '[]'::json
     ) as items
   FROM receipts r
   LEFT JOIN receipt_items i ON i."receiptId" = r.id
   WHERE ${whereClause}
   GROUP BY r.id
   ORDER BY r."createdAt" DESC
   ${limitClause}`,
  params
)
receipts = pgRes.rows || []
```

> Catatan: `limit` di sini aman digabung langsung ke string SQL (bukan lewat `$n`) karena sudah dipaksa jadi angka lewat `Math.min(Math.max(Number(...), 1), 1000)` di baris sebelumnya — bukan string mentah dari user. Pola ini konsisten dengan kode asli, jadi tidak menambah risiko baru.

### Langkah 3 — Hapus blok filter in-memory yang lama

Hapus seluruh blok ini karena fungsinya sudah digantikan oleh `WHERE ... EXISTS` di query:

```ts
// HAPUS blok ini setelah query di atas diterapkan
if (search || category) {
  const searchLower = search.toLowerCase().trim()
  ...
  receipts = receipts.filter((r: any) => { ... })
}
```

Bagian **setelah** blok ini (normalisasi kategori pakai `getOrSeedCategories()`, dsb) **tidak perlu diubah** — itu proses yang berbeda (mapping nama kategori lama ke hierarki baru), bukan bagian dari filter pencarian.

### Langkah 4 — Pastikan `cacheKey` tetap benar

`cacheKey` sudah menyertakan `search`, `category`, dan `limit` mentah dari user:

```ts
const cacheKey = `${targetTenantId}_${search}_${category}_${limit || "all"}`
```

Ini tetap valid tanpa perubahan — cache akan otomatis "miss" kalau kombinasi filter berbeda, jadi tidak perlu disentuh.

---

## 4. Rencana Pengujian Manual

Setelah perubahan diterapkan, uji skenario berikut di environment development (pastikan `DATABASE_URL` aktif dan ada data struk):

| # | Skenario | Ekspektasi |
|---|----------|------------|
| 1 | `GET /api/receipts?search=indomaret&limit=5` dengan struk "Indomaret" yang bukan 5 struk terbaru | Struk tetap muncul di hasil |
| 2 | `GET /api/receipts?category=Makanan` | Semua struk dengan item berkategori "Makanan/..." muncul, item non-Makanan di struk lain tidak ikut nyasar |
| 3 | `GET /api/receipts` tanpa parameter apa pun | Perilaku sama seperti sebelumnya (semua struk tenant, urut terbaru) |
| 4 | `GET /api/receipts?search=` (string kosong) | Tidak error, berperilaku sama seperti tanpa `search` |
| 5 | Bandingkan hasil `items` pada satu struk yang lolos filter `search` by `merchantName` saja | Array `items` tetap berisi **semua** item struk tersebut, bukan cuma yang cocok kata kunci |
| 6 | Superadmin memakai `?tenantId=<tenant-lain>` | Tetap hanya menampilkan data tenant yang diminta, tidak bocor ke tenant lain |
| 7 | Cek log/response saat `DATABASE_URL` tidak terkonfigurasi | Tidak crash, tetap fallback seperti sebelumnya (`receipts = []`) |

---

## 5. Prompt Siap Pakai (untuk Vibe Coding / Claude Code)

Salin blok di bawah ini dan berikan ke LLM coding assistant (mis. Claude Code) untuk eksekusi perbaikan:

```
Perbaiki bug di file src/app/api/receipts/route.ts pada fungsi GET.

MASALAH:
Saat ini query Postgres menerapkan LIMIT terlebih dahulu, baru filter
`search` dan `category` dijalankan di JavaScript setelah data ditarik
(lihat blok "In-memory filter for search/category criteria"). Ini
menyebabkan struk yang cocok dengan pencarian bisa tidak muncul kalau
posisinya berada di luar batas LIMIT sebelum difilter.

YANG HARUS DILAKUKAN:
1. Pindahkan logic filter `search` dan `category` ke klausa WHERE pada
   query SQL, menggunakan parameter terikat (parameterized query, pakai
   $1, $2, dst — JANGAN interpolasi string mentah untuk mencegah SQL
   injection).
2. Karena query memakai LEFT JOIN ke receipt_items + json_agg untuk
   mengumpulkan semua item per struk, JANGAN taruh kondisi filter
   langsung di WHERE pada kolom item (itu akan merusak agregasi dan
   menghilangkan item yang tidak cocok dari hasil array `items`).
   Gunakan subquery EXISTS terhadap receipt_items untuk menentukan
   struk mana yang lolos filter, sementara JOIN utama tetap mengambil
   SEMUA item milik struk yang lolos.
3. Filter search harus tetap mencakup: r."merchantName", r.note,
   r."paymentMethod" (level struk), dan i.name, i.category,
   i."subCategory" (level item) — gunakan ILIKE dengan pola '%...%'.
4. Filter category harus tetap mendukung pencarian kategori penuh
   (mis. "Makanan/Minuman Ringan") maupun kata kunci induk saja
   (mis. "Makanan" cocok ke semua sub-kategorinya) — sama seperti
   logic `rootKeyword` yang sudah ada di kode saat ini.
5. LIMIT tetap diterapkan di akhir query, SETELAH WHERE, sehingga hasil
   yang dibatasi adalah hasil yang sudah difilter dengan benar.
6. WHERE r."tenantId" = $1 harus tetap ada dan tetap parameterized —
   jangan ubah isolasi tenant.
7. Hapus blok filter in-memory (`receipts.filter(...)` untuk search/
   category) yang sekarang jadi redundan, tapi JANGAN hapus proses
   normalisasi kategori (`getOrSeedCategories`) yang ada setelah blok
   itu — itu proses berbeda dan tetap dibutuhkan.
8. Jangan ubah bagian lain dari file (response shape, cache logic,
   endpoint POST/lainnya) kecuali memang diperlukan.

Setelah selesai, tunjukkan diff lengkap dari perubahan yang dilakukan.
```

---

## 6. Yang TIDAK Termasuk di Fix Ini

Supaya scope tetap kecil dan aman untuk sekali deploy:

- Perbaikan performa lain (indexing tambahan, full-text search) — bisa jadi task terpisah kalau `ILIKE` masih terasa lambat di skala besar.
- Perubahan pada endpoint `src/app/api/receipts/[id]/route.ts` atau `export/route.ts` — belum diperiksa apakah punya pola bug serupa, cek terpisah.
- Perubahan skema database (`database/schema.sql`) — fix ini murni logic query, tidak butuh migrasi.

# Audit Titik Query Migrasi Isolasi Tenant (Fase 2, 3, & 4 - SELESAI)

Dokumen ini berisi hasil audit komprehensif terhadap seluruh file di `src/` yang berinteraksi langsung dengan 6 tabel operasional yang diisolasi per-schema tenant.

---

## 📊 Matriks Status Migrasi (100% Selesai)

| Tabel | Titik Query di Codebase (`src/`) | Status Implementasi |
|---|---|---|
| **`receipts`** | • `src/app/api/receipts/route.ts` *(GET, POST, DELETE, PATCH)*<br>• `src/app/api/receipts/[id]/route.ts` *(GET, PUT, DELETE)*<br>• `src/app/api/receipts/export/route.ts` *(XLSX, CSV, Jurnal, Accurate)*<br>• `src/app/api/approvals/route.ts` *(GET list & approval previews)*<br>• `src/app/api/approvals/[id]/approve/route.ts` *(Mutasi nota di schema target)*<br>• `src/app/api/parse-receipt/route.ts` *(Memanggil issueDemoSession / output JSON)*<br>• `src/app/api/auth/register/route.ts` *(JIT provisioning & demo receipt claim)*<br>• `src/app/api/backup/route.ts` *(Dual-path tenant export & restore)*<br>• `src/app/api/superadmin/receipts/route.ts` *(Cross-tenant union aggregation)* | ✅ **SELESAI (100%)**<br>Lulus pengujian siklus penuh via `test-tenant-receipts-full-cycle.ts` & `test-cross-tenant-and-backup.ts` |
| **`receipt_items`** | • `src/app/api/receipts/route.ts` *(GET, POST)*<br>• `src/app/api/receipts/[id]/route.ts` *(GET, PUT, cascade DELETE)*<br>• `src/app/api/receipts/export/route.ts`<br>• `src/app/api/approvals/route.ts`<br>• `src/app/api/approvals/[id]/approve/route.ts`<br>• `src/app/api/backup/route.ts` *(Export & Restore)* | ✅ **SELESAI (100%)**<br>Diproyeksikan transparan (`unitPrice as price`, `qty as quantity`) tanpa mengubah kontrak frontend. |
| **`custom_categories`** | • `src/app/api/categories/route.ts` *(GET, POST)*<br>• `src/app/api/categories/[id]/route.ts` *(PUT, DELETE cascade)*<br>• `src/lib/categories.ts` *(getOrSeedCategories per schema)*<br>• `src/app/api/backup/route.ts` *(Export & Restore)* | ✅ **SELESAI (100%)**<br>Mendukung hirarki subkategori (`parentId`), auto-seeding di skema terisolasi. |
| **`pending_approvals`** | • `src/app/api/approvals/route.ts` *(GET, POST)*<br>• `src/app/api/approvals/[id]/approve/route.ts` *(Approve status & trigger nota mutasi)*<br>• `src/app/api/approvals/[id]/reject/route.ts` *(Reject status & reason)*<br>• `src/app/api/receipts/route.ts` *(Karyawan create, bulk delete, bulk settle approval)*<br>• `src/app/api/receipts/[id]/route.ts` *(Karyawan edit & delete approval)* | ✅ **SELESAI (100%)**<br>Penyimpanan request dan lifecycle approval 100% terisolasi per tenant. |
| **`push_subscriptions`** | • `src/app/api/push/subscribe/route.ts` *(Save endpoint)*<br>• `src/app/api/push/unsubscribe/route.ts` *(Remove endpoint)*<br>• `src/lib/serverPush.ts` *(Query & prune stale endpoints)* | ✅ **SELESAI (100%)**<br>Penyimpanan subscription PWA terisolasi per tenant. |
| **`notifications`** | • `src/app/api/notifications/route.ts` *(GET, PATCH single & all read)*<br>• `src/app/api/approvals/**` *(Insert notifikasi approve/reject)*<br>• `src/app/api/receipts/**` *(Insert notifikasi pengajuan staf)* | ✅ **SELESAI (100%)**<br>Notifikasi tersimpan di skema tenant dengan universal bypass untuk `SUPERADMIN`. |

---

## 🔍 Titik Cross-Tenant & Backup Platform (Telah Dituntaskan)

1. **`src/app/api/superadmin/receipts/route.ts`:**
   * Membaca seluruh skema tenant aktif (`tenant_%`) secara dinamis via `information_schema.schemata`.
   * Menggabungkan nota dari seluruh tenant terisolasi dan tabel `public.receipts` menggunakan `UNION ALL`.
   * Mengaktifkan bypass PostgreSQL Row-Level Security (`set_config('app.is_superadmin', 'true', false)`).
   * Lulus verifikasi integrasi: Superadmin berhasil mengagregasi data nota dari skema terisolasi.
2. **`src/app/api/backup/route.ts`:**
   * `GET`: Mengekspor data nota, item nota, dan kategori kustom langsung dari skema tenant via `withTenantSchema()` jika tenant telah dimigrasikan.
   * `POST`: Mengimpor / memulihkan data cadangan langsung ke dalam skema tenant terisolasi.
3. **`scripts/reconcile-tenant-migration.js`:**
   * Script rekonsiliasi otomatis untuk memverifikasi dan menyalin baris yang tertinggal di tabel public ke skema tenant terisolasi.
   * Teruji dan terverifikasi mampu mendeteksi serta memperbaiki inkonsistensi secara otomatis (*100% In Sync*).

---

## 🏁 Kesimpulan Audit
Seluruh 6 tabel operasional kini telah 100% terisolasi per-schema tanpa kebocoran data (*zero cross-tenant leak*), tetap menjaga kompatibilitas mundur untuk tenant legacy, dan seluruh endpoint platform telah divalidasi dengan test suites otomatis.

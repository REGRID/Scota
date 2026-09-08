# Audit Titik Query Migrasi Isolasi Tenant (Fase 2)

Dokumen ini berisi hasil audit komprehensif terhadap seluruh file di `src/` yang berinteraksi langsung dengan 6 tabel operasional yang akan diisolasi per-schema tenant.

---

## 📊 Matriks Status Migrasi

| Tabel | Titik Query di Codebase (`src/`) | Status Fase 2 |
|---|---|---|
| **`receipts`** | • `src/app/api/receipts/route.ts` *(GET)*<br>• `src/app/api/receipts/route.ts` *(POST, PUT, DELETE)*<br>• `src/app/api/receipts/[id]/route.ts`<br>• `src/app/api/receipts/export/route.ts`<br>• `src/app/api/approvals/route.ts`<br>• `src/app/api/approvals/[id]/approve/route.ts`<br>• `src/app/api/parse-receipt/route.ts`<br>• `src/app/api/auth/register/route.ts`<br>• `src/app/api/backup/route.ts` *(Cross-Tenant)*<br>• `src/app/api/superadmin/receipts/route.ts` *(Cross-Tenant)*<br>• `src/lib/superadmin.ts` *(Cross-Tenant)* | ✅ **GET `api/receipts` (Pilot Selesai)**<br>⏳ Titik lain dijadwalkan untuk Fase berikutnya |
| **`receipt_items`** | • `src/app/api/receipts/route.ts` *(GET)*<br>• `src/app/api/receipts/route.ts` *(POST, PUT)*<br>• `src/app/api/receipts/[id]/route.ts`<br>• `src/app/api/receipts/export/route.ts`<br>• `src/app/api/approvals/route.ts`<br>• `src/app/api/approvals/[id]/approve/route.ts`<br>• `src/app/api/parse-receipt/route.ts`<br>• `src/app/api/backup/route.ts` *(Cross-Tenant)* | ✅ **GET `api/receipts` (Pilot Selesai)**<br>⏳ Titik lain dijadwalkan untuk Fase berikutnya |
| **`custom_categories`** | • `src/app/api/categories/route.ts`<br>• `src/app/api/categories/[id]/route.ts`<br>• `src/lib/categories.ts`<br>• `src/app/api/backup/route.ts` *(Cross-Tenant)* | ⏳ Dijadwalkan untuk Fase berikutnya |
| **`pending_approvals`** | • `src/app/api/approvals/route.ts`<br>• `src/app/api/approvals/[id]/approve/route.ts`<br>• `src/app/api/approvals/[id]/reject/route.ts`<br>• `src/app/api/receipts/route.ts`<br>• `src/app/api/receipts/[id]/route.ts` | ⏳ Dijadwalkan untuk Fase berikutnya |
| **`push_subscriptions`** | • `src/app/api/push/subscribe/route.ts`<br>• `src/app/api/push/unsubscribe/route.ts`<br>• `src/lib/serverPush.ts` | ⏳ Dijadwalkan untuk Fase berikutnya |
| **`notifications`** | • `src/app/api/notifications/route.ts`<br>• `src/app/api/approvals/route.ts`<br>• `src/app/api/approvals/[id]/approve/route.ts`<br>• `src/app/api/approvals/[id]/reject/route.ts`<br>• `src/app/api/receipts/route.ts`<br>• `src/app/api/receipts/[id]/route.ts` | ⏳ Dijadwalkan untuk Fase berikutnya |

---

## 🔍 Catatan Khusus Titik Cross-Tenant (Lintas-Schema)

File-file berikut ini memerlukan perlakuan khusus karena berjalan di level Superadmin atau Backup Platform yang membutuhkan agregasi lintas-tenant:
1. `src/lib/superadmin.ts` & `src/app/api/superadmin/receipts/route.ts`:
   * Mengumpulkan statistik platform dan daftar nota seluruh tenant.
   * *Rencana:* Akan menggunakan query loop schema atau view agregasi di schema `public`.
2. `src/app/api/backup/route.ts`:
   * Export database backup.
   * *Rencana:* Menjalankan export per-schema secara terstruktur.

---

## 🛠️ Implementasi Pilot (Fase 2)
Endpoint **`GET /api/receipts`** telah diimplementasikan sebagai pilot menggunakan `isTenantSchemaMigrated()` dan `withTenantSchema()`.
* **Tenant Legacy (`schemaMigrated = false`):** Berjalan melalui query tabel shared `public.receipts WHERE "tenantId" = $1`.
* **Tenant Baru / Migrated (`schemaMigrated = true`):** Berjalan melalui query schema terisolasi `SET search_path TO "tenant_<id>", public`.

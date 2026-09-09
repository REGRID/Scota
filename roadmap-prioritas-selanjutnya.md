# Roadmap Prioritas Selanjutnya — Detail Lengkap

Dokumen ini merangkum 4 pekerjaan prioritas berikutnya, diurutkan dari dampak paling besar. Detail teknis lengkap untuk masing-masing sudah pernah dibahas di dokumen terpisah sebelumnya — di sini digabung jadi satu peta kerja dengan kriteria "selesai" yang jelas untuk tiap poin.

---

## Prioritas 1 — Selesaikan Multi-Role Permission Enforcement

**Kenapa ini paling mendesak:** begitu ada bisnis nyata pakai fitur "tambah staf", tanpa pengecekan role di endpoint sensitif, **setiap KARYAWAN yang login bisa menghapus nota siapa saja di tenant yang sama** — bukan cuma soal fitur belum lengkap, ini celah keamanan level-tenant yang aktif kalau dibiarkan.

### Status saat ini
- ❌ `src/lib/roleGuard.ts` belum dibuat
- ❌ `requireRole()` belum dipanggil di endpoint manapun
- ❌ `/api/settings/staff` belum ada (halaman Settings kemungkinan masih data contoh/mock)
- ✅ Filter "KARYAWAN cuma lihat nota sesama KARYAWAN" sudah sebagian jalan di `GET /api/receipts` (tapi punya masalah data hygiene — nama staf hardcoded di query, perlu dibersihkan)

### Langkah eksekusi (urutan yang disarankan)

1. **Buat `src/lib/roleGuard.ts`** — helper `requireRole(req, allowedRoles)`, pola sama seperti `requireSuperadmin` yang sudah ada, dengan `SUPERADMIN` selalu lolos apa pun daftarnya.
2. **Backfill data lama dulu** sebelum ubah query — jalankan SQL sekali untuk isi `createdByRole` yang masih `NULL` berdasarkan heuristik nama staf lama, baru setelah itu hapus fallback `ILIKE` nama-nama hardcoded dari `receipts/route.ts`.
3. **Terapkan `requireRole()` di titik-titik ini:**

| Endpoint | Role yang diizinkan |
|---|---|
| `DELETE /api/receipts/[id]`, bulk delete di `receipts/route.ts` | `OWNER`, `ADMIN` |
| `POST /api/approvals/[id]/approve`, `.../reject` | `OWNER`, `ADMIN`, `MANAGER` |
| `GET/POST/DELETE /api/settings/staff` (baru) | `OWNER`, `ADMIN` |

4. **Buat `/api/settings/staff`** (GET list staf tenant, POST tambah staf baru — `role` dibatasi `KARYAWAN`/`MANAGER`/`ADMIN`, tidak boleh `OWNER` lewat form ini; DELETE hapus staf, cegah hapus akun sendiri).
5. **Terapkan filter `createdByRole` juga di `receipts/export/route.ts`** — saat ini export mengambil semua nota tenant tanpa mempertimbangkan siapa boleh lihat apa, jadi KARYAWAN bisa saja tetap dapat laporan lengkap lewat jalur export walau dashboard-nya sudah difilter.
6. **Sambungkan `src/app/settings/page.tsx`** — ganti `useState` data contoh jadi `fetch` ke API baru, samakan tipe role (`ADMIN`/`MANAGER`/`KARYAWAN`, buang `MANAJER`/`KASIR`/`AUDITOR` yang tidak match backend).

### Kriteria "selesai"
- [ ] KARYAWAN yang coba `DELETE` nota → `403`
- [ ] MANAGER bisa approve, tapi `DELETE` tetap `403`
- [ ] Tambah staf lewat Settings → refresh halaman → staf tetap ada (bukan cuma di memori browser)
- [ ] `SELECT count(*) FROM receipts WHERE "createdByRole" IS NULL` → `0`

---

## Prioritas 2 — Tuntaskan Migrasi Tenant Per-Schema (Fase 3 & 4)

**Kenapa penting:** ini fondasi isolasi data yang jauh lebih kuat dari sekadar kolom `tenantId`. Progress sudah bagus (commit terakhir menangani parity kolom antar schema), tapi berdasarkan audit mereka sendiri, baru **1 dari puluhan titik query** yang selesai.

### Status saat ini (dari `docs/tenant-migration-audit.md`)

| Tabel | Yang sudah selesai | Yang masih tertunda |
|---|---|---|
| `receipts` / `receipt_items` | `GET /api/receipts` (pilot) | POST, PUT, DELETE, `[id]/route.ts`, `export`, `approvals/**`, `parse-receipt`, `register`, `backup` (cross-tenant), `superadmin/receipts` (cross-tenant) |
| `custom_categories` | — | Semua titik |
| `pending_approvals` | — | Semua titik |
| `push_subscriptions` | — | Semua titik |
| `notifications` | — | Semua titik |

### Langkah eksekusi

1. **Selesaikan dulu 1 tabel penuh (`receipts`) sebelum lanjut ke tabel lain** — supaya minimal ada 1 alur kerja (scan → simpan → lihat → edit → hapus → export) yang 100% konsisten di kedua model (legacy & migrated), bukan tersebar setengah-setengah di banyak tabel sekaligus.
   - Urutan dalam tabel `receipts`: POST (create) → PUT (edit) → DELETE → `[id]/route.ts` → `export` → `approvals/**` → `parse-receipt` → `register` (provisioning tenant baru langsung ke schema baru, bukan shared table lagi).
2. **Titik cross-tenant (`backup`, `superadmin/receipts`, `superadmin.ts`) dikerjakan terakhir** — ini butuh pendekatan berbeda (loop per-schema atau view agregasi), lebih kompleks, tidak memblokir tabel lain untuk selesai duluan.
3. **Setelah `receipts` 100% tuntas**, lanjut `custom_categories` → `pending_approvals` → `notifications` → `push_subscriptions` (urutan berdasarkan seberapa sering tabel itu diakses/seberapa sensitif datanya).
4. **JANGAN jalankan `migrate-tenant-data.js` untuk tenant produksi manapun** sampai minimal seluruh titik query `receipts` (bukan cuma GET) sudah konsisten — kalau tidak, tenant yang dimigrasikan akan mengalami "data kepisah" (baca dari schema baru, tulis ke tabel lama) persis seperti yang sudah pernah dibahas.

### Kriteria "selesai" (per tabel)
- [ ] Semua titik query di tabel tersebut (lihat kolom "Titik Query" di audit doc) sudah pakai `withTenantSchema()`/`isTenantSchemaMigrated()`
- [ ] `scripts/reconcile-tenant-migration.js` dijalankan dan hasilnya bersih (tidak ada data yang tertinggal di lokasi lama)
- [ ] Test end-to-end: buat 1 tenant baru, migrasikan schema-nya, lakukan create/edit/delete/export lewat UI biasa (bukan langsung ke DB) → semua berhasil tanpa data hilang

---

## Prioritas 3 — Verifikasi Konfigurasi Clerk Dashboard (Opsi B)

**Kenapa ini beda dari yang lain:** ini satu-satunya langkah yang **tidak bisa diverifikasi lewat kode** — murni pengaturan di dashboard.clerk.com, harus dicek manual.

### Checklist

- [ ] **User & Authentication → Email, Phone, Username** → **Password** aktif sebagai strategi (bukan cuma magic link/kode email)
- [ ] **User & Authentication → Social Connections** → **Google** berstatus **Enabled**, Client ID/Secret dari Google Cloud Console sudah terisi dan valid
- [ ] Buka `/register` di browser setelah deploy → widget menampilkan **dua-duanya**: field email/password DAN tombol "Continue with Google" dalam satu tampilan
- [ ] **Webhooks** → endpoint `https://scota.web.id/api/webhooks/clerk` terdaftar, event `user.updated` dan `user.deleted` dicentang, `CLERK_WEBHOOK_SIGNING_SECRET` sudah disalin ke Vercel Environment Variables
- [ ] Coba sign-up baru lewat Google di production → cek tabel `tenants`/`admin_accounts` → tenant baru otomatis terbuat dengan `clerkId` terisi, tier `trial` aktif (memverifikasi JIT provisioning benar-benar jalan di production, bukan cuma di kode)

---

## Prioritas 4 — Housekeeping (Prioritas Rendah, Tidak Mendesak)

Tidak ada risiko aktif kalau ditunda, tapi baik dibereskan setelah 3 prioritas di atas selesai supaya kompleksitas tidak terus menumpuk:

1. **Hapus `next-auth`/`src/auth.ts`/`src/app/api/auth/[...nextauth]`** — sudah sepenuhnya redundan sejak Clerk aktif menangani Google OAuth sendiri. Cek dulu tidak ada import yang masih memakainya (`grep -rln "from \"@/auth\"\|from \"next-auth\"" src/`) sebelum dihapus.
2. **Fitur "struk demo ikut terbawa ke akun baru"** (`claimReceipt`) — kalau mau menaikkan konversi dari demo ke trial, ini nilai tambah yang sudah punya rancangan lengkap, tinggal dieksekusi kapan pun ada waktu luang.
3. **Audit ulang `push/test`, `pos/test-sync`** — endpoint uji coba internal yang sebaiknya tidak ikut ter-deploy ke production sama sekali (bukan soal keamanan lagi karena middleware sudah menutupnya, murni kerapian).

---

## Ringkasan Urutan Kerja

```
1. Multi-role (roleGuard + staff API)     <- mulai dari sini, risiko keamanan aktif
2. Tenant schema Fase 3 (receipts penuh)  <- lanjutkan yang sudah berjalan
3. Clerk Dashboard config                 <- cepat, tinggal cek & centang
4. Tenant schema Fase 4 (tabel lain)      <- setelah receipts 100% tuntas
5. Housekeeping                           <- kapan pun ada waktu luang
```

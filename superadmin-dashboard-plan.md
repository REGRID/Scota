# Rencana Pengembangan Dashboard Superadmin — Manajemen Tenant (Scota)

> Dokumen ini merangkum apa saja yang perlu disiapkan untuk membangun dashboard superadmin
> guna mengelola tenant/pelanggan yang berlangganan di aplikasi **Scota** (repo: `REGRID/Scota`).

**Stack terdeteksi dari repo:**
- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`, `pg`) sebagai database Postgres + Auth
- shadcn/ui + Tailwind v4
- recharts (grafik), jspdf & xlsx (export), tesseract.js + @google/genai (OCR nota), web-push (notifikasi)
- Folder `prisma/` ada tapi `@prisma/client` belum jadi dependency — kemungkinan belum aktif dipakai

---

## 1. Struktur Database (Supabase / Postgres)

Tabel inti yang perlu dibuat (via migration Supabase):

| Tabel | Kolom Penting | Keterangan |
|---|---|---|
| `tenants` | id, nama, slug, status (`trial`/`active`/`suspended`/`cancelled`), created_at | Data utama tenant |
| `plans` | id, nama, harga, limit_fitur (max nota/bulan, max user, storage) | Master paket langganan |
| `subscriptions` | id, tenant_id (FK), plan_id (FK), status_bayar, tanggal_mulai, tanggal_berakhir | Riwayat & status langganan aktif |
| `tenant_users` | id, tenant_id (FK), user_id (FK ke auth.users), role | Relasi user ↔ tenant |
| `superadmins` | id, user_id (FK ke auth.users) | Daftar user dengan akses superadmin — **terpisah** dari role tenant biasa |
| `audit_logs` | id, superadmin_id, action, target_tenant_id, detail, created_at | Jejak aksi superadmin (suspend, ubah plan, dll) |
| `invoices` / `payments` | id, tenant_id, jumlah, status, metode, created_at | Riwayat transaksi (jika ada payment gateway) |

**Row Level Security (RLS):**
- Aktifkan RLS di semua tabel tenant-scoped agar user biasa hanya bisa lihat data tenant-nya sendiri.
- Untuk akses superadmin lintas-tenant, gunakan **service role key** Supabase — **hanya boleh dipanggil dari server (API routes), tidak pernah di client**.

---

## 2. Autentikasi & Otorisasi Superadmin

- [ ] Tambahkan tabel `superadmins` untuk menandai user mana yang punya akses penuh.
- [ ] Buat **middleware** Next.js (`middleware.ts`) yang memproteksi semua route `/superadmin/*`:
  - Cek session Supabase valid
  - Cek user_id ada di tabel `superadmins`
- [ ] Pertimbangkan **2FA** khusus akun superadmin (akses ke seluruh data tenant = risiko tinggi).
- [ ] Tambahkan env var baru: `SUPABASE_SERVICE_ROLE_KEY` (cek apakah sudah ada di `.env.example`).

---

## 3. Halaman & Fitur Dashboard

### 3.1 Overview / Analytics
- Total tenant, tenant aktif, tenant trial, tenant suspended
- MRR (Monthly Recurring Revenue) & tren bulanan
- Tenant baru bulan ini, churn rate
- Grafik pakai `recharts` (sudah ada di dependencies)

### 3.2 List Tenant
- Table dengan search & filter (status, plan, tanggal daftar)
- Gunakan komponen `DataTable` dari shadcn/ui
- Aksi cepat: suspend, aktifkan, lihat detail

### 3.3 Detail Tenant
- Profil tenant lengkap
- Riwayat langganan & pembayaran
- Statistik penggunaan (jumlah nota di-scan, storage terpakai, jumlah user)
- Log aktivitas tenant tersebut

### 3.4 Manajemen Langganan
- Upgrade / downgrade plan
- Extend masa aktif manual
- Suspend / cancel langganan
- Riwayat perubahan plan

### 3.5 Export & Laporan
- Export data tenant/billing ke Excel (`xlsx` — sudah ada)
- Export invoice/laporan ke PDF (`jspdf` — sudah ada)

### 3.6 Notifikasi & Alert
- Alert tenant yang akan/sudah expired
- Alert gagal bayar
- Bisa manfaatkan `web-push` yang sudah ada di dependencies untuk notifikasi real-time ke superadmin

---

## 4. Struktur Folder yang Disarankan (App Router)

```
src/
  app/
    superadmin/
      layout.tsx          # proteksi akses + shell dashboard
      page.tsx             # overview/analytics
      tenants/
        page.tsx            # list tenant
        [tenantId]/
          page.tsx           # detail tenant
      plans/
        page.tsx            # kelola master plan
      billing/
        page.tsx            # invoice & pembayaran
    api/
      superadmin/
        tenants/route.ts     # CRUD tenant (pakai service role key)
        subscriptions/route.ts
        analytics/route.ts
  lib/
    supabase/
      admin-client.ts        # client khusus service role, server-only
  middleware.ts               # proteksi route /superadmin/*
```

---

## 5. Hal Teknis Tambahan

- [ ] **Payment gateway**: belum ada di dependencies. Jika langganan berbayar otomatis, tambahkan Midtrans/Xendit (umum untuk pasar Indonesia) untuk recurring billing & webhook status pembayaran.
- [ ] **Background job** untuk cek langganan yang mau expired & kirim reminder (bisa pakai Supabase Edge Functions + cron, atau Next.js API route + external cron seperti Vercel Cron).
- [ ] **Rate limiting** pada API superadmin.
- [ ] **Backup & disaster recovery** — pastikan backup otomatis Supabase aktif.
- [ ] Putuskan status folder `prisma/` — kalau tidak dipakai, sebaiknya dihapus atau didokumentasikan alasannya supaya tidak membingungkan, karena akses DB saat ini lewat Supabase client / `pg` langsung.

---

## 6. Urutan Pengerjaan yang Disarankan

1. Desain & buat migration tabel (`tenants`, `plans`, `subscriptions`, `tenant_users`, `superadmins`, `audit_logs`)
2. Setup RLS policy + service role client server-side
3. Middleware proteksi route superadmin
4. Halaman List Tenant + Detail Tenant (fitur inti dulu)
5. Halaman Overview/Analytics
6. Manajemen langganan (upgrade/downgrade/suspend)
7. Export & notifikasi
8. Integrasi payment gateway (jika diperlukan)

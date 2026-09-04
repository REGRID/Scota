# Detail Pengembangan Dashboard Superadmin — Scota

> Fokus dokumen ini: **pengembangan dashboard**-nya sendiri — halaman, komponen, data yang
> ditampilkan, layout, dan alur kerja UI. Untuk skema database & arsitektur backend, lihat
> `superadmin-dashboard-plan.md`.

Stack UI yang dipakai: **Next.js App Router + shadcn/ui + Tailwind v4 + recharts + lucide-react**.

---

## 1. Layout Utama Dashboard

**File**: `src/app/superadmin/layout.tsx`

Struktur layout standar admin panel:

```
┌─────────────────────────────────────────────┐
│  Sidebar (kiri)   │   Topbar (search, profil) │
│  - Overview       ├───────────────────────────┤
│  - Tenant         │                           │
│  - Plans          │       Konten Halaman       │
│  - Billing        │                           │
│  - Audit Log       │                           │
│  - Settings       │                           │
└─────────────────────────────────────────────┘
```

Komponen yang perlu dibuat:
- `<SuperadminSidebar />` — navigasi, pakai `lucide-react` untuk ikon, highlight menu aktif berdasarkan pathname
- `<SuperadminTopbar />` — nama superadmin yang login, tombol logout, mungkin quick-search tenant
- `<SuperadminShell />` — wrapper responsive (sidebar collapse di mobile, pakai shadcn `Sheet` untuk mobile drawer)

Layout ini juga tempat cek otorisasi (redirect ke halaman lain kalau bukan superadmin) — dilakukan di `layout.tsx` sebagai server component, plus dobel-cek di `middleware.ts`.

---

## 2. Halaman: Overview / Analytics (`/superadmin`)

Tujuan: superadmin langsung dapat gambaran kesehatan bisnis begitu masuk.

### Komponen Kartu Statistik (`<StatCard />`)
Grid 4 kartu di baris atas:
| Kartu | Isi |
|---|---|
| Total Tenant | jumlah total + badge growth (+X% bulan ini) |
| Tenant Aktif | jumlah tenant status `active` |
| MRR | pendapatan berulang bulanan (format Rupiah) |
| Tenant Trial | jumlah yang masih trial + akan berakhir dalam 7 hari |

### Grafik (pakai `recharts`)
- **Line chart**: pertumbuhan tenant per bulan (6-12 bulan terakhir)
- **Bar chart**: distribusi tenant per plan (Basic/Pro/Enterprise dsb)
- **Area chart** (opsional): tren MRR per bulan

### Tabel "Perlu Perhatian"
- Tenant yang akan expired dalam 7 hari ke depan
- Tenant yang gagal bayar
- Kolom: nama tenant, plan, tanggal expired/gagal bayar, tombol aksi cepat (extend/hubungi)

### Loading & Empty State
- Skeleton loading untuk kartu & grafik saat fetch data (shadcn `Skeleton`)
- Empty state kalau belum ada tenant sama sekali ("Belum ada tenant terdaftar")

---

## 3. Halaman: List Tenant (`/superadmin/tenants`)

### Komponen Utama: `<TenantsDataTable />`
Pakai pola shadcn `DataTable` (berbasis `@tanstack/react-table`).

**Kolom tabel:**
| Kolom | Keterangan |
|---|---|
| Nama Tenant | + logo/avatar inisial |
| Status | Badge warna: hijau (active), abu (trial), merah (suspended), hitam (cancelled) |
| Plan | Nama paket |
| Tanggal Daftar | format tanggal lokal |
| Berakhir Pada | tanggal expired langganan |
| Penggunaan | mis. jumlah nota discan bulan ini / limit |
| Aksi | dropdown menu (Lihat Detail, Suspend, Extend, Hapus) |

**Fitur di atas tabel:**
- Search bar (nama tenant/email)
- Filter dropdown: Status, Plan
- Sort per kolom
- Pagination (server-side, jangan load semua tenant sekaligus)
- Tombol "Tambah Tenant Manual" (untuk kasus tenant didaftarkan langsung oleh superadmin)

**Interaksi:**
- Klik baris → ke halaman detail tenant
- Aksi "Suspend"/"Extend" muncul dialog konfirmasi (shadcn `AlertDialog`) sebelum eksekusi
- Setelah aksi berhasil → toast notifikasi (`sonner`, sudah ada di dependencies)

---

## 4. Halaman: Detail Tenant (`/superadmin/tenants/[tenantId]`)

Gunakan layout tab (shadcn `Tabs`):

### Tab "Ringkasan"
- Info tenant: nama, slug, email kontak, tanggal daftar, status
- Kartu ringkas: plan aktif, tanggal berakhir, total user di tenant tsb
- Tombol aksi cepat: Suspend/Aktifkan, Ubah Plan, Extend Langganan

### Tab "Langganan & Pembayaran"
- Riwayat langganan (tabel: plan, periode, status bayar, tanggal)
- Riwayat invoice dengan tombol export PDF per invoice (pakai `jspdf` yang sudah ada)

### Tab "Penggunaan"
- Grafik penggunaan fitur (jumlah nota di-OCR per bulan, storage terpakai)
- Progress bar terhadap limit plan (mis. "450/500 nota bulan ini")

### Tab "User dalam Tenant"
- List user yang tergabung di tenant ini + role masing-masing
- Aksi: nonaktifkan user tertentu (jika ada penyalahgunaan)

### Tab "Log Aktivitas"
- Log dari tabel `audit_logs` yang terkait tenant ini — siapa (superadmin) melakukan apa dan kapan

---

## 5. Halaman: Kelola Plan (`/superadmin/plans`)

- Tabel daftar plan: nama, harga, limit fitur, jumlah tenant yang pakai
- Form tambah/edit plan (shadcn `Dialog` + `Form` + `react-hook-form` kalau mau ditambahkan)
- Validasi: tidak bisa hapus plan yang masih dipakai tenant aktif — tampilkan warning

---

## 6. Halaman: Billing / Pembayaran (`/superadmin/billing`)

- Tabel semua transaksi lintas tenant: tenant, jumlah, status, metode, tanggal
- Filter berdasarkan status (lunas/pending/gagal) dan rentang tanggal
- Export ke Excel (`xlsx`, sudah ada di dependencies) untuk laporan keuangan bulanan
- Ringkasan kecil di atas: total pendapatan bulan ini, jumlah transaksi gagal

---

## 7. Halaman: Audit Log (`/superadmin/audit-log`)

- Tabel global semua aksi superadmin (bukan hanya per tenant)
- Kolom: waktu, superadmin, aksi, target tenant, detail
- Filter per superadmin dan per jenis aksi — penting untuk akuntabilitas kalau ada lebih dari satu superadmin

---

## 8. Komponen Reusable yang Perlu Dibuat Lebih Dulu

Karena banyak halaman di atas saling pakai pola yang sama, buat dulu komponen dasar ini supaya konsisten:

1. `<StatCard title value trend icon />` — kartu statistik
2. `<StatusBadge status />` — badge warna konsisten untuk status tenant/pembayaran
3. `<DataTable columns data />` — wrapper generik di atas shadcn table + pagination + search
4. `<ConfirmDialog />` — dialog konfirmasi generik untuk aksi destruktif (suspend, hapus, dll)
5. `<EmptyState title description />` — tampilan seragam saat data kosong
6. `<ChartCard title>{children}</ChartCard>` — wrapper kartu untuk semua grafik recharts biar konsisten style-nya

---

## 9. Pengambilan Data (Data Fetching Pattern)

Karena pakai Next.js App Router + PostgreSQL:

- **Server Components** untuk halaman yang cukup fetch data sekali saat render (Overview, List Tenant awal)
  - Fetch langsung di `page.tsx` atau backend service layer via PostgreSQL Pool (`queryPg`)
- **API Routes** (`/app/api/superadmin/...`) untuk aksi yang butuh interaksi client (suspend, ubah plan, search/filter dinamis, pagination)
- Gunakan **React Server Actions** sebagai alternatif API routes untuk form-form aksi sederhana (mis. suspend tenant) — lebih ringkas daripada bikin route terpisah

Contoh alur untuk "Suspend Tenant":
```
Klik tombol Suspend → buka <ConfirmDialog>
  → onConfirm → panggil server action `suspendTenant(tenantId)`
  → server action update tabel `tenants` + insert `audit_logs`
  → revalidatePath('/superadmin/tenants')
  → toast sukses
```

---

## 10. Responsive & Mobile

- Sidebar jadi drawer (shadcn `Sheet`) di layar < 768px
- Tabel di mobile: pertimbangkan tampilan card-list sebagai pengganti tabel penuh, atau scroll horizontal
- Grafik: pastikan `ResponsiveContainer` dari recharts dipakai supaya menyesuaikan lebar layar

---

## 11. Urutan Pengerjaan Dashboard (Prioritas)

1. **Layout & proteksi akses** — sidebar, topbar, middleware
2. **Komponen reusable dasar** (bagian 8) — supaya halaman berikutnya lebih cepat dibangun
3. **List Tenant** — fitur paling sering dipakai sehari-hari
4. **Detail Tenant** — tab Ringkasan dulu, baru tab lainnya menyusul
5. **Overview/Analytics** — setelah data tenant & langganan sudah bisa di-CRUD
6. **Kelola Plan**
7. **Billing**
8. **Audit Log** — terakhir, karena tergantung aksi-aksi di atas sudah menghasilkan log

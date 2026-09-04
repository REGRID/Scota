# Tambahkan Tenant Isolation di Skema

## Masalah Saat Ini

Ini masalah arsitektur, bukan sekadar kolom yang kurang. Buktinya ada di dua tempat yang saling bertentangan:

**1. Konsep "tenant" di `superadmin.ts` menganggap setiap *username* adalah tenant terpisah:**

```ts
export interface TenantSummary {
  username: string
  businessName?: string
  tier: SubscriptionTier
  validUntil: string
  ...
}
```

Superadmin dashboard menampilkan `rama`, `refo`, `karyawan` seolah-olah tiga bisnis yang berbeda, masing-masing dengan tier langganan sendiri.

**2. Tapi tabel data yang sesungguhnya sama sekali tidak punya konsep pemilik/tenant:**

```sql
-- supabase/schema.sql
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "merchantName" TEXT NOT NULL DEFAULT 'Nota / Toko',
    ...
    -- TIDAK ADA kolom tenantId / ownerId / businessId
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier TEXT NOT NULL DEFAULT 'trial',
    ...
    -- Cuma SATU baris untuk SELURUH deployment, bukan satu baris per tenant
);
```

Akibatnya, semua akun (`rama`, `refo`, `karyawan`) sebenarnya:
- Melihat & mengedit **kumpulan struk yang persis sama** — tidak ada pemisahan data sama sekali.
- Berbagi **satu baris `subscriptions` yang sama** — jadi kalau superadmin "upgrade tier tenant A ke Enterprise", yang berubah sebenarnya cuma satu baris global yang dipakai bersama oleh A, B, C, dst.
- `custom_categories`, `notifications`, `pending_approvals` juga tidak terikat ke bisnis mana pun secara eksplisit.

Kalau ini di-deploy sebagai SaaS untuk banyak studio foto/bisnis berbeda seperti yang dirancang di dashboard superadmin, **setiap bisnis akan melihat data struk, kategori, dan langganan bisnis lain**. Ini bukan bug kecil — ini kebocoran data lintas pelanggan.

## Solusi

Perbaikan ini butuh perubahan skema + perubahan di setiap query yang membaca/menulis data. Prinsipnya: perkenalkan entitas **`tenants`** (mewakili satu bisnis/studio), jadikan `admin_accounts` sebagai staf yang menempel ke satu tenant, dan tambahkan `tenantId` ke semua tabel data operasional.

### 1. Model baru

```
tenants (1) ──< admin_accounts (banyak staf per tenant: OWNER/ADMIN/KARYAWAN)
tenants (1) ──< subscriptions   (1 baris per tenant, bukan lagi 1 baris global)
tenants (1) ──< receipts        (semua data struk milik 1 tenant)
tenants (1) ──< custom_categories
tenants (1) ──< notifications
receipts (1) ──< receipt_items  (tetap ikut lewat receiptId → sudah otomatis ter-scope lewat receipts)
```

Tabel yang **sengaja tidak** diberi `tenantId` (dan alasannya):
- `merchant_dictionaries`, `product_dictionaries` — ini kamus hasil self-learning OCR (nama toko/produk yang sudah diverifikasi). Kalau dibuat per-tenant, setiap bisnis baru harus "melatih ulang" dari nol. Rekomendasi: **tetap global**, tapi ini keputusan produk yang perlu dikonfirmasi ke tim — kalau nanti ada tenant yang keberatan data OCR-nya "membantu" tenant lain, baru perlu diberi `tenantId`.
- `scan_limits` — dikunci per `ipAddress` untuk mencegah abuse dari IP yang sama, ini tujuannya beda dari isolasi data tenant, biarkan seperti sekarang.

### 2. Migrasi skema SQL

```sql
-- 1. Tabel tenants baru
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessName" TEXT NOT NULL DEFAULT 'Nota Photo Studio',
    tagline TEXT DEFAULT 'Creative Photography & Digital Imaging',
    address TEXT DEFAULT 'Jl. Studio Kreatif No. 1, Jakarta',
    phone TEXT DEFAULT '0812-3456-7890',
    "logoUrl" TEXT,
    "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan Studio Foto kami.',
    "taxNumber" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. admin_accounts jadi staf di bawah tenant
ALTER TABLE public.admin_accounts
    ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES public.tenants(id);

-- 3. subscriptions dipindah dari "1 baris global" jadi "1 baris per tenant"
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS "tenantId" UUID UNIQUE REFERENCES public.tenants(id);

-- 4. Semua tabel data operasional
ALTER TABLE public.receipts
    ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES public.tenants(id);

ALTER TABLE public.custom_categories
    ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES public.tenants(id);

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES public.tenants(id);

ALTER TABLE public.pending_approvals
    ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES public.tenants(id);
```

### 3. Migrasi data yang sudah ada (backfill)

Karena deployment saat ini sudah berjalan sebagai satu bisnis tunggal (Studio Nota Photo dengan staf `rama`, `refo`, `karyawan`), langkah amannya: buat **satu tenant** untuk menampung semua data lama, baru terapkan `NOT NULL` setelah backfill selesai.

```sql
-- Buat tenant untuk data existing, salin profil dari baris subscriptions lama
INSERT INTO public.tenants (id, "businessName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber")
SELECT gen_random_uuid(), "studioName", tagline, address, phone, "logoUrl", "invoiceFooter", "taxNumber"
FROM public.subscriptions
LIMIT 1
RETURNING id \gset

-- Tempelkan tenantId itu ke semua baris lama
UPDATE public.admin_accounts SET "tenantId" = :'id' WHERE "tenantId" IS NULL;
UPDATE public.subscriptions SET "tenantId" = :'id' WHERE "tenantId" IS NULL;
UPDATE public.receipts SET "tenantId" = :'id' WHERE "tenantId" IS NULL;
UPDATE public.custom_categories SET "tenantId" = :'id' WHERE "tenantId" IS NULL;
UPDATE public.notifications SET "tenantId" = :'id' WHERE "tenantId" IS NULL;
UPDATE public.pending_approvals SET "tenantId" = :'id' WHERE "tenantId" IS NULL;

-- Baru setelah dipastikan semua baris terisi:
ALTER TABLE public.receipts ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE public.admin_accounts ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN "tenantId" SET NOT NULL;
```

> Catatan: sintaks `\gset` di atas untuk `psql` CLI. Kalau dijalankan lewat Supabase SQL Editor (browser), pecah jadi 2 langkah manual: jalankan `INSERT ... RETURNING id`, salin UUID yang muncul, lalu tempel manual ke setiap `UPDATE`.

### 4. Index untuk performa

```sql
CREATE INDEX IF NOT EXISTS receipts_tenantId_idx ON public.receipts ("tenantId");
CREATE INDEX IF NOT EXISTS admin_accounts_tenantId_idx ON public.admin_accounts ("tenantId");
CREATE INDEX IF NOT EXISTS custom_categories_tenantId_idx ON public.custom_categories ("tenantId");
CREATE INDEX IF NOT EXISTS notifications_tenantId_idx ON public.notifications ("tenantId");
CREATE INDEX IF NOT EXISTS pending_approvals_tenantId_idx ON public.pending_approvals ("tenantId");
```

### 5. Update `prisma/schema.prisma` supaya sinkron

```prisma
model Tenant {
  id             String   @id @default(uuid())
  businessName   String   @default("Nota Photo Studio")
  tagline        String?
  address        String?
  phone          String?
  logoUrl        String?
  invoiceFooter  String?
  taxNumber      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  adminAccounts  AdminAccount[]
  subscription   Subscription?
  receipts       Receipt[]

  @@map("tenants")
}

model AdminAccount {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  username  String   @unique
  password  String
  role      String   @default("ADMIN")   // OWNER | ADMIN | KARYAWAN
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("admin_accounts")
}
```

(Terapkan pola relasi `tenantId` yang sama untuk `Subscription`, `Receipt`, `CustomCategory`, `Notification`, `PendingApproval`.)

### 6. Terapkan tenant isolation di layer aplikasi

Ini bagian yang sama pentingnya dengan skema — kolom `tenantId` percuma kalau query-nya tidak memfilter berdasarkan itu.

**a. Session harus membawa `tenantId`**, bukan cuma `username`/`role` (lanjutan dari perbaikan "Ganti auth ke session token yang benar"):

```ts
// src/lib/session.ts
export interface SessionPayload {
  username: string
  role: "OWNER" | "ADMIN" | "KARYAWAN" | "SUPERADMIN"
  tenantId: string   // <- tambahan baru
  staffName?: string
}
```

**b. Setiap query yang membaca/menulis `receipts` wajib menyertakan `tenantId` dari session, bukan dari parameter yang dikirim client:**

```ts
// src/app/api/receipts/route.ts — SEBELUM
const { rows } = await queryPg(`SELECT * FROM receipts ORDER BY "createdAt" DESC ${limitClause}`)

// SESUDAH
const session = await getSession(req)
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

const { rows } = await queryPg(
  `SELECT * FROM receipts WHERE "tenantId" = $1 ORDER BY "createdAt" DESC ${limitClause}`,
  [session.tenantId]
)
```

Pola yang sama harus diterapkan di:
- `src/app/api/receipts/route.ts` (GET, POST) & `receipts/[id]/route.ts` (GET, PUT, DELETE)
- `src/app/api/approvals/route.ts`, `approvals/[id]/approve/route.ts`, `approvals/[id]/reject/route.ts`
- `src/app/api/notifications/route.ts`
- `src/lib/categories.ts` (custom categories)
- `src/lib/subscription.ts` — `getSubscriptionStatus`/`incrementScanUsage`/dll harus query `subscriptions WHERE "tenantId" = $1`, bukan `SELECT * FROM subscriptions LIMIT 1` seperti sekarang

**c. Saat membuat data baru, `tenantId` selalu diisi dari session, tidak pernah dari body request:**

```ts
// POST /api/receipts
const newReceipt = await queryPg(
  `INSERT INTO receipts (..., "tenantId") VALUES (..., $N) RETURNING *`,
  [..., session.tenantId]  // <- dari session, BUKAN dari req.body.tenantId
)
```

Ini penting — kalau `tenantId` diterima dari body, tenant A bisa saja mengirim `tenantId` milik tenant B untuk menyisipkan/membaca data lintas tenant (mirip celah `selectedTier` yang sudah ditemukan di endpoint register).

### 7. Row Level Security (RLS) sebagai lapisan pertahanan kedua

Filter di kode aplikasi (langkah 6) itu wajib, tapi jangan jadi satu-satunya lapisan. Karena `NEXT_PUBLIC_SUPABASE_ANON_KEY` dipakai di beberapa tempat, aktifkan RLS supaya kebocoran tetap tercegah walau ada bug di query aplikasi:

```sql
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_receipts" ON public.receipts
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
```

Lalu di `pgDb.ts`, set context tenant di setiap koneksi sebelum query dijalankan:

```ts
export async function queryPgScoped<T = any>(tenantId: string, text: string, params?: any[]) {
  const p = getPgPool()
  const client = await p.connect()
  try {
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
```

Terapkan pola `USING` yang sama untuk `custom_categories`, `notifications`, `pending_approvals`, `subscriptions`. (Lihat juga script `apply-supabase-rls-policies.js` yang sudah ada di repo — kemungkinan perlu ditulis ulang karena belum menyertakan konsep tenant sama sekali.)

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `supabase/schema.sql` | Tabel `tenants` baru, kolom `tenantId` di 6 tabel, index, RLS policy |
| `prisma/schema.prisma` | Model `Tenant` baru + relasi `tenantId` di model terkait |
| `src/lib/session.ts` | Tambah `tenantId` ke `SessionPayload` |
| `src/lib/adminAccounts.ts` | Sertakan `tenantId` saat baca akun & saat register staf baru |
| `src/lib/subscription.ts` | Semua fungsi query `subscriptions` pakai `WHERE "tenantId" = $1` |
| `src/lib/superadmin.ts` | `TenantSummary` diambil dari tabel `tenants` sungguhan, bukan dari daftar username |
| `src/app/api/receipts/**`, `approvals/**`, `notifications/route.ts` | Semua query difilter `tenantId` dari session |
| `src/lib/pgDb.ts` | Tambah `queryPgScoped` untuk set context RLS per request |
| `scripts/apply-supabase-rls-policies.js` | Update policy jadi tenant-aware |

## Catatan Penting

- Ini perubahan besar — sebaiknya dikerjakan **setelah** perbaikan session token (JWT) selesai, karena `tenantId` perlu ikut ditandatangani di dalam token, bukan diterima dari client.
- Kalau untuk saat ini bisnisnya memang cuma satu studio foto (bukan SaaS multi-tenant), pertimbangkan: apakah dashboard "superadmin/tenants" memang perlu tetap ada? Kalau tidak, bisa disederhanakan jadi single-tenant murni dan fitur superadmin dihapus — lebih sedikit permukaan serangan. Tapi kalau rencana go-live memang untuk menjual ke banyak studio foto berbeda (sesuai indikasi dari `TIER_CONFIG`, halaman `/pricing`, dan dashboard superadmin), perubahan ini **wajib** sebelum onboarding tenant kedua.

## Checklist Verifikasi

- [ ] Buat 2 tenant uji coba (`tenant-a`, `tenant-b`), masing-masing dengan 1 staf & beberapa struk
- [ ] Login sebagai staf tenant A → API `/api/receipts` hanya mengembalikan struk tenant A
- [ ] Login sebagai staf tenant B → tidak melihat satu pun struk tenant A
- [ ] Coba kirim `tenantId` tenant lain lewat body `POST /api/receipts` → harus tetap tersimpan dengan `tenantId` milik session, bukan yang dikirim di body
- [ ] Update tier langganan tenant A lewat superadmin → tier tenant B tidak ikut berubah
- [ ] Coba query langsung ke Postgres dengan `anon key` tanpa context tenant → RLS menolak/mengembalikan 0 baris
- [ ] Cek ulang endpoint `/api/superadmin/tenants` menampilkan data dari tabel `tenants` yang benar, bukan lagi daftar `admin_accounts` yang disamarkan jadi "tenant"

# Billing & Audit Log Masih Tersimpan di File JSON Lokal

## Masalah Saat Ini

Dua fitur yang sudah diproteksi otentikasinya dengan benar (`requireSuperadmin` sudah terpasang) tetap punya masalah mendasar di lapisan penyimpanan datanya: keduanya nulis ke file JSON di disk lokal, bukan ke database.

**Audit log** — `src/lib/superadmin.ts`:
```ts
const AUDIT_LOG_FILE = path.join(process.cwd(), "superadmin_audit_logs.json")
...
export async function recordAuditLog(payload: {...}): Promise<void> {
  ...
  let logs: AuditLogEntry[] = []
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, "utf-8"))
  }
  logs.unshift(entry)
  if (logs.length > 500) logs = logs.slice(0, 500)
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2))
}
```

**Billing** — `src/app/api/superadmin/billing/route.ts`:
```ts
const BILLING_FILE = path.join(process.cwd(), "superadmin_billing.json")
...
list.unshift(newTrx)
fs.writeFileSync(BILLING_FILE, JSON.stringify(list, null, 2))
```

Masalahnya ada 3 lapis:

1. **Hilang setiap redeploy/restart.** Di platform serverless seperti Vercel, filesystem bersifat *ephemeral* — setiap function invocation bisa jalan di instance/container yang berbeda, dan `process.cwd()` di production **bukan** disk yang persisten. Praktiknya: `fs.writeFileSync` di satu request bisa saja tidak terbaca lagi oleh request berikutnya kalau kena instance lain, dan hampir pasti hilang total setelah redeploy.
2. **Race condition antar request bersamaan.** Pola baca-lalu-tulis (`readFileSync` → modifikasi array di memory → `writeFileSync`) tidak atomik. Kalau 2 superadmin membuat transaksi billing di waktu yang hampir bersamaan, salah satu bisa menimpa perubahan yang lain — transaksi yang tercatat lebih dulu bisa hilang tanpa error apa pun.
3. **Tidak bisa di-query, tidak bisa di-backup, tidak terhubung ke tenant.** File JSON datar tidak punya index, tidak muncul di backup database rutin (kalau tim sudah setup automated backup untuk Postgres, file ini tidak ikut ter-backup), dan `tenantUsername`/`targetTenant` di dalamnya cuma string bebas — tidak ada foreign key ke tabel `tenants`, jadi rawan salah ketik atau tidak konsisten dengan data tenant yang sebenarnya.

Dampak konkret: kalau ada sengketa dengan pelanggan ("saya sudah bayar tier Enterprise bulan lalu, kenapa turun ke trial?"), buktinya bisa saja sudah tidak ada sama sekali karena server sempat di-redeploy — padahal ini justru catatan yang paling penting untuk dipertahankan di sistem billing.

## Solusi

### 1. Buat tabel database untuk keduanya

```sql
-- database/schema.sql

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superadmin TEXT NOT NULL,
    action TEXT NOT NULL,
    "targetTenantId" UUID REFERENCES public.tenants(id),
    "targetTenantLabel" TEXT,          -- fallback tampilan kalau tenant sudah dihapus
    detail TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON public.audit_logs ("targetTenantId");
CREATE INDEX IF NOT EXISTS audit_logs_createdAt_idx ON public.audit_logs ("createdAt" DESC);

CREATE TABLE IF NOT EXISTS public.billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceNumber" TEXT NOT NULL UNIQUE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id),
    tier TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'lunas',      -- 'lunas' | 'pending' | 'gagal'
    "paymentMethod" TEXT DEFAULT 'Transfer Manual',
    "recordedBySuperadmin" TEXT NOT NULL,       -- username superadmin yang mencatat
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_transactions_tenant_idx ON public.billing_transactions ("tenantId");
```

`invoiceNumber UNIQUE` menggantikan pola lama yang generate nomor invoice pakai `Math.random()` tiga digit — dengan constraint unique di database, tabrakan nomor invoice akan langsung ketahuan sebagai error, bukan diam-diam tersimpan dobel seperti risiko di versi file JSON.

### 2. Ganti `recordAuditLog` & `getAuditLogs` di `src/lib/superadmin.ts`

```ts
import { queryPg } from "@/lib/pgDb"

export async function recordAuditLog(payload: {
  superadmin: string
  action: string
  targetTenantId?: string
  targetTenantLabel: string
  detail: string
  ipAddress?: string
}): Promise<void> {
  try {
    await queryPg(
      `INSERT INTO audit_logs (superadmin, action, "targetTenantId", "targetTenantLabel", detail, "ipAddress")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        payload.superadmin,
        payload.action,
        payload.targetTenantId || null,
        payload.targetTenantLabel,
        payload.detail,
        payload.ipAddress || null,
      ]
    )
  } catch (err) {
    // Audit log gagal tersimpan TIDAK BOLEH menggagalkan aksi utama (mis. update tier tetap jalan),
    // tapi wajib di-log ke console/error tracker supaya ketahuan kalau audit trail bolong.
    console.error("recordAuditLog gagal:", err)
  }
}

export async function getAuditLogs(limit = 500): Promise<AuditLogEntry[]> {
  const res = await queryPg<AuditLogEntry>(
    `SELECT * FROM audit_logs ORDER BY "createdAt" DESC LIMIT $1`,
    [limit]
  )
  return res.rows
}
```

Hapus total `AUDIT_LOG_FILE`, import `fs`/`path` yang sudah tidak dipakai, dan logika slice 500 baris manual (`ORDER BY ... LIMIT` di SQL sudah menggantikannya, dan data lama tidak perlu dibuang — cukup dibatasi saat ditampilkan).

### 3. Ganti `getAllBillingTransactions` di `src/lib/superadmin.ts`

```ts
export async function getAllBillingTransactions(): Promise<BillingTransaction[]> {
  const res = await queryPg<BillingTransaction>(
    `SELECT bt.*, t."businessName" FROM billing_transactions bt
     JOIN tenants t ON t.id = bt."tenantId"
     ORDER BY bt."createdAt" DESC`
  )
  return res.rows
}
```

### 4. Ganti `POST /api/superadmin/billing/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server"
import { getAllBillingTransactions, recordAuditLog } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"
import { queryPg } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const { tenantId, tier, amount, paymentMethod, status } = await req.json()
    if (!tenantId || !amount) {
      return NextResponse.json({ error: "Data transaksi tidak lengkap" }, { status: 400 })
    }

    // Pastikan tenantId benar-benar ada -- foreign key constraint di DB juga akan menolak
    // kalau tidak valid, tapi validasi eksplisit di sini menghasilkan pesan error yang lebih jelas.
    const tenantRes = await queryPg(`SELECT "businessName" FROM tenants WHERE id = $1`, [tenantId])
    if (!tenantRes.rows[0]) {
      return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 })
    }

    const invoiceNumber = `INV/${new Date().getFullYear()}/${tenantId.slice(0, 8).toUpperCase()}/${Date.now().toString(36).toUpperCase()}`

    const trxRes = await queryPg(
      `INSERT INTO billing_transactions
         ("invoiceNumber", "tenantId", tier, amount, status, "paymentMethod", "recordedBySuperadmin")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [invoiceNumber, tenantId, tier || "pro", Number(amount), status || "lunas", paymentMethod || "Transfer Manual", auth.username]
    )

    await recordAuditLog({
      superadmin: auth.username,
      action: "CREATE_BILLING_INVOICE",
      targetTenantId: tenantId,
      targetTenantLabel: tenantRes.rows[0].businessName,
      detail: `Pencatatan invoice ${invoiceNumber} senilai Rp ${Number(amount).toLocaleString("id-ID")}`,
    })

    return NextResponse.json({ success: true, transaction: trxRes.rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membuat transaksi baru" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if (!auth.ok) return auth.response

  const transactions = await getAllBillingTransactions()
  return NextResponse.json({ success: true, transactions })
}
```

Perhatikan perubahan kecil tapi penting: request sekarang mengirim `tenantId` (UUID sungguhan yang divalidasi ke tabel `tenants`), bukan `tenantUsername` bebas seperti sebelumnya — ini menutup celah salah ketik/inkonsistensi yang disebut di poin masalah nomor 3.

### 5. Migrasi data lama (kalau file JSON di production masih ada isinya)

Kalau `superadmin_audit_logs.json`/`superadmin_billing.json` di production kebetulan masih ada isinya (belum sempat hilang karena redeploy), pindahkan sekali sebelum menghapus kode lama:

```js
// scripts/migrate-json-logs-to-db.js
const fs = require("fs")
const { Pool } = require("pg")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrateAuditLogs() {
  if (!fs.existsSync("./superadmin_audit_logs.json")) return
  const logs = JSON.parse(fs.readFileSync("./superadmin_audit_logs.json", "utf-8"))
  for (const log of logs) {
    await pool.query(
      `INSERT INTO audit_logs (superadmin, action, "targetTenantLabel", detail, "ipAddress", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [log.superadmin, log.action, log.targetTenant, log.detail, log.ipAddress, new Date()]
    )
  }
  console.log(`${logs.length} audit log berhasil dimigrasikan.`)
}

migrateAuditLogs()
```

(Buat script serupa untuk billing kalau memang ada data lama yang perlu diselamatkan — kalau tidak ada isinya sama sekali, langkah ini bisa dilewati.)

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `database/schema.sql` | Tabel baru `audit_logs`, `billing_transactions` |
| `src/lib/superadmin.ts` | `recordAuditLog`, `getAuditLogs`, `getAllBillingTransactions` pindah ke query Postgres, hapus `fs`/`AUDIT_LOG_FILE`/`BILLING_FILE` |
| `src/app/api/superadmin/billing/route.ts` | `POST`/`GET` pakai tabel `billing_transactions`, terima `tenantId` bukan `tenantUsername` |
| `scripts/migrate-json-logs-to-db.js` | **Baru** (opsional) — migrasi data lama kalau masih ada |

## Catatan Penting

- Ini bergantung pada tabel `tenants` yang sudah ada (dari perbaikan tenant isolation) — `tenantId` di `billing_transactions` butuh foreign key ke situ.
- Setelah pindah ke database, audit log & billing otomatis ikut ter-backup bersama backup rutin Postgres yang sudah ada — pastikan tim benar-benar sudah punya jadwal backup database (kalau belum, ini jadi alasan tambahan untuk segera disiapkan).
- `recordAuditLog` sengaja dibuat *tidak* melempar error ke pemanggilnya kalau gagal — supaya kegagalan mencatat log tidak sampai membatalkan aksi utama (misalnya update tier tenant tetap berhasil walau audit log-nya gagal tersimpan), tapi kegagalan itu tetap harus masuk ke log server/error tracker supaya tim tahu ada yang bolong.

## Checklist Verifikasi

- [ ] Buat transaksi billing baru → langsung muncul saat `GET /api/superadmin/billing` dipanggil ulang
- [ ] Redeploy aplikasi (atau restart server lokal) → data billing & audit log yang sudah dibuat sebelumnya **tetap ada**
- [ ] Buat 2 transaksi billing hampir bersamaan (mis. 2 tab browser klik submit di waktu yang sama) → keduanya tersimpan, tidak ada yang hilang tertimpa
- [ ] Kirim `tenantId` yang tidak ada di tabel `tenants` → ditolak `404`, bukan tetap tersimpan dengan data tenant yang salah
- [ ] `superadmin_audit_logs.json` dan `superadmin_billing.json` tidak lagi dibuat/ditulis di server setelah perubahan ini
- [ ] Cek tabel `billing_transactions` — kolom `invoiceNumber` benar-benar unik, tidak ada duplikat

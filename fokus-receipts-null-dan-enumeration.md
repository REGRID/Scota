# Perbaikan Fokus: `tenantId IS NULL` di `receipts/route.ts` & User Enumeration

Dokumen ini sengaja dipersempit ke 2 titik yang paling jelas kelihatan dulu. Bagian lain yang punya pola serupa (`categories`, `notifications`, `approvals`) sudah diketahui tapi **belum digarap di sini** — akan ditelusuri terpisah di sesi berikutnya sesuai rencana.

## Bagian 1 — `WHERE (tenantId = $1 OR tenantId IS NULL)` di `src/app/api/receipts/route.ts`

### Lokasi persis (3 titik)

**Lokasi 1 — baris 83, `GET` (ambil daftar struk):**
```ts
const pgRes = await queryPg(
  `SELECT r.*, ... FROM receipts r
   LEFT JOIN receipt_items i ON i."receiptId" = r.id
   WHERE (r."tenantId" = $1 OR r."tenantId" IS NULL)
   GROUP BY r.id
   ORDER BY r."createdAt" DESC
   ${limit ? `LIMIT ${limit}` : ""}`,
  [targetTenantId]
)
```

**Lokasi 2 — baris 464, bulk `DELETE`:**
```ts
await queryPg(
  `DELETE FROM receipts WHERE id = ANY($1::uuid[]) AND ("tenantId" = $2 OR "tenantId" IS NULL)`,
  [ids, userTenantId]
)
```

**Lokasi 3 — baris 559, bulk update status pembayaran:**
```ts
await queryPg(
  `UPDATE receipts 
   SET "paymentStatus" = $1, "updatedAt" = NOW() 
   WHERE id = ANY($2::uuid[]) AND ("tenantId" = $3 OR "tenantId" IS NULL)`,
  [statusToSet, ids, userTenantId]
)
```

### Perbaikan

Cukup hapus bagian `OR ... IS NULL` di ketiga tempat — filter tenant jadi murni exact match:

```ts
// Lokasi 1
WHERE r."tenantId" = $1

// Lokasi 2
DELETE FROM receipts WHERE id = ANY($1::uuid[]) AND "tenantId" = $2

// Lokasi 3
UPDATE receipts 
SET "paymentStatus" = $1, "updatedAt" = NOW() 
WHERE id = ANY($2::uuid[]) AND "tenantId" = $3
```

Parameter (`targetTenantId`, `userTenantId`) tidak perlu diubah — sudah benar diambil dari session, bukan dari body request.

### Kenapa aman dihapus langsung (tanpa migrasi backfill dulu)

Di `database/schema.sql`, kolom `tenantId` tabel `receipts` sudah punya:
```sql
"tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
```

Sudah `NOT NULL` — artinya di tabel `receipts` **secara spesifik**, tidak mungkin ada baris dengan `tenantId` kosong sejak constraint ini diterapkan. Klausa `OR tenantId IS NULL` di sini murni sisa kode defensif yang tidak lagi relevan, aman dihapus langsung tanpa perlu migrasi data apa pun.

> Catatan: ini beda dengan tabel `custom_categories`, `notifications`, `pending_approvals` yang kolom `tenantId`-nya **belum** `NOT NULL` (masih boleh kosong) — makanya perbaikan di tabel-tabel itu perlu langkah backfill dulu sebelum klausanya dihapus. Itu bagian dari penelusuran lanjutan yang disebutkan di atas, bukan cakupan dokumen ini.

## Bagian 2 — User Enumeration di `src/app/api/auth/forgot-password/route.ts`

### Kode saat ini

```ts
const account = await getUserAccountDetails(username)
if (!account) {
  return NextResponse.json(
    { error: `Akun dengan ID "${username}" tidak ditemukan dalam sistem.` },
    { status: 404 }
  )
}

// 1. ACTION: REQUEST OTP VIA WHATSAPP
if (action === "request_otp") {
  const reqIdentifier = `otp_request:${username}`
  const rateCheck = await checkAuthRateLimit(reqIdentifier, "otp_request")
  ...
```

Karena pengecekan `!account` dilakukan **di awal**, sebelum tahu `action`-nya apa, siapa pun cukup kirim `{ "username": "coba1" }` tanpa field lain dan langsung tahu dari status code (`404` vs lanjut ke proses lain) apakah `coba1` terdaftar atau tidak — tanpa perlu OTP, tanpa rate limit yang menghalangi (karena rate limit baru dicek setelah lolos pengecekan ini).

### Perbaikan

Pindahkan pengecekan `!account` ke **dalam** masing-masing blok `action`, dan jangan biarkan responsnya beda dari kasus "OTP salah"/"akun ada tapi gagal":

```ts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || "request_otp"
    const username = (body.username || "").trim().toLowerCase()

    if (!username) {
      return NextResponse.json({ error: "ID Pengguna / Username wajib diisi" }, { status: 400 })
    }

    // Tidak ada lagi pengecekan `!account` yang langsung return 404 di sini.
    const account = await getUserAccountDetails(username)

    if (action === "request_otp") {
      const reqIdentifier = `otp_request:${username}`
      const rateCheck = await checkAuthRateLimit(reqIdentifier, "otp_request")
      if (!rateCheck.allowed) {
        return NextResponse.json({ error: formatLockoutMessage(rateCheck.lockedUntil!) }, { status: 429 })
      }

      if (account) {
        const otp = generateOtpCode()
        await storePasswordResetOtp(username, otp)
        await sendWhatsAppOtpMessage(account.phone, otp)
      }
      // Dicatat sebagai attempt baik akun ada maupun tidak, supaya rate limit tetap konsisten
      // dan tidak bisa dipakai untuk membedakan keberadaan akun lewat sisi timing/limit.
      await recordAuthAttempt(reqIdentifier, "otp_request", true)

      // Respons SAMA PERSIS baik akun ada maupun tidak:
      return NextResponse.json({
        success: true,
        message: "Jika akun dengan ID tersebut terdaftar, kode OTP telah dikirim ke nomor WhatsApp terkait.",
      })
    }

    if (action === "verify_and_reset") {
      const verifyIdentifier = `otp_verify:${username}`
      const rateCheck = await checkAuthRateLimit(verifyIdentifier, "otp_verify")
      if (!rateCheck.allowed) {
        return NextResponse.json({ error: formatLockoutMessage(rateCheck.lockedUntil!) }, { status: 429 })
      }

      // Kalau akun tidak pernah ada, OTP manapun yang dikirim otomatis dianggap tidak valid --
      // tidak perlu pengecekan/pesan terpisah untuk "akun tidak ada".
      const verifyResult = account
        ? await verifyPasswordResetOtp(username, body.otp)
        : { valid: false }

      await recordAuthAttempt(verifyIdentifier, "otp_verify", verifyResult.valid)

      if (!verifyResult.valid) {
        return NextResponse.json({ error: "Kode OTP salah atau kedaluwarsa" }, { status: 400 })
      }

      await updateAdminPassword(username, body.newPassword)
      return NextResponse.json({ success: true, message: "Password berhasil direset" })
    }

    return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Terjadi kesalahan server" }, { status: 500 })
  }
}
```

Poin kunci: tidak ada satu pun cabang kode di atas yang membedakan response berdasarkan `account` ada atau tidak — perbedaan itu murni terjadi di dalam (kirim WA atau tidak, cek OTP sungguhan atau langsung `invalid`), tapi output ke client selalu sama bentuknya.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/api/receipts/route.ts` | Hapus `OR "tenantId" IS NULL` di baris 83, 464, 559 |
| `src/app/api/auth/forgot-password/route.ts` | Pindahkan cek `!account` ke dalam masing-masing action; respons generik yang sama baik akun ada maupun tidak |

## Checklist Verifikasi

- [ ] `GET /api/receipts` dengan token tenant A → hanya menampilkan struk milik tenant A (ulangi cek dengan tenant B untuk memastikan saling terisolasi)
- [ ] Bulk delete/settle struk dari tenant A tidak bisa menyentuh struk tenant B walau ID-nya ditebak/dikirim manual
- [ ] `POST /api/auth/forgot-password` dengan `{"action":"request_otp","username":"ada_akunnya"}` dan `{"action":"request_otp","username":"tidak_ada_akunnya"}` → status code & body response **identik**
- [ ] `POST /api/auth/forgot-password` dengan `action: "verify_and_reset"` untuk username yang tidak pernah terdaftar → tetap dapat `400 "Kode OTP salah atau kedaluwarsa"`, bukan `404`
- [ ] Rate limit `otp_request` tetap bekerja walau username-nya tidak pernah ada (mencegah endpoint ini dipakai untuk enumerasi cepat lewat percobaan berulang)

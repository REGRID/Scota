# Fix: Info Disclosure di `GET /api/payment/status`

## Masalah

`src/app/api/payment/status/route.ts` menerima `order_id` dari query parameter dan langsung mengembalikan detail transaksi (`tier`, `invoiceNumber`, `completedAt`, status) **tanpa mengecek siapa yang bertanya**:

```ts
export async function GET(req: NextRequest) {
  const orderId = (searchParams.get("order_id") || "").trim()
  // ...langsung query & kembalikan detail, tidak ada getSession() di mana pun
```

Endpoint ini dipanggil dari `PakasirCheckoutModal.tsx` untuk polling status pembayaran secara real-time — pemakaian normalnya memang oleh pengguna yang baru saja memulai checkout untuk tenant miliknya sendiri. Tapi karena tidak ada pengecekan kepemilikan, **siapa pun yang tahu atau menebak `order_id`/`invoiceNumber` tenant lain** bisa memanggil endpoint ini langsung dan melihat detail billing mereka — tier yang dipakai, kapan pembayaran selesai, nomor invoice. Bukan celah pencurian uang (logic aktivasinya sendiri sudah aman, selalu verifikasi ke Pakasir dulu), tapi tetap kebocoran data bisnis yang seharusnya privat.

## Solusi

Tambahkan pengecekan sesi + kepastian bahwa transaksi yang diminta memang milik tenant yang sedang login:

```ts
import { getSession } from "@/lib/authHelper"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = (searchParams.get("order_id") || "").trim()

    if (!orderId) {
      return NextResponse.json({ error: "Parameter order_id wajib disertakan." }, { status: 400 })
    }

    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ status: "pending", orderId })
    }

    const trxRes = await queryPg<{...}>(
      `SELECT id, "orderId", "invoiceNumber", "tenantId", tier, "billingCycle",
              amount, status, "paymentMethod", "expiredAt", "completedAt"
       FROM billing_transactions
       WHERE ("orderId" = $1 OR "invoiceNumber" = $1) AND "tenantId" = $2
       LIMIT 1`,
      [orderId, session.tenantId]   // <- tenantId ikut jadi syarat WHERE, bukan dicek belakangan
    )

    const trx = trxRes.rows?.[0]
    if (!trx) {
      // 404 generik -- tidak membedakan "transaksi tidak ada" vs "ada tapi bukan milikmu",
      // supaya tidak membocorkan informasi soal transaksi tenant lain lewat selisih respons.
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 })
    }

    // ...sisanya (cek status lunas, polling fallback ke Pakasir, aktivasi) TIDAK BERUBAH
```

Perubahan kuncinya: `"tenantId" = $2` masuk langsung ke klausa `WHERE` di query database — bukan query dulu lalu dicek belakangan di kode JavaScript. Ini penting supaya kalau ada baris yang cocok `orderId`-nya tapi beda `tenantId`, hasilnya langsung kosong dari database, bukan sempat ke-fetch lalu "dibuang" — lebih sedikit peluang salah, dan query-nya sendiri sudah otomatis benar secara desain.

`superadmin` sengaja **tidak** dikecualikan di sini (beda dengan pola `receipts` yang punya jalur khusus superadmin lihat lintas-tenant) — kalau nanti superadmin butuh lihat status pembayaran tenant manapun untuk keperluan dukungan, sebaiknya lewat endpoint terpisah `/api/superadmin/billing/status` yang memang dilindungi `requireSuperadmin`, bukan menambah pengecualian di endpoint publik yang dipakai checkout biasa.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/api/payment/status/route.ts` | Tambah `getSession()`, filter `tenantId` masuk ke `WHERE` query, `404` generik kalau tidak cocok |

## Catatan Penting

- Ini tidak mengubah logic aktivasi/polling-fallback (baris 58-95 di file) sama sekali — bagian itu sudah aman sejak awal (selalu verifikasi ke Pakasir dulu sebelum aktivasi apa pun).
- Pastikan `PakasirCheckoutModal.tsx` memang selalu dipanggil dalam konteks pengguna yang sudah login (bukan dari halaman publik sebelum sign-up) — kalau ternyata ada skenario checkout untuk pengguna anonim, perbaikan ini akan memblokir polling status-nya juga, dan perlu didesain ulang (misalnya pakai token status terpisah yang di-generate saat transaksi dibuat, bukan `tenantId` dari sesi).

## Checklist Verifikasi

- [x] Login sebagai tenant A, mulai checkout, panggil `/api/payment/status?order_id=<milik-A>` → berhasil, detail tampil normal
- [x] Masih login sebagai tenant A, coba `order_id` milik tenant B (kalau tahu/tebak) → `404`, tidak ada detail bocor
- [x] Panggil endpoint ini **tanpa login sama sekali** → `401`
- [x] Alur checkout normal (bayar → polling → tier aktif) tetap berjalan mulus seperti sebelumnya untuk pengguna yang sah

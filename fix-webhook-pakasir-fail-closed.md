# Fix: Webhook Pakasir Fail-Open — Bisa Dipalsukan untuk Aktivasi Tier Gratis

## Masalah

`src/app/api/webhooks/pakasir/route.ts` punya 3 jalur yang semuanya berakhir "percaya payload mentah dari request" kalau verifikasi resmi ke Pakasir tidak bisa dipastikan berhasil:

```ts
let isStatusVerified = payload.status === "completed"   // nilai awal: TIDAK AMAN, dari body request

if (config.apiKey) {
  try {
    const verifyRes = await getPakasirTransactionDetail(payload.order_id, Number(trx.amount))
    if (verifyRes.success && verifyRes.transaction) {
      isStatusVerified = verifyRes.transaction.status === "completed"
    } else {
      console.warn("...falling back to payload status.")   // TIDAK AMAN
    }
  } catch (verifyErr) {
    console.warn("Could not reach verification API:", verifyErr)   // TIDAK AMAN
  }
}
```

Tiga skenario yang membuat sistem percaya begitu saja ke `payload.status` (data yang **sepenuhnya dikontrol pengirim request**, bukan Pakasir):

1. `PAKASIR_API_KEY` belum diset di environment → verifikasi dilewati total.
2. Verifikasi jalan tapi Pakasir mengembalikan `success: false` / tidak ada `transaction` (order tidak dikenali Pakasir, dsb) → tetap lanjut pakai `payload.status`.
3. Request ke API Pakasir gagal (timeout, network error, Pakasir sedang down) → tetap lanjut pakai `payload.status`.

Selama salah satu dari ini terjadi, siapa pun bisa `POST` payload buatan sendiri (`{"order_id": "<invoice-tebakan>", "status": "completed"}`) dan **langsung mendapat tier berbayar aktif tanpa membayar** — endpoint ini publik (tidak butuh sesi, memang harus begitu karena dipanggil Pakasir dari luar), jadi satu-satunya penjaga adalah verifikasi tadi.

## Solusi — Fail-Closed di Ketiganya

Prinsipnya dibalik total: transaksi **hanya** boleh diaktifkan kalau verifikasi ke Pakasir **benar-benar berhasil dan eksplisit mengonfirmasi** `status: "completed"`. Apa pun yang menghalangi verifikasi itu (key belum diset, network error, respons tidak terduga) harus berakhir **menolak** aktivasi — bukan melanjutkan dengan asumsi aman.

```ts
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as PakasirWebhookPayload | null

    if (!payload || !payload.order_id) {
      return NextResponse.json({ error: "Payload webhook tidak valid." }, { status: 400 })
    }

    console.log(`[Pakasir Webhook] Received notification for Order: ${payload.order_id}, Status: ${payload.status}`)

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database tidak aktif." }, { status: 503 })
    }

    const config = getPakasirConfig()

    // Fail-closed #1: tanpa API key, webhook TIDAK BISA memverifikasi apa pun -- tolak total.
    // Jangan biarkan sistem lanjut dengan asumsi "aman", karena ini justru pintu paling berbahaya:
    // env var yang lupa di-set membuat pembayaran bisa dipalsukan siapa saja.
    if (!config.apiKey) {
      console.error("[Pakasir Webhook] KRITIS: PAKASIR_API_KEY belum diset -- webhook ditolak demi keamanan.")
      return NextResponse.json(
        { error: "Konfigurasi verifikasi pembayaran tidak lengkap di server." },
        { status: 503 }   // 503, bukan 200 -- supaya Pakasir tahu ini gagal & akan retry otomatis
      )
    }

    const trxRes = await queryPg<{
      id: string; orderId: string; invoiceNumber: string; tenantId: string
      tier: string; billingCycle: string; amount: number; status: string; paymentMethod: string
    }>(
      `SELECT id, "orderId", "invoiceNumber", "tenantId", tier, "billingCycle", amount, status, "paymentMethod"
       FROM billing_transactions WHERE "orderId" = $1 OR "invoiceNumber" = $1 LIMIT 1`,
      [payload.order_id]
    )

    const trx = trxRes.rows?.[0]
    if (!trx) {
      console.warn(`[Pakasir Webhook] Order ID not found: ${payload.order_id}`)
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 })
    }

    if (trx.status === "lunas" || trx.status === "completed") {
      return NextResponse.json({ success: true, message: "Transaksi telah diselesaikan sebelumnya." })
    }

    // Fail-closed #2 & #3: verifikasi WAJIB berhasil secara eksplisit.
    // Tidak ada lagi nilai awal yang percaya payload.status.
    let isStatusVerified = false

    try {
      const verifyRes = await getPakasirTransactionDetail(payload.order_id, Number(trx.amount))

      if (!verifyRes.success || !verifyRes.transaction) {
        console.error(
          `[Pakasir Webhook] Verifikasi GAGAL untuk order ${payload.order_id}: ${verifyRes.error || "respons tidak valid"}. Webhook ditolak, TIDAK mengaktifkan apa pun.`
        )
        return NextResponse.json(
          { error: "Verifikasi transaksi ke Pakasir gagal. Silakan coba lagi." },
          { status: 502 }   // 502 -- server upstream (Pakasir) tidak memberi konfirmasi valid
        )
      }

      isStatusVerified = verifyRes.transaction.status === "completed"
    } catch (verifyErr) {
      // Network error / timeout ke Pakasir -- JANGAN lanjut, JANGAN aktifkan apa pun.
      console.error(`[Pakasir Webhook] Tidak bisa menghubungi API verifikasi Pakasir:`, verifyErr)
      return NextResponse.json(
        { error: "Tidak dapat memverifikasi transaksi saat ini. Silakan coba lagi." },
        { status: 502 }
      )
    }

    if (!isStatusVerified) {
      console.log(`[Pakasir Webhook] Status transaksi terverifikasi BUKAN 'completed' untuk order ${payload.order_id}.`)
      return NextResponse.json({ success: true, message: "Status transaksi belum lunas." })
    }

    // ...sisanya (aktivasi subscription, update admin_accounts/tenants, kirim notifikasi) TIDAK BERUBAH,
    // karena titik ini cuma tercapai kalau verifikasi ke Pakasir benar-benar mengonfirmasi "completed".
```

Poin kunci perubahan:
- **Tidak ada lagi nilai awal `payload.status === "completed"`** — `isStatusVerified` mulai dari `false`, cuma jadi `true` kalau Pakasir sendiri yang bilang begitu.
- **Semua jalur kegagalan verifikasi mengembalikan status HTTP non-2xx (`502`/`503`)** — ini penting karena webhook payment gateway pada umumnya (termasuk Pakasir) akan **retry otomatis** kalau responsnya bukan `2xx`. Jadi kalau kegagalannya cuma sementara (network blip, Pakasir lagi lambat), pembayaran yang sah tetap akan diproses di percobaan retry berikutnya — bukan hilang begitu saja.
- **`config.apiKey` kosong sekarang jadi kondisi fatal yang di-log sebagai KRITIS**, bukan cuma dilewati diam-diam.

## Tambahan — Cegah `PAKASIR_API_KEY` Kosong dari Awal

Ini pola yang sama seperti kasus `SESSION_SECRET` sebelumnya — tambahkan ke validasi startup di `instrumentation.ts` (kalau sudah ada dari perbaikan sebelumnya, tinggal tambah 1 key ke daftar; kalau belum ada, buat baru):

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const required = ["SESSION_SECRET", "DATABASE_URL", "PAKASIR_API_KEY", "PAKASIR_PROJECT_SLUG"]
    const missing = required.filter((key) => !process.env[key] || process.env[key]!.trim().length === 0)

    if (missing.length > 0) {
      throw new Error(`Environment variable wajib belum diset: ${missing.join(", ")}. Aplikasi tidak akan dijalankan tanpa ini.`)
    }
  }
}
```

Dengan ini, kalau `PAKASIR_API_KEY` lupa diset, **aplikasi gagal start sama sekali** di production — jauh lebih baik daripada baru ketahuan setelah ada yang mengeksploitasi webhook-nya.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/app/api/webhooks/pakasir/route.ts` | `isStatusVerified` mulai dari `false`; semua jalur gagal verifikasi return non-2xx, tidak pernah lanjut aktivasi |
| `instrumentation.ts` | Tambah `PAKASIR_API_KEY`, `PAKASIR_PROJECT_SLUG` ke validasi env wajib saat startup |

## Catatan Penting

- Idempotency check (`trx.status === "lunas"` → return sukses tanpa proses ulang) **tidak berubah** — ini sudah benar, mencegah aktivasi dobel kalau Pakasir kirim webhook yang sama 2x.
- Perbandingan `amount` sudah otomatis tertangani karena `getPakasirTransactionDetail` mengirim `trx.amount` (dari database milik kita sendiri, bukan dari payload webhook) sebagai bagian dari query ke API Pakasir — Pakasir yang akan menolak/tidak mengembalikan match kalau nominalnya tidak sesuai catatan mereka.
- Setelah perbaikan ini, transaksi yang gagal diverifikasi **tidak hilang** — statusnya tetap `pending` di `billing_transactions`, dan Pakasir akan retry webhook-nya secara otomatis. Kalau masih gagal terus setelah beberapa kali retry, itu baru perlu dicek manual (log server akan menunjukkan `[Pakasir Webhook] KRITIS`/`GAGAL`).

## Checklist Verifikasi

- [ ] Kirim payload palsu (`curl -X POST .../api/webhooks/pakasir -d '{"order_id":"<invoice-asli>","status":"completed"}'`) **tanpa** transaksi itu benar-benar lunas di Pakasir → tier **tidak** ikut aktif, response bukan sukses
- [ ] Hapus sementara `PAKASIR_API_KEY` di `.env.local` → aplikasi gagal start (kalau `instrumentation.ts` sudah diterapkan) — atau minimal webhook langsung menolak dengan `503` dan log `KRITIS`
- [ ] Simulasikan network error ke Pakasir (mis. matikan koneksi internet server sementara di dev) → webhook return `502`, tier tidak aktif, transaksi tetap `pending`
- [ ] Lakukan pembayaran sungguhan lewat sandbox/testing Pakasir → tier aktif dengan benar seperti sebelumnya (tidak ada regresi untuk kasus normal)
- [ ] Kirim webhook yang sama 2x untuk transaksi yang sudah `lunas` → tidak terjadi aktivasi dobel/perpanjangan dobel

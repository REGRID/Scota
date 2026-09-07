# Perbaikan Customer Journey Demo: Copy Jujur + Struk Ikut Terbawa ke Akun Baru

## Masalah

Tombol setelah scan demo berhasil (`IntroductionDashboard.tsx` baris ~746-753):

```tsx
<Link href="/register" ...>
  <ArrowRight />
  <span>Buka di Dashboard</span>
</Link>
```

Labelnya menjanjikan "buka di dashboard" — padahal cuma navigasi ke form register kosong, dan struk yang baru saja dilihat pengguna **tidak ikut terbawa sama sekali**. Ditambah 3 pintu masuk ke register/login (nav header, upsell kuota habis, CTA setelah scan sukses) yang tidak saling terhubung dan tidak konsisten pesannya.

## Solusi — 2 Lapis

### Lapis 1: Copy yang jujur (cepat, tanpa perubahan backend)

```tsx
// SEBELUM
<Link href="/register" ...>
  <ArrowRight />
  <span>Buka di Dashboard</span>
</Link>

// SESUDAH
<Link href={`/register?claimReceipt=${customParsedData.receiptId}`} ...>
  <ArrowRight />
  <span>Simpan Nota Ini — Daftar Gratis</span>
</Link>
```

Perlu tambahkan `receiptId` ke tipe `CustomParsedResult` di frontend supaya tersimpan dari response `parse-receipt` (yang sudah mengembalikan `savedReceiptId`):

```tsx
interface CustomParsedResult {
  merchantName: string
  date: string
  items: Array<{ name: string; category: string; subCategory?: string; price: number; quantity?: number }>
  totalAmount: number
  receiptId?: string  // baru -- dari savedReceiptId di response parse-receipt
}
```

### Lapis 2: Struk demo benar-benar dipindahkan ke akun baru (menutup janjinya sungguhan)

**`src/app/register/page.tsx`** — baca query param, simpan untuk dikirim saat submit:

```tsx
const searchParams = useSearchParams()
const claimReceiptId = searchParams.get("claimReceipt")

// ...saat submit form register, sertakan claimReceiptId di body...
const res = await fetch("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({ ...formData, claimReceiptId }),
})
```

**`src/app/api/auth/register/route.ts`** — setelah tenant baru berhasil dibuat, pindahkan struk (kalau ada & valid):

```ts
const { username, password, fullName, businessName, phone, email, claimReceiptId } = await req.json()

// ...proses registerAdminAccount seperti biasa, dapat `regResult.tenantId`...

if (claimReceiptId && regResult.tenantId) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const cleanIp = normalizeIp(ip)

  // Pindahkan HANYA kalau struk itu memang dari tenant demo milik IP yang sama --
  // mencegah orang lain mengklaim struk demo yang bukan miliknya lewat menebak ID.
  const claimed = await queryPg(
    `UPDATE receipts SET "tenantId" = $1
     WHERE id = $2
       AND "tenantId" IN (SELECT id FROM tenants WHERE "isDemo" = true AND "demoIpAddress" = $3)
     RETURNING id`,
    [regResult.tenantId, claimReceiptId, cleanIp]
  )

  if (claimed.rows?.[0]) {
    await queryPg(
      `UPDATE receipt_items SET "receiptId" = "receiptId" WHERE "receiptId" = $1`, // no-op aman, item ikut karena FK ke receiptId yang sama
      [claimReceiptId]
    )
  }
}
```

Pengecekan `"tenantId" IN (SELECT id FROM tenants WHERE "isDemo" = true AND "demoIpAddress" = $3)` adalah pengaman pentingnya — memastikan struk yang dipindahkan **memang** berasal dari sesi demo di IP yang sama dengan yang sedang mendaftar, bukan struk demo milik orang lain yang ID-nya kebetulan ditebak/didapat dari tempat lain.

### Lapis 3: Satukan pesan di ketiga pintu masuk

Samakan nada CTA di 3 tempat supaya terasa satu alur, bukan 3 fitur terpisah:

| Lokasi | Sebelum | Sesudah |
|---|---|---|
| Nav header | "Daftar Gratis" | *(tidak berubah — ini memang pintu netral untuk yang sudah yakin)* |
| Upsell kuota habis | "Mulai Free Trial 14 Hari" | *(tidak berubah — sudah tepat, muncul di momen yang jelas: kuota habis)* |
| Setelah scan sukses | "Buka di Dashboard" | **"Simpan Nota Ini — Daftar Gratis"** (lihat Lapis 1) |

Tidak semua CTA perlu diseragamkan persis — yang penting masing-masing **jujur** sesuai konteksnya. Nav header & upsell kuota habis sudah cukup jelas; yang paling bermasalah memang cuma CTA setelah scan sukses.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/components/IntroductionDashboard.tsx` | Tambah `receiptId` ke `CustomParsedResult`, ganti label & href tombol jadi jujur + bawa `claimReceipt` |
| `src/app/register/page.tsx` | Baca `claimReceipt` dari query param, sertakan di body saat submit |
| `src/app/api/auth/register/route.ts` | Setelah tenant baru dibuat, pindahkan struk yang diklaim (dengan validasi kepemilikan IP) |

## Catatan Penting

- Kalau `claimReceiptId` tidak valid, sudah kedaluwarsa (tenant demo-nya sudah dihapus cron), atau IP tidak cocok — proses register **tetap lanjut normal**, cuma bagian klaim struknya dilewati diam-diam. Jangan sampai kegagalan klaim struk menggagalkan seluruh proses pendaftaran.
- Ini cuma memindahkan **struk yang diklaim**, bukan seluruh isi tenant demo — kalau pengguna sempat scan 2x di demo, cuma struk yang dia klik "Simpan" yang ikut pindah, struk lain di tenant demo tetap kena hapus cron seperti biasa (ini konsisten dengan ekspektasi: dia cuma janji menyimpan "nota ini", bukan semuanya).

## Checklist Verifikasi

- [ ] Scan demo berhasil → tombol bertuliskan "Simpan Nota Ini — Daftar Gratis", bukan "Buka di Dashboard"
- [ ] Klik tombol itu → sampai ke `/register?claimReceipt=<id>` dengan ID yang benar
- [ ] Selesai isi form & daftar → buka dashboard → struk yang tadi di-scan **muncul** di riwayat, bukan dashboard kosong
- [ ] Coba manipulasi `claimReceipt` di URL dengan ID struk demo milik IP lain → tidak ikut terpindah (tetap register berhasil, tapi struknya tidak nyangkut)
- [ ] Daftar tanpa pernah scan demo (langsung dari nav header "Daftar Gratis") → tetap berhasil normal tanpa `claimReceipt`

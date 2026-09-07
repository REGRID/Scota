# Perbaikan: Footer "Buka Dashboard" Tanpa Syarat & Domain Metadata Tidak Konsisten

## Masalah 1 — Footer Selalu Menampilkan "Buka Dashboard →" ke Siapa Saja

`src/components/IntroductionDashboard.tsx` baris 1243-1248:

```tsx
<Link href="/login" className="text-slate-400 hover:text-white transition-colors">
  Masuk
</Link>
<Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
  Buka Dashboard →
</Link>
```

Tidak ada pengecekan status login sama sekali — pengunjung yang belum pernah daftar tetap melihat tombol hijau tebal "Buka Dashboard →", seolah dia sudah punya akun. Ini karena `IntroductionDashboard` (komponen landing page) dirender **sebelum** `MainApp.tsx` sempat tahu status autentikasi (`showLanding` dicek lebih dulu daripada `isAuthenticated` di alur render-nya) — jadi komponen ini sebenarnya tidak pernah tahu apakah pengunjungnya sudah login atau belum.

### Solusi

Teruskan status login dari `MainApp.tsx` sebagai prop ke `IntroductionDashboard`, lalu tampilkan link secara kondisional:

**`src/components/MainApp.tsx`** — sertakan `isAuthenticated` saat render:
```tsx
if (showLanding) {
  return (
    <IntroductionDashboard
      isAuthenticated={isAuthenticated}   // <- baru
      onEnterApp={(options) => { ... }}
      onOpenPricingModal={() => router.push("/pricing")}
    />
  )
}
```

**`src/components/IntroductionDashboard.tsx`** — terima prop baru & pakai di footer:
```tsx
interface IntroductionDashboardProps {
  isAuthenticated?: boolean | null   // baru
  onEnterApp: (options?: { mode?: "login" | "register"; tier?: SubscriptionTier }) => void
  onOpenPricingModal?: () => void
}

export function IntroductionDashboard({ isAuthenticated, onEnterApp, onOpenPricingModal }: IntroductionDashboardProps) {
  // ...

  // Bagian footer:
  {isAuthenticated ? (
    <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
      Buka Dashboard →
    </Link>
  ) : (
    <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
      Daftar Gratis →
    </Link>
  )}
```

Dengan begini: pengunjung yang belum login melihat ajakan yang jujur ("Daftar Gratis"), sementara pengunjung yang kebetulan sudah login (jarang terjadi karena biasanya langsung ke `/dashboard`, tapi bisa saja mereka buka tab baru ke `/`) tetap dapat pintasan yang relevan buat mereka.

## Masalah 2 — Metadata Share (Open Graph) Mengarah ke Domain Berbeda

`src/app/layout.tsx`:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://scota.id"),  // <- fallback ke domain lain
  ...
  openGraph: {
    ...
    url: "https://scota.id",  // <- hardcoded ke domain lain, tidak ikut metadataBase
    ...
  },
```

Domain yang benar-benar dipakai sekarang adalah `scota.web.id`, tapi `NEXT_PUBLIC_SITE_URL` sepertinya belum diset di environment production, jadi jatuh ke fallback `https://scota.id`. Ditambah `openGraph.url` di-hardcode terpisah, jadi walau `metadataBase` diperbaiki, baris ini tetap perlu diperbaiki manual juga.

### Solusi

**1. Set environment variable di Vercel** (Project Settings → Environment Variables):
```env
NEXT_PUBLIC_SITE_URL=https://scota.web.id
```

**2. Perbaiki fallback default di kode** (jaga-jaga kalau env var lupa diset lagi di kemudian hari):
```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://scota.web.id"),
```

**3. Hapus hardcode terpisah di `openGraph.url`, biarkan ikut `metadataBase`:**
```ts
openGraph: {
  type: "website",
  locale: "id_ID",
  url: "/",  // relatif -- otomatis digabung dengan metadataBase oleh Next.js
  title: "Scota — Otomatisasi Scan Nota & Pembukuan Bisnis",
  ...
```

Setelah ini, `og:image` (yang pathnya sudah relatif, `/scota-logo-detailed-dark.png`) otomatis ikut ter-resolve ke domain yang benar juga, karena keduanya sama-sama mengikuti `metadataBase`.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/components/MainApp.tsx` | Kirim prop `isAuthenticated` ke `IntroductionDashboard` |
| `src/components/IntroductionDashboard.tsx` | Footer "Buka Dashboard"/"Daftar Gratis" kondisional berdasarkan `isAuthenticated` |
| `src/app/layout.tsx` | Fallback `metadataBase` ke `scota.web.id`, `openGraph.url` ikut `metadataBase` (bukan hardcode terpisah) |
| Vercel Environment Variables | Set `NEXT_PUBLIC_SITE_URL=https://scota.web.id` |

## Catatan Penting

- Kalau rencananya nanti domain utama memang pindah ke `scota.id`, cukup ubah `NEXT_PUBLIC_SITE_URL` di Vercel — tidak perlu ubah kode lagi, karena sekarang semuanya mengikuti satu sumber kebenaran (`metadataBase`).
- Setelah perubahan metadata di-deploy, test ulang preview share-nya (WhatsApp/Facebook debugger) — beberapa platform meng-cache preview lama sampai beberapa hari, jadi hasil baru mungkin tidak langsung terlihat di klien yang sudah pernah membuka link sebelumnya.

## Checklist Verifikasi

- [ ] Buka `/` tanpa login → footer menampilkan "Daftar Gratis →", bukan "Buka Dashboard →"
- [ ] Login lalu buka `/` di tab baru → footer menampilkan "Buka Dashboard →" yang benar-benar mengarah ke dashboard aktif
- [ ] `curl -s https://scota.web.id/ | grep "og:url"` → menunjukkan `scota.web.id`, bukan `scota.id`
- [ ] Tempel link `https://scota.web.id` di WhatsApp/Facebook Sharing Debugger → preview gambar & judul konsisten dengan domain yang benar

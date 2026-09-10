# Fix: Validasi Tier Langganan Sebelum Fitur Premium Diaktifkan

## Masalah

`setTenantFeature()` di `src/lib/dynamicRoles.ts` cuma memvalidasi keamanan data saat **menonaktifkan** fitur (misal: jangan matikan `multi_tenant_roles` kalau masih ada staf lintas-cabang aktif). Tidak ada satu baris pun yang mengecek tier langganan tenant sebelum mengizinkan fitur **diaktifkan**:

```ts
export async function setTenantFeature(
  tenantId: string,
  featureKey: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!enabled) {
    // ...cuma validasi utk menonaktifkan, tidak ada cek apa pun sebelum mengaktifkan
  }
  // langsung UPSERT ke tenant_features tanpa cek tier
```

Dan endpoint `PATCH /api/settings/features` cuma mengecek `requireRole(req, ["OWNER"])` — memverifikasi yang meminta memang pemilik tenant, tapi tidak pernah memverifikasi **tenant itu berhak** mengaktifkan fitur itu berdasarkan tier langganannya. Akibatnya: tenant `trial` (belum pernah bayar) bisa mengaktifkan `custom_roles`, `custom_permissions`, `multi_tenant_roles`, `ownership_transfer` secara gratis — fitur yang berdasarkan copy marketing di `TIER_CONFIG` (`enterprise: "Dukungan Multi-Cabang & Multi-Usaha"`) jelas dimaksudkan eksklusif untuk tier atas.

## Solusi

### 1. Definisikan tier minimum per fitur — satu sumber kebenaran

`src/lib/dynamicRoles.ts` (tambahan di bagian atas):

```ts
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

/**
 * Tier minimum yang boleh mengaktifkan tiap fitur. Sesuaikan sesuai paket bisnis --
 * ini satu-satunya tempat yang perlu diubah kalau kebijakan paket berubah nanti.
 */
const FEATURE_MIN_TIER: Record<keyof TenantFeaturesMap, SubscriptionTier> = {
  multi_tenant_roles: "enterprise",   // sejalan dengan copy "Dukungan Multi-Cabang & Multi-Usaha" di TIER_CONFIG.enterprise
  custom_permissions: "enterprise",
  custom_roles: "pro",                // role custom (bukan lintas-cabang) dianggap cukup di tier Pro
  ownership_transfer: "enterprise",
}

const TIER_RANK: Record<SubscriptionTier, number> = { trial: 0, starter: 1, pro: 2, enterprise: 3 }

function tierMeetsMinimum(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_RANK[currentTier] >= TIER_RANK[requiredTier]
}
```

> Catatan: pemetaan di atas asumsi awal berdasarkan deskripsi tier yang sudah ada di `TIER_CONFIG` — silakan sesuaikan `FEATURE_MIN_TIER` kalau kebijakan paket sebenarnya beda (misal `custom_roles` ternyata mau dibuka mulai `starter`, tinggal ubah 1 baris ini).

### 2. Cek tier sebelum mengizinkan `enabled: true`

```ts
export async function setTenantFeature(
  tenantId: string,
  featureKey: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!(featureKey in FEATURE_MIN_TIER)) {
    return { success: false, error: "Nama fitur tidak dikenali." }
  }

  if (enabled) {
    const tenantRes = await queryPg<{ tier: SubscriptionTier }>(
      `SELECT s.tier FROM subscriptions s WHERE s."tenantId" = $1`,
      [tenantId]
    )
    const currentTier = tenantRes.rows?.[0]?.tier || "trial"
    const requiredTier = FEATURE_MIN_TIER[featureKey as keyof TenantFeaturesMap]

    if (!tierMeetsMinimum(currentTier, requiredTier)) {
      return {
        success: false,
        error: `Fitur ini memerlukan paket ${TIER_CONFIG[requiredTier].name} atau lebih tinggi. Paket Anda saat ini: ${TIER_CONFIG[currentTier].name}.`,
      }
    }
  }

  // Menonaktifkan fitur SELALU diizinkan tanpa cek tier -- supaya tenant yang tier-nya
  // turun (downgrade/expired) tidak pernah "terjebak" tidak bisa mematikan fitur sendiri.
  if (!enabled) {
    if (featureKey === "multi_tenant_roles") {
      // ...validasi yang sudah ada, tidak berubah...
    }
  }

  // ...lanjut UPSERT ke tenant_features seperti sebelumnya
}
```

### 3. Tangani penurunan tier — fitur yang sudah aktif tapi tidak lagi memenuhi syarat

Ini kasus penting yang perlu diputuskan: kalau tenant Enterprise sudah mengaktifkan `multi_tenant_roles`, lalu tier-nya turun/kedaluwarsa ke `starter` (gagal bayar, dsb), fitur yang sudah aktif itu **tidak otomatis nonaktif** dari perbaikan di atas — perbaikan ini cuma mencegah aktivasi **baru**. Tambahkan pengecekan terpisah supaya fitur yang sudah aktif tapi kini melebihi hak tier-nya tidak lagi memberi akses, tanpa perlu mengubah data `tenant_features` (supaya begitu tier naik lagi, fitur otomatis aktif kembali tanpa perlu diaktifkan ulang manual):

```ts
/**
 * Fitur efektif yang BENAR-BENAR aktif untuk tenant -- mempertimbangkan baik flag di
 * tenant_features MAUPUN tier saat ini. Pakai fungsi ini di tempat lain yang mengecek
 * "apakah tenant ini boleh pakai fitur X", jangan langsung baca getTenantFeatures() mentah.
 */
export async function getEffectiveTenantFeatures(tenantId: string): Promise<TenantFeaturesMap> {
  const [flags, tenantRes] = await Promise.all([
    getTenantFeatures(tenantId),
    queryPg<{ tier: SubscriptionTier }>(`SELECT tier FROM subscriptions WHERE "tenantId" = $1`, [tenantId]),
  ])

  const currentTier = tenantRes.rows?.[0]?.tier || "trial"

  const effective = { ...flags }
  for (const key of Object.keys(FEATURE_MIN_TIER) as (keyof TenantFeaturesMap)[]) {
    if (effective[key] && !tierMeetsMinimum(currentTier, FEATURE_MIN_TIER[key])) {
      effective[key] = false   // flag di DB tetap true, tapi secara efektif dianggap nonaktif
    }
  }
  return effective
}
```

Pastikan endpoint mana pun yang mengecek "apakah tenant ini boleh pakai fitur custom role/multi-tenant" (misalnya saat validasi bikin role baru, atau saat cek multi-branch access) memanggil `getEffectiveTenantFeatures()`, bukan `getTenantFeatures()` mentah.

## Ringkasan Perubahan File

| File | Perubahan |
|---|---|
| `src/lib/dynamicRoles.ts` | Tambah `FEATURE_MIN_TIER`, cek tier di `setTenantFeature` saat `enabled: true`, tambah `getEffectiveTenantFeatures()` |
| Endpoint yang mengecek fitur aktif (mis. `POST /api/settings/roles` saat scope `MULTI_TENANT`) | Ganti pemanggilan ke `getEffectiveTenantFeatures()` |

## Catatan Penting

- Pemetaan `FEATURE_MIN_TIER` di dokumen ini adalah **asumsi awal** berdasarkan deskripsi tier yang sudah ada — perlu dikonfirmasi/disesuaikan dengan kebijakan paket bisnis yang sebenarnya sebelum dianggap final.
- Menonaktifkan fitur sengaja **tidak** dibatasi tier apa pun — supaya tenant yang turun tier tidak pernah terjebak tidak bisa mengelola pengaturan mereka sendiri.
- Ini melengkapi (bukan menggantikan) validasi tier di pendaftaran yang sudah diperbaiki sebelumnya — pola yang sama (jangan percaya input/state yang bisa diubah user untuk menentukan akses berbayar) sekarang konsisten di dua tempat.

## Checklist Verifikasi

- [ ] Tenant tier `trial` coba `PATCH /api/settings/features` dengan `featureKey: "multi_tenant_roles", enabled: true` → ditolak dengan pesan jelas soal tier yang dibutuhkan
- [ ] Tenant tier `enterprise` melakukan hal yang sama → berhasil
- [ ] Tenant `enterprise` yang sudah aktifkan `multi_tenant_roles`, lalu tier-nya (disimulasikan) turun ke `starter` → `getEffectiveTenantFeatures()` mengembalikan `multi_tenant_roles: false` walau data di `tenant_features` masih `true`
- [ ] Tenant di atas naik tier lagi ke `enterprise` → fitur otomatis aktif kembali tanpa perlu di-toggle manual
- [ ] Menonaktifkan fitur tetap bisa dilakukan tier apa pun, tanpa dihalangi pengecekan tier

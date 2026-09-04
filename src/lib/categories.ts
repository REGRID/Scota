import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { DEFAULT_TENANT_ID } from "@/lib/session"

export interface CategoryHierarchyItem {
  id: string
  name: string
  subCategories: { id: string; name: string }[]
}

export const DEFAULT_SEED_CATEGORIES = [
  {
    name: "Operasional & Kantor",
    subs: [
      "Listrik & Air",
      "Internet, Pulsa & Software",
      "Sewa Gedung / Tempat",
      "Alat Tulis Kantor (ATK)",
      "Kebersihan & Sanitasi",
      "Maintenance & Perbaikan",
    ],
  },
  {
    name: "Belanja Barang & Persediaan",
    subs: [
      "Bahan Baku / Produk Jual",
      "Kemasan & Packaging",
      "Perlengkapan Toko / Usaha",
      "Stok Gudang",
    ],
  },
  {
    name: "Peralatan, Mesin & Aset",
    subs: [
      "Komputer, Gadget & Elektronik",
      "Mesin & Peralatan Usaha",
      "Kendaraan Operasional",
      "Furniture & Interior",
    ],
  },
  {
    name: "Transportasi & Logistik",
    subs: [
      "Bahan Bakar Minyak (BBM)",
      "Tol, Parkir & Transport",
      "Jasa Ekspedisi & Kurir",
      "Akomodasi & Perjalanan Dinas",
    ],
  },
  {
    name: "Jasa Profesional & Lain-lain",
    subs: [
      "Jasa Konsultan & Freelance",
      "Pemasaran & Iklan",
      "Pajak & Administrasi Bank",
      "Umum & Biaya Lainnya",
    ],
  },
]

// Per-tenant category cache
const cacheMap = new Map<string, { data: CategoryHierarchyItem[]; timestamp: number }>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds cache

export function invalidateCategoriesCache(tenantId?: string) {
  if (tenantId) {
    cacheMap.delete(tenantId)
  } else {
    cacheMap.clear()
  }
}

export async function getOrSeedCategories(tenantId?: string): Promise<CategoryHierarchyItem[]> {
  const effectiveTenantId = tenantId || DEFAULT_TENANT_ID
  const now = Date.now()
  const cached = cacheMap.get(effectiveTenantId)

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  if (!isDatabaseConfigured) {
    return DEFAULT_SEED_CATEGORIES.map((cat, idx) => ({
      id: `default-${idx}`,
      name: cat.name,
      subCategories: cat.subs.map((s, sIdx) => ({ id: `default-sub-${idx}-${sIdx}`, name: s })),
    }))
  }

  try {
    let res = await queryPg<{ id: string; name: string; parentId: string | null }>(
      `SELECT id, name, "parentId" FROM custom_categories 
       WHERE "tenantId" = $1 OR "tenantId" IS NULL 
       ORDER BY "createdAt" ASC`,
      [effectiveTenantId]
    )
    let customCats = res.rows || []

    // Auto-seed default categories for this tenant if empty
    if (customCats.length === 0) {
      for (const catGroup of DEFAULT_SEED_CATEGORIES) {
        const parentRes = await queryPg<{ id: string }>(
          `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
           VALUES ($1, $2, NULL, NOW()) 
           RETURNING id`,
          [effectiveTenantId, catGroup.name]
        )
        const parentId = parentRes.rows?.[0]?.id

        if (parentId) {
          for (const subName of catGroup.subs) {
            await queryPg(
              `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
               VALUES ($1, $2, $3, NOW())`,
              [effectiveTenantId, subName, parentId]
            )
          }
        }
      }

      // Re-fetch after seeding
      const refetched = await queryPg<{ id: string; name: string; parentId: string | null }>(
        `SELECT id, name, "parentId" FROM custom_categories 
         WHERE "tenantId" = $1 OR "tenantId" IS NULL 
         ORDER BY "createdAt" ASC`,
        [effectiveTenantId]
      )
      customCats = refetched.rows || []
    }

    const parents = customCats.filter((c) => !c.parentId)
    const subs = customCats.filter((c) => Boolean(c.parentId))

    const hierarchy: CategoryHierarchyItem[] = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      subCategories: subs
        .filter((sub) => sub.parentId === parent.id)
        .map((sub) => ({ id: sub.id, name: sub.name })),
    }))

    cacheMap.set(effectiveTenantId, { data: hierarchy, timestamp: now })
    return hierarchy
  } catch (error) {
    console.error("Error in getOrSeedCategories:", error)
    // Fallback static structure if DB query fails
    return DEFAULT_SEED_CATEGORIES.map((cat, idx) => ({
      id: `default-${idx}`,
      name: cat.name,
      subCategories: cat.subs.map((s, sIdx) => ({ id: `default-sub-${idx}-${sIdx}`, name: s })),
    }))
  }
}

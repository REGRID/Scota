import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

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

let cachedCategories: CategoryHierarchyItem[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds cache

export function invalidateCategoriesCache() {
  cachedCategories = null
  cacheTimestamp = 0
}

export async function getOrSeedCategories(): Promise<CategoryHierarchyItem[]> {
  const now = Date.now()
  if (cachedCategories && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCategories
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
      `SELECT id, name, "parentId" FROM custom_categories ORDER BY "createdAt" ASC`
    )
    let customCats = res.rows || []

    // Auto-seed default categories if empty
    if (customCats.length === 0) {
      for (const catGroup of DEFAULT_SEED_CATEGORIES) {
        const parentRes = await queryPg<{ id: string }>(
          `INSERT INTO custom_categories (name, "parentId", "createdAt") VALUES ($1, NULL, NOW()) RETURNING id`,
          [catGroup.name]
        )
        const parentId = parentRes.rows?.[0]?.id

        if (parentId) {
          for (const subName of catGroup.subs) {
            await queryPg(
              `INSERT INTO custom_categories (name, "parentId", "createdAt") VALUES ($1, $2, NOW())`,
              [subName, parentId]
            )
          }
        }
      }

      // Re-fetch after seeding
      const refetched = await queryPg<{ id: string; name: string; parentId: string | null }>(
        `SELECT id, name, "parentId" FROM custom_categories ORDER BY "createdAt" ASC`
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

    cachedCategories = hierarchy
    cacheTimestamp = now
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

import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getOrSeedCategories, invalidateCategoriesCache } from "@/lib/categories"

export async function GET() {
  try {
    const hierarchy = await getOrSeedCategories()
    const allCategoryNames = hierarchy.map((h) => h.name)

    const customCats: any[] = []
    hierarchy.forEach((h) => {
      customCats.push({ id: h.id, name: h.name, parentId: null })
      h.subCategories.forEach((sub) => {
        customCats.push({ id: sub.id, name: sub.name, parentId: h.id })
      })
    })

    return NextResponse.json({
      allCategories: allCategoryNames,
      customCategories: customCats,
      hierarchy,
      allRawCategories: customCats,
    })
  } catch (error: any) {
    console.error("GET Categories Error:", error)
    return NextResponse.json({
      allCategories: [],
      customCategories: [],
      hierarchy: [],
      allRawCategories: [],
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, parentId } = await req.json()
    const cleanName = name ? name.trim() : ""

    if (!cleanName || cleanName.length < 1) {
      return NextResponse.json({ error: "Nama kategori tidak boleh kosong" }, { status: 400 })
    }

    invalidateCategoriesCache()
    await getOrSeedCategories()

    if (!isDatabaseConfigured) {
      const hierarchy = await getOrSeedCategories()
      return NextResponse.json({ id: `cat-${Date.now()}`, name: cleanName, parentId: parentId || null, hierarchy })
    }

    let resolvedParentId: string | null = null

    if (parentId && typeof parentId === "string" && parentId.trim()) {
      const targetParentStr = parentId.trim()

      // 1. Try finding parent by ID
      const parentByIdRes = await queryPg<{ id: string }>(
        `SELECT id FROM custom_categories WHERE id = $1 LIMIT 1`,
        [targetParentStr]
      )

      if (parentByIdRes.rows?.[0]) {
        resolvedParentId = parentByIdRes.rows[0].id
      } else {
        // 2. Try finding parent by Name
        const parentByNameRes = await queryPg<{ id: string }>(
          `SELECT id FROM custom_categories WHERE LOWER(name) = LOWER($1) AND "parentId" IS NULL LIMIT 1`,
          [targetParentStr]
        )

        if (parentByNameRes.rows?.[0]) {
          resolvedParentId = parentByNameRes.rows[0].id
        } else {
          // 3. Create parent category if not found
          const createdParentRes = await queryPg<{ id: string }>(
            `INSERT INTO custom_categories (name, "parentId", "createdAt") VALUES ($1, NULL, NOW()) RETURNING id`,
            [targetParentStr]
          )
          resolvedParentId = createdParentRes.rows?.[0]?.id || null
        }
      }
    }

    // Check if duplicate exists
    let existingRes
    if (resolvedParentId) {
      existingRes = await queryPg<{ id: string; name: string }>(
        `SELECT id, name FROM custom_categories WHERE LOWER(name) = LOWER($1) AND "parentId" = $2 LIMIT 1`,
        [cleanName, resolvedParentId]
      )
    } else {
      existingRes = await queryPg<{ id: string; name: string }>(
        `SELECT id, name FROM custom_categories WHERE LOWER(name) = LOWER($1) AND "parentId" IS NULL LIMIT 1`,
        [cleanName]
      )
    }

    if (existingRes.rows?.[0]) {
      const updatedHierarchy = await getOrSeedCategories()
      return NextResponse.json({ ...existingRes.rows[0], hierarchy: updatedHierarchy }, { status: 200 })
    }

    const createRes = await queryPg(
      `INSERT INTO custom_categories (name, "parentId", "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
      [cleanName, resolvedParentId]
    )
    const created = createRes.rows?.[0]

    invalidateCategoriesCache()
    const finalHierarchy = await getOrSeedCategories()
    return NextResponse.json({ ...created, hierarchy: finalHierarchy }, { status: 201 })
  } catch (error: any) {
    console.error("POST Category Error:", error)
    return NextResponse.json({ error: error.message || "Gagal menambah kategori baru" }, { status: 500 })
  }
}

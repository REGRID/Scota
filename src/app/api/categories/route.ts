import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getOrSeedCategories, invalidateCategoriesCache } from "@/lib/categories"
import { getSession } from "@/lib/authHelper"
import { DEFAULT_TENANT_ID } from "@/lib/session"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID

    const hierarchy = await getOrSeedCategories(tenantId)
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
    const session = await getSession(req)
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID

    const { name, parentId } = await req.json()
    const cleanName = name ? name.trim() : ""

    if (!cleanName || cleanName.length < 1) {
      return NextResponse.json({ error: "Nama kategori tidak boleh kosong" }, { status: 400 })
    }

    invalidateCategoriesCache(tenantId)
    await getOrSeedCategories(tenantId)

    if (!isDatabaseConfigured) {
      const hierarchy = await getOrSeedCategories(tenantId)
      return NextResponse.json({ id: `cat-${Date.now()}`, name: cleanName, parentId: parentId || null, hierarchy })
    }

    const isMigrated = await isTenantSchemaMigrated(tenantId)

    if (isMigrated) {
      const result = await withTenantSchema(tenantId, async (client) => {
        let resolvedParentId: string | null = null

        if (parentId && typeof parentId === "string" && parentId.trim()) {
          const targetParentStr = parentId.trim()

          // 1. Try finding parent by ID
          const parentByIdRes: any = await client.query(
            `SELECT id FROM custom_categories WHERE id = $1 LIMIT 1`,
            [targetParentStr]
          )

          if (parentByIdRes.rows?.[0]) {
            resolvedParentId = parentByIdRes.rows[0].id
          } else {
            // 2. Try finding parent by Name
            const parentByNameRes: any = await client.query(
              `SELECT id FROM custom_categories WHERE LOWER(name) = LOWER($1) AND "parentId" IS NULL LIMIT 1`,
              [targetParentStr]
            )

            if (parentByNameRes.rows?.[0]) {
              resolvedParentId = parentByNameRes.rows[0].id
            } else {
              // 3. Create parent category for this tenant
              const createdParentRes: any = await client.query(
                `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
                 VALUES ($1, $2, NULL, NOW()) 
                 RETURNING id`,
                [tenantId, targetParentStr]
              )
              resolvedParentId = createdParentRes.rows?.[0]?.id || null
            }
          }
        }

        // Check if duplicate exists within tenant scope
        let existingRes: any
        if (resolvedParentId) {
          existingRes = await client.query(
            `SELECT id, name FROM custom_categories 
             WHERE LOWER(name) = LOWER($1) AND "parentId" = $2 
             LIMIT 1`,
            [cleanName, resolvedParentId]
          )
        } else {
          existingRes = await client.query(
            `SELECT id, name FROM custom_categories 
             WHERE LOWER(name) = LOWER($1) AND "parentId" IS NULL 
             LIMIT 1`,
            [cleanName]
          )
        }

        if (existingRes.rows?.[0]) {
          return { existing: existingRes.rows[0], status: 200 }
        }

        const createRes = await client.query(
          `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
           VALUES ($1, $2, $3, NOW()) 
           RETURNING *`,
          [tenantId, cleanName, resolvedParentId]
        )
        return { created: createRes.rows?.[0], status: 201 }
      })

      invalidateCategoriesCache(tenantId)
      const updatedHierarchy = await getOrSeedCategories(tenantId)
      if (result.existing) {
        return NextResponse.json({ ...result.existing, hierarchy: updatedHierarchy }, { status: 200 })
      }
      return NextResponse.json({ ...result.created, hierarchy: updatedHierarchy }, { status: 201 })
    }

    let resolvedParentId: string | null = null

    if (parentId && typeof parentId === "string" && parentId.trim()) {
      const targetParentStr = parentId.trim()

      // 1. Try finding parent by ID within tenant scope
      const parentByIdRes = await queryPg<{ id: string }>(
        `SELECT id FROM custom_categories 
         WHERE id = $1 AND ("tenantId" = $2 OR "tenantId" IS NULL) 
         LIMIT 1`,
        [targetParentStr, tenantId]
      )

      if (parentByIdRes.rows?.[0]) {
        resolvedParentId = parentByIdRes.rows[0].id
      } else {
        // 2. Try finding parent by Name within tenant scope
        const parentByNameRes = await queryPg<{ id: string }>(
          `SELECT id FROM custom_categories 
           WHERE LOWER(name) = LOWER($1) 
           AND "parentId" IS NULL 
           AND ("tenantId" = $2 OR "tenantId" IS NULL) 
           LIMIT 1`,
          [targetParentStr, tenantId]
        )

        if (parentByNameRes.rows?.[0]) {
          resolvedParentId = parentByNameRes.rows[0].id
        } else {
          // 3. Create parent category for this tenant
          const createdParentRes = await queryPg<{ id: string }>(
            `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
             VALUES ($1, $2, NULL, NOW()) 
             RETURNING id`,
            [tenantId, targetParentStr]
          )
          resolvedParentId = createdParentRes.rows?.[0]?.id || null
        }
      }
    }

    // Check if duplicate exists within tenant scope
    let existingRes
    if (resolvedParentId) {
      existingRes = await queryPg<{ id: string; name: string }>(
        `SELECT id, name FROM custom_categories 
         WHERE LOWER(name) = LOWER($1) 
         AND "parentId" = $2 
         AND ("tenantId" = $3 OR "tenantId" IS NULL) 
         LIMIT 1`,
        [cleanName, resolvedParentId, tenantId]
      )
    } else {
      existingRes = await queryPg<{ id: string; name: string }>(
        `SELECT id, name FROM custom_categories 
         WHERE LOWER(name) = LOWER($1) 
         AND "parentId" IS NULL 
         AND ("tenantId" = $2 OR "tenantId" IS NULL) 
         LIMIT 1`,
        [cleanName, tenantId]
      )
    }

    if (existingRes.rows?.[0]) {
      const updatedHierarchy = await getOrSeedCategories(tenantId)
      return NextResponse.json({ ...existingRes.rows[0], hierarchy: updatedHierarchy }, { status: 200 })
    }

    const createRes = await queryPg(
      `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt") 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [tenantId, cleanName, resolvedParentId]
    )
    const created = createRes.rows?.[0]

    invalidateCategoriesCache(tenantId)
    const finalHierarchy = await getOrSeedCategories(tenantId)
    return NextResponse.json({ ...created, hierarchy: finalHierarchy }, { status: 201 })
  } catch (error: any) {
    console.error("POST Category Error:", error)
    return NextResponse.json({ error: error.message || "Gagal menambah kategori baru" }, { status: 500 })
  }
}

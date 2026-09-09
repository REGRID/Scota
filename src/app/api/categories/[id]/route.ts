import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { invalidateCategoriesCache } from "@/lib/categories"
import { getSession } from "@/lib/authHelper"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    const { id } = await params
    const { name } = await req.json()
    const cleanName = name ? name.trim() : ""

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Nama kategori minimal 2 karakter" }, { status: 400 })
    }

    let updated = { id, name: cleanName }
    if (isDatabaseConfigured && session.tenantId) {
      const isMigrated = await isTenantSchemaMigrated(session.tenantId)
      if (isMigrated) {
        const res: any = await withTenantSchema(session.tenantId, async (client) => {
          return client.query(
            `UPDATE custom_categories SET name = $1 WHERE id = $2 RETURNING *`,
            [cleanName, id]
          )
        })
        if (!res.rows?.[0]) {
          return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 })
        }
        updated = res.rows[0]
      } else {
        const res = await queryPg(
          `UPDATE custom_categories SET name = $1 WHERE id = $2 AND "tenantId" = $3 RETURNING *`,
          [cleanName, id, session.tenantId]
        )
        if (!res.rows?.[0]) {
          return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 })
        }
        updated = res.rows[0]
      }
    }

    invalidateCategoriesCache(session.tenantId)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("PUT Category Error:", error)
    return NextResponse.json({ error: "Gagal memperbarui nama kategori" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    const { id } = await params

    if (isDatabaseConfigured && session.tenantId) {
      const isMigrated = await isTenantSchemaMigrated(session.tenantId)
      if (isMigrated) {
        const res: any = await withTenantSchema(session.tenantId, async (client) => {
          await client.query(`DELETE FROM custom_categories WHERE "parentId" = $1`, [id])
          return client.query(`DELETE FROM custom_categories WHERE id = $1 RETURNING id`, [id])
        })
        if (!res.rows?.[0]) {
          return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 })
        }
      } else {
        // Delete sub-categories under this parent first if it's a parent category
        await queryPg(
          `DELETE FROM custom_categories WHERE "parentId" = $1 AND "tenantId" = $2`,
          [id, session.tenantId]
        )

        // Delete the target category itself
        const res = await queryPg(
          `DELETE FROM custom_categories WHERE id = $1 AND "tenantId" = $2 RETURNING id`,
          [id, session.tenantId]
        )
        if (!res.rows?.[0]) {
          return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 })
        }
      }
    }

    invalidateCategoriesCache(session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE Category Error:", error)
    return NextResponse.json({ error: "Gagal menghapus kategori" }, { status: 500 })
  }
}

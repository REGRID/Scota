import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { invalidateCategoriesCache } from "@/lib/categories"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name } = await req.json()
    const cleanName = name ? name.trim() : ""

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Nama kategori minimal 2 karakter" }, { status: 400 })
    }

    let updated = { id, name: cleanName }
    if (isDatabaseConfigured) {
      const res = await queryPg(
        `UPDATE custom_categories SET name = $1 WHERE id = $2 RETURNING *`,
        [cleanName, id]
      )
      if (res.rows?.[0]) updated = res.rows[0]
    }

    invalidateCategoriesCache()
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("PUT Category Error:", error)
    return NextResponse.json({ error: "Gagal memperbarui nama kategori" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (isDatabaseConfigured) {
      // Delete sub-categories under this parent first if it's a parent category
      await queryPg(`DELETE FROM custom_categories WHERE "parentId" = $1`, [id])

      // Delete the target category itself
      await queryPg(`DELETE FROM custom_categories WHERE id = $1`, [id])
    }

    invalidateCategoriesCache()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE Category Error:", error)
    return NextResponse.json({ error: "Gagal menghapus kategori" }, { status: 500 })
  }
}

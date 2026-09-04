import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { invalidateCategoriesCache } from "@/lib/categories"

// GET: Export entire database data as JSON
export async function GET() {
  try {
    let receipts: any[] = []
    let customCategories: any[] = []
    let merchantDictionaries: any[] = []
    let productDictionaries: any[] = []

    if (isDatabaseConfigured) {
      const receiptsRes = await queryPg(
        `SELECT 
          r.*,
          COALESCE(
            json_agg(i.*) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as items
        FROM receipts r
        LEFT JOIN receipt_items i ON i."receiptId" = r.id
        GROUP BY r.id
        ORDER BY r."createdAt" ASC`
      )
      receipts = receiptsRes.rows || []

      const catsRes = await queryPg(`SELECT * FROM custom_categories ORDER BY "createdAt" ASC`)
      customCategories = catsRes.rows || []

      const merchRes = await queryPg(`SELECT * FROM merchant_dictionaries`)
      merchantDictionaries = merchRes.rows || []

      const prodRes = await queryPg(`SELECT * FROM product_dictionaries`)
      productDictionaries = prodRes.rows || []
    }

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      receipts,
      customCategories,
      merchantDictionaries,
      productDictionaries,
    }

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="NotaPhoto_Backup_${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error: any) {
    console.error("Backup Export Error:", error)
    return NextResponse.json({ error: "Gagal mengekspor cadangan database" }, { status: 500 })
  }
}

// POST: Restore / Import database data from JSON backup file
export async function POST(req: NextRequest) {
  try {
    const backupData = await req.json()

    if (!backupData || !backupData.receipts) {
      return NextResponse.json({ error: "Format file cadangan JSON tidak valid" }, { status: 400 })
    }

    let importedCategories = 0
    let importedReceipts = 0

    if (isDatabaseConfigured) {
      // 1. Restore Custom Categories
      if (backupData.customCategories && Array.isArray(backupData.customCategories)) {
        for (const cat of backupData.customCategories) {
          try {
            await queryPg(
              `INSERT INTO custom_categories (id, name, "parentId", "createdAt")
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [cat.id, cat.name, cat.parentId || null]
            )
            importedCategories++
          } catch (e) {}
        }
      }

      // 2. Restore Receipts & Items
      if (backupData.receipts && Array.isArray(backupData.receipts)) {
        for (const r of backupData.receipts) {
          try {
            const createRes = await queryPg<{ id: string }>(
              `INSERT INTO receipts (id, "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()), NOW())
               ON CONFLICT (id) DO NOTHING
               RETURNING id`,
              [
                r.id,
                r.merchantName || "Nota / Toko",
                r.date,
                r.imageUrl || null,
                Number(r.subtotal) || 0,
                Number(r.discountAmount) || 0,
                Number(r.taxAmount) || 0,
                Number(r.totalAmount) || 0,
                r.paymentMethod || "Cash",
                r.paymentStatus || "Lunas",
                r.note || null,
                r.createdAt || null,
              ]
            )

            if (createRes.rows?.[0] && r.items && Array.isArray(r.items)) {
              for (const it of r.items) {
                await queryPg(
                  `INSERT INTO receipt_items (id, "receiptId", name, category, "subCategory", price, quantity, "createdAt")
                   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                   ON CONFLICT (id) DO NOTHING`,
                  [
                    it.id,
                    r.id,
                    it.name || "Item",
                    it.category || "Lain-lain",
                    it.subCategory || "Umum",
                    Number(it.price) || 0,
                    Number(it.quantity) || 1,
                  ]
                )
              }
            }
            importedReceipts++
          } catch (e) {}
        }
      }
    }

    invalidateCategoriesCache()

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${importedReceipts} nota & ${importedCategories} kategori baru dari file backup.`,
      importedReceipts,
      importedCategories,
    })
  } catch (error: any) {
    console.error("Backup Import Error:", error)
    return NextResponse.json({ error: error.message || "Gagal mengimpor file cadangan" }, { status: 500 })
  }
}

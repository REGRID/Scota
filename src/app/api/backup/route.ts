import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { invalidateCategoriesCache } from "@/lib/categories"
import { getSession } from "@/lib/authHelper"

// GET: Export entire database data as JSON for the active tenant
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

    let receipts: any[] = []
    let customCategories: any[] = []

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
        WHERE r."tenantId" = $1
        GROUP BY r.id
        ORDER BY r."createdAt" ASC`,
        [session.tenantId]
      )
      receipts = receiptsRes.rows || []

      const catsRes = await queryPg(
        `SELECT * FROM custom_categories WHERE "tenantId" = $1 ORDER BY "createdAt" ASC`,
        [session.tenantId]
      )
      customCategories = catsRes.rows || []
    }

    // merchant_dictionaries & product_dictionaries sengaja TIDAK diikutkan --
    // itu kamus OCR bersama lintas tenant, bukan data milik satu tenant.

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tenantId: session.tenantId,
      receipts,
      customCategories,
    }

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="Backup_${session.tenantId}_${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error: any) {
    console.error("Backup Export Error:", error)
    return NextResponse.json({ error: "Gagal mengekspor cadangan database" }, { status: 500 })
  }
}

// POST: Restore / Import database data from JSON backup file for the active tenant
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login." }, { status: 401 })
    }

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
              `INSERT INTO custom_categories (id, name, "parentId", "tenantId", "createdAt")
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [cat.id, cat.name, cat.parentId || null, session.tenantId]
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
              `INSERT INTO receipts (id, "tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", note, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()), NOW())
               ON CONFLICT (id) DO NOTHING
               RETURNING id`,
              [
                r.id,
                session.tenantId,
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

import { NextRequest, NextResponse } from "next/server"
import { syncReceiptToPos } from "@/lib/posSync"
import { requireRole } from "@/lib/roleGuard"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const destination = body.destination || "BAR"

    // Kirim payload uji coba kecil
    const testResult = await syncReceiptToPos({
      receiptId: "TEST-PING-" + Date.now(),
      merchantName: "Scota POS Test Sync",
      date: new Date().toISOString().split("T")[0],
      totalAmount: 75000,
      subtotal: 75000,
      paymentMethod: "Cash",
      paymentStatus: "Lunas",
      note: "Uji Coba Integrasi POS & Inventaris Stok",
      stockDestination: destination,
      items: [
        {
          name: "Kertas Thermal Struk Kasir 80mm",
          category: "Operasional Toko",
          subCategory: "Perlengkapan Kasir & ATK",
          price: 75000,
          quantity: 1,
        },
      ],
    })

    return NextResponse.json(testResult)
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menguji koneksi POS" }, { status: 500 })
  }
}

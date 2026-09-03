import { NextRequest, NextResponse } from "next/server"
import { syncReceiptToPos } from "@/lib/posSync"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const destination = body.destination || "BAR"

    // Kirim payload uji coba kecil
    const testResult = await syncReceiptToPos({
      receiptId: "TEST-PING-" + Date.now(),
      merchantName: "Nota Photo Studio Test Sync",
      date: new Date().toISOString().split("T")[0],
      totalAmount: 50000,
      subtotal: 50000,
      paymentMethod: "Cash",
      paymentStatus: "Lunas",
      note: "Uji Coba Integrasi POS Studio & Stok",
      stockDestination: destination,
      items: [
        {
          name: "Test Sync Kertas Foto Glosy",
          category: "Bahan & Cetak Foto",
          subCategory: "Kertas Foto & Canvas",
          price: 50000,
          quantity: 1,
        },
      ],
    })

    return NextResponse.json(testResult)
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menguji koneksi POS" }, { status: 500 })
  }
}

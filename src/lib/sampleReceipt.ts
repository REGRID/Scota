/**
 * Generate a clean high-resolution canvas base64 of a sample business receipt for instant testing
 */
export function createSampleReceiptDataUrl(): string {
  if (typeof window === "undefined") return ""

  const canvas = document.createElement("canvas")
  canvas.width = 600
  canvas.height = 820
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  // Paper Background (Thermal receipt paper)
  ctx.fillStyle = "#fafafa"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Paper edge shadow
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40)
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 2
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

  // Header Store Text
  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 26px monospace"
  ctx.textAlign = "center"
  ctx.fillText("TOKO KEMASAN JAYA ABADI", canvas.width / 2, 80)

  ctx.font = "14px monospace"
  ctx.fillStyle = "#475569"
  ctx.fillText("Jl. Raya Niaga No. 45, Jakarta Barat", canvas.width / 2, 110)
  ctx.fillText("Telp: (021) 554-8890 | NPWP: 01.234.567.8-012", canvas.width / 2, 130)

  // Divider Line
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(50, 160)
  ctx.lineTo(550, 160)
  ctx.stroke()
  ctx.setLineDash([])

  // Receipt Meta
  ctx.textAlign = "left"
  ctx.font = "13px monospace"
  ctx.fillStyle = "#334155"
  const todayStr = new Date().toISOString().split("T")[0]
  ctx.fillText(`NO. STRUK: INV-${Date.now().toString().slice(-6)}`, 50, 190)
  ctx.fillText(`TANGGAL  : ${todayStr} 14:23 WIB`, 50, 210)
  ctx.fillText(`KASIR    : SITI / KSR-01`, 50, 230)
  ctx.fillText(`PELANGGAN: CASH / UMUM`, 50, 250)

  // Header Table
  ctx.beginPath()
  ctx.moveTo(50, 275)
  ctx.lineTo(550, 275)
  ctx.stroke()

  ctx.font = "bold 14px monospace"
  ctx.fillStyle = "#0f172a"
  ctx.fillText("ITEM / DESKRIPSI", 50, 295)
  ctx.textAlign = "right"
  ctx.fillText("TOTAL (RP)", 550, 295)

  ctx.beginPath()
  ctx.moveTo(50, 310)
  ctx.lineTo(550, 310)
  ctx.stroke()

  // Item List
  const items = [
    { name: "Kardus Packaging 20x20x10 (50 pcs)", qty: "50x @3.500", total: "175.000" },
    { name: "Lakban Bening Tebal 100M (4 roll)", qty: "4x @18.000", total: "72.000" },
    { name: "Bubble Wrap Hitam Premium (1 Roll)", qty: "1x @140.000", total: "140.000" },
    { name: "Plastik Polymailer 25x35 (100 pcs)", qty: "100x @650", total: "65.000" },
    { name: "Stiker Fragile Warning (2 Pack)", qty: "2x @14.000", total: "28.000" },
  ]

  let y = 340
  ctx.textAlign = "left"
  for (const it of items) {
    ctx.font = "bold 14px monospace"
    ctx.fillStyle = "#0f172a"
    ctx.fillText(it.name, 50, y)

    ctx.font = "12px monospace"
    ctx.fillStyle = "#64748b"
    ctx.fillText(it.qty, 50, y + 20)

    ctx.font = "bold 14px monospace"
    ctx.fillStyle = "#0f172a"
    ctx.textAlign = "right"
    ctx.fillText(it.total, 550, y + 10)
    ctx.textAlign = "left"

    y += 50
  }

  // Divider Line
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(50, y + 10)
  ctx.lineTo(550, y + 10)
  ctx.stroke()
  ctx.setLineDash([])

  // Totals
  y += 40
  ctx.font = "bold 14px monospace"
  ctx.fillText("SUBTOTAL", 50, y)
  ctx.textAlign = "right"
  ctx.fillText("480.000", 550, y)

  y += 25
  ctx.textAlign = "left"
  ctx.fillText("DISKON MEMBER", 50, y)
  ctx.textAlign = "right"
  ctx.fillText("-20.000", 550, y)

  y += 35
  ctx.font = "bold 18px monospace"
  ctx.fillStyle = "#059669"
  ctx.textAlign = "left"
  ctx.fillText("TOTAL AKHIR", 50, y)
  ctx.textAlign = "right"
  ctx.fillText("RP 460.000", 550, y)

  y += 30
  ctx.font = "13px monospace"
  ctx.fillStyle = "#475569"
  ctx.textAlign = "left"
  ctx.fillText("PEMBAYARAN : QRIS BCA (LUNAS)", 50, y)

  // Footer Note
  y += 45
  ctx.textAlign = "center"
  ctx.font = "12px monospace"
  ctx.fillStyle = "#94a3b8"
  ctx.fillText("Terima Kasih Atas Kunjungan Anda!", canvas.width / 2, y)
  ctx.fillText("Barang yang dibeli tidak dapat ditukar.", canvas.width / 2, y + 18)

  return canvas.toDataURL("image/jpeg", 0.92)
}

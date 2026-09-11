import { ImageResponse } from "next/og"

export const alt = "Scota - Aplikasi Pencatatan Pengeluaran & AI Scan Nota"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #022c22 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "70px 80px",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              fontWeight: 900,
              color: "#020617",
            }}
          >
            S
          </div>
          <span style={{ fontSize: "38px", fontWeight: 900, letterSpacing: "-0.03em" }}>
            SCOTA
          </span>
          <span
            style={{
              marginLeft: "12px",
              padding: "6px 14px",
              borderRadius: "20px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              fontSize: "15px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            AI Platform
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "1000px" }}>
          <h1
            style={{
              fontSize: "52px",
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Aplikasi Pencatatan Pengeluaran & AI Scan Nota Otomatis
          </h1>
          <p
            style={{
              fontSize: "23px",
              color: "#94a3b8",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Digitalisasi struk nota belanja, catat kas keluar otomatis berbasis AI, dan unduh laporan pembukuan toko ke Excel dalam hitungan detik.
          </p>
        </div>

        {/* Feature Badges */}
        <div style={{ display: "flex", gap: "14px" }}>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: "17px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            • Scan Nota OCR
          </div>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: "17px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            • Rekap Excel & PDF
          </div>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              fontSize: "17px",
              fontWeight: 700,
              color: "#34d399",
            }}
          >
            • Multi-Cabang & Staf
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

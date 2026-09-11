import { Metadata } from "next"
import React from "react"

export const metadata: Metadata = {
  title: "Harga Paket Aplikasi Pencatatan Pengeluaran & Kuota Scan Nota | Scota",
  description:
    "Pilihan paket langganan aplikasi pencatatan pengeluaran dan kuota scan nota otomatis berbasis AI untuk UMKM, toko retail, kafe, dan bisnis multi-cabang. Coba gratis 14 hari.",
  keywords: [
    "harga aplikasi pencatatan pengeluaran",
    "aplikasi catat pengeluaran",
    "aplikasi pencatat pengeluaran",
    "biaya scan nota otomatis",
    "software pembukuan pengeluaran umkm",
    "paket langganan scota",
    "aplikasi rekap pengeluaran toko",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Harga Paket Aplikasi Pencatatan Pengeluaran & Kuota Scan Nota | Scota",
    description:
      "Pilihan paket fleksibel untuk usaha rintisan hingga perusahaan multi-cabang. Digitalisasi nota belanja dan catat pengeluaran secara otomatis.",
    url: "/pricing",
    siteName: "Scota",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Harga Paket Aplikasi Pencatatan Pengeluaran & Kuota Scan Nota | Scota",
    description: "Digitalisasi nota belanja dan catat pengeluaran bisnis secara otomatis dengan Scota.",
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

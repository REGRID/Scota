import { Metadata } from "next"
import { MainApp } from "@/components/MainApp"

export const metadata: Metadata = {
  title: "Aplikasi Pencatatan Pengeluaran & AI Scan Nota Otomatis | Scota",
  description:
    "Aplikasi pencatatan pengeluaran otomatis berbasis AI. Foto nota belanja dan struk kasir, ekstrak rincian biaya tanpa ketik manual, dan ekspor rekap kas toko ke Excel.",
  keywords: [
    "aplikasi pencatatan pengeluaran",
    "aplikasi catat pengeluaran",
    "aplikasi pencatat pengeluaran",
    "aplikasi pembukuan pengeluaran",
    "aplikasi rekap pengeluaran",
    "aplikasi pencatatan pengeluaran dari nota",
    "aplikasi pencatatan pengeluaran usaha",
    "aplikasi pencatatan pengeluaran umkm",
    "scan nota otomatis",
    "ocr nota kasir indonesia",
  ],
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return <MainApp initialView="landing" />
}

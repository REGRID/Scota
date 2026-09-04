import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Riwayat & Ekspor Transaksi - Scota AI",
  description: "Lihat riwayat nota tersimpan, status persetujuan, dan ekspor ke Excel/PDF.",
}

export default function HistoryPage() {
  return <MainApp initialView="app" initialTab="history" />
}

import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Scota - AI OCR Nota & Otomatisasi Pembukuan Bisnis",
  description: "Platform digitalisasi dan ekstraksi nota belanja, struk, dan faktur fisik otomatis berbasis kecerdasan buatan.",
}

export default function HomePage() {
  return <MainApp initialView="landing" />
}

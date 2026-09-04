import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Scan Nota - Scota AI",
  description: "Pindai foto nota, struk fisik, atau faktur secara instan dengan OCR AI Scota.",
}

export default function ScanPage() {
  return <MainApp initialView="app" initialTab="scan" />
}

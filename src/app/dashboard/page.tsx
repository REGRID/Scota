import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Dashboard - Scota AI",
  description: "Dashboard pemindaian nota dan manajemen transaksi bisnis Scota.",
}

export default function DashboardPage() {
  return <MainApp initialView="app" initialTab="scan" />
}

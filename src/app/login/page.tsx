import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Masuk ke Akun - Scota AI",
  description: "Masuk ke akun Scota untuk mengelola nota, struk belanja, dan pembukuan bisnis Anda.",
}

export default function LoginPage() {
  return <MainApp initialView="login" />
}

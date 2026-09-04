import { MainApp } from "@/components/MainApp"

export const metadata = {
  title: "Sign In - Scota AI",
  description: "Sign In ke akun Scota untuk mengelola nota, struk belanja, dan pembukuan bisnis Anda.",
}

export default function SignInPage() {
  return <MainApp initialView="login" />
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DemoCallbackRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/auth/callback")
  }, [router])

  return null
}

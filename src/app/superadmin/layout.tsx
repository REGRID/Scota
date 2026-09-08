"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, SignInButton } from "@clerk/nextjs"
import { ShieldAlert, ShieldCheck, Lock, Loader2, ArrowLeft, ArrowRight } from "lucide-react"
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar"
import { SuperadminTopbar } from "@/components/superadmin/SuperadminTopbar"
import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"

const ALLOWED_SUPERADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "refo.gangga@gmail.com"
).toLowerCase().trim()

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { isLoaded, isSignedIn, user } = useUser()
  const [isSuperadminSessionValid, setIsSuperadminSessionValid] = useState<boolean | null>(null)

  // Jika sedang di halaman /superadmin/login, render langsung tanpa layout dashboard
  if (pathname === "/superadmin/login") {
    return <>{children}</>
  }

  // Verify internal superadmin JWT session
  const verifyInternalSession = async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user?.role === "SUPERADMIN") {
          setIsSuperadminSessionValid(true)
          return
        }
      }
      setIsSuperadminSessionValid(false)
    } catch {
      setIsSuperadminSessionValid(false)
    }
  }

  useEffect(() => {
    verifyInternalSession()
  }, [])

  // 1. Loading State
  if (!isLoaded || isSuperadminSessionValid === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Memeriksa Otorisasi Superadmin...</p>
      </div>
    )
  }

  // 2. Gate 1: Check Google / Clerk Authentication
  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative font-sans selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-white">Autentikasi Diperlukan</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Halaman ini hanya dapat diakses oleh akun Google resmi yang terdaftar sebagai Superadmin.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <SignInButton mode="redirect" forceRedirectUrl="/superadmin">
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-98 cursor-pointer"
              >
                Login dengan Google Superadmin
              </button>
            </SignInButton>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white py-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Gate 2: Check Allowed Google Email
  const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase().trim())
  const hasAuthorizedEmail = userEmails.includes(ALLOWED_SUPERADMIN_EMAIL)

  if (!hasAuthorizedEmail) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative font-sans selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/95 border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-white">Akses Ditolak</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Akun Google <strong className="text-white">({user.primaryEmailAddress?.emailAddress})</strong> tidak memiliki izin untuk membuka portal Superadmin.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Utama</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 4. Gate 3: Check Superadmin ID & Password Verification
  if (!isSuperadminSessionValid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="relative z-10 w-full flex flex-col items-center gap-4">
          <SuperadminLoginForm
            onSuccess={() => {
              setIsSuperadminSessionValid(true)
            }}
          />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors py-1 px-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    )
  }

  // 5. Authorized & Verified: Render Full Superadmin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        <SuperadminSidebar />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-xs bg-slate-950 h-full z-10 shadow-2xl animate-in slide-in-from-left">
            <SuperadminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <SuperadminTopbar
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}

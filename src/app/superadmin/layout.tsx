"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useUser, useClerk, SignInButton } from "@clerk/nextjs"
import { ShieldAlert, Lock, Loader2, ArrowLeft, ArrowRight } from "lucide-react"
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar"
import { SuperadminTopbar } from "@/components/superadmin/SuperadminTopbar"
import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"
import { getSuperadminEmail } from "@/lib/superadminConfig"

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { isLoaded, isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const [isSuperadminSessionValid, setIsSuperadminSessionValid] = useState<boolean | null>(null)
  const [authorizedEmail, setAuthorizedEmail] = useState<string>(() => getSuperadminEmail())

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
    fetch("/api/auth/superadmin-email")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authorizedEmail) {
          setAuthorizedEmail(data.authorizedEmail)
        }
      })
      .catch(() => {})
  }, [])

  // Auto-redirect from /superadmin/login to /superadmin once fully authorized
  useEffect(() => {
    if (isSignedIn && isSuperadminSessionValid && pathname === "/superadmin/login") {
      router.replace("/superadmin")
    }
  }, [isSignedIn, isSuperadminSessionValid, pathname, router])

  // 1. Loading State
  if (!isLoaded || isSuperadminSessionValid === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Memeriksa Akses Superadmin...</p>
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
            <h1 className="text-lg font-bold text-white">Autentikasi Superadmin</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Login dengan akun Google resmi untuk mengakses portal Superadmin.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <SignInButton mode="redirect" forceRedirectUrl="/superadmin">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Login dengan Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </SignInButton>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white py-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Halaman Utama</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Strict Single-Account Gate: Only 1 authorized email can access superadmin
  const targetEmail = authorizedEmail.toLowerCase().trim()
  const userEmail = (user.primaryEmailAddress?.emailAddress || "").toLowerCase().trim()

  if (userEmail !== targetEmail) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative font-sans selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/95 border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-white">Akses Ditolak</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Portal Superadmin dibatasi hanya untuk 1 akun resmi (
              <span className="text-emerald-400 font-mono font-bold">{authorizedEmail}</span>). Akun
              Anda (<span className="text-rose-400 font-mono">{userEmail || "Tanpa Email"}</span>)
              tidak terdaftar sebagai Superadmin.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/superadmin" })}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
            >
              Ganti Akun Google
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white py-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Halaman Utama</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Gate 2: Check Superadmin ID & Password Verification
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
            <span>Halaman Utama</span>
          </Link>
        </div>
      </div>
    )
  }

  // 4. Authorized & Verified: Render Full Superadmin Dashboard
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

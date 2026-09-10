"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser, useClerk } from "@clerk/nextjs"
import { Clock, ShieldAlert, Store, User, RefreshCw, XCircle, ArrowRight, Loader2, LogOut } from "lucide-react"
import { ThemeToggle, useTheme } from "@/lib/theme"

export default function PendingApprovalPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser()
  const { signOut } = useClerk()

  const [loading, setLoading] = useState(true)
  const [membershipData, setMembershipData] = useState<{
    status: string
    role: string
    businessName: string
    tagline: string | null
    logoUrl: string | null
  } | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Fetch current membership status
  const checkStatus = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      const res = await fetch("/api/membership/my-status", { cache: "no-store" })
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login")
          return
        }
        return
      }
      const data = await res.json()
      if (data.status === "ACTIVE") {
        router.replace("/dashboard")
        return
      }
      if (data.status === "NONE") {
        router.replace("/")
        return
      }
      setMembershipData(data)
    } catch (err) {
      console.error("Gagal memeriksa status persetujuan:", err)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isClerkLoaded) {
      if (!isClerkSignedIn) {
        router.replace("/login")
      } else {
        checkStatus()
      }
    }
  }, [isClerkLoaded, isClerkSignedIn])

  // Handle staff self-cancellation (Bab 12.1.C)
  const handleCancelPending = async () => {
    try {
      setCancelling(true)
      setCancelError(null)

      const res = await fetch("/api/membership/cancel-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setCancelError(data.error || "Gagal membatalkan pengajuan.")
        setCancelling(false)
        setShowCancelConfirm(false)
      } else {
        router.replace("/")
      }
    } catch (err: any) {
      setCancelError(err.message || "Terjadi kesalahan saat membatalkan pengajuan.")
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/login" })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-4 relative z-10 animate-in fade-in duration-300">
        {/* Header Logo */}
        <div className="text-center space-y-1">
          <Link href="/">
            <img
              src={isDark ? "/scota-logo-dark.png" : "/scota-logo.png"}
              alt="Scota AI"
              className="h-10 sm:h-11 w-auto mx-auto object-contain drop-shadow-xs"
            />
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Pusat Keanggotaan Staf & Otorisasi
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-lg">
            <Loader2 className="w-7 h-7 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Memeriksa status persetujuan...
            </p>
          </div>
        )}

        {/* Pending Approval Main Card */}
        {!loading && (
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl space-y-5">
            {/* Status Header Badge */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-0.5">
                  Menunggu Persetujuan
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {membershipData?.businessName || "Toko"}
                </h2>
              </div>
            </div>

            {/* Role Sensitivity Notice (Bab 9) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Otorisasi Akses Sensitif ({membershipData?.role || "ADMIN"})</span>
              </div>
              <p className="text-[11px] pl-5.5 text-amber-800/90 dark:text-amber-200/90">
                Peran {membershipData?.role || "Admin"} memiliki hak istimewa operasional. Pemilik toko perlu mengonfirmasi pendaftaran Anda sebelum ruang kerja dapat dibuka.
              </p>
            </div>

            {/* Active Account Details */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {clerkUser?.imageUrl ? (
                  <img
                    src={clerkUser.imageUrl}
                    alt={clerkUser.fullName || "User"}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {clerkUser?.fullName || clerkUser?.username || "Pengguna Google"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {clerkUser?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                title="Keluar dari akun ini"
              >
                <LogOut className="w-3 h-3" />
                <span>Ganti</span>
              </button>
            </div>

            {/* Error banner */}
            {cancelError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {cancelError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {/* Check Status Button */}
              <button
                type="button"
                onClick={() => checkStatus(true)}
                disabled={refreshing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Memeriksa Status..." : "Periksa Status Persetujuan"}</span>
              </button>

              {/* Cancel Request (Bab 12.1.C) */}
              {!showCancelConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelling}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-900 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 font-semibold text-xs transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Batalkan Pengajuan Ini</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2 text-center animate-in fade-in duration-150">
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                    Yakin ingin membatalkan pengajuan bergabung? Akun Anda akan dibebaskan untuk mendaftar ke toko lain.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelPending}
                      disabled={cancelling}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-sm transition-colors"
                    >
                      {cancelling ? "Membatalkan..." : "Ya, Batalkan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

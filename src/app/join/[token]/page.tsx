"use client"

import React, { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser, useClerk, SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { ShieldCheck, Store, UserCheck, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Sparkles, CheckCircle2, LogOut, User } from "lucide-react"
import { useTheme, ThemeToggle } from "@/lib/theme"

interface JoinPageProps {
  params: Promise<{ token: string }>
}

export default function JoinTenantPage({ params }: JoinPageProps) {
  const { token } = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser()
  const { signOut } = useClerk()

  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState<boolean | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<{
    role: string
    businessName: string
    tagline: string | null
    logoUrl: string | null
  } | null>(null)

  const [accepting, setAccepting] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [acceptedSuccess, setAcceptedSuccess] = useState<string | null>(null)

  // 1. Validate Token on Mount
  useEffect(() => {
    let isMounted = true
    async function checkToken() {
      try {
        setLoading(true)
        const res = await fetch(`/api/invites/${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!isMounted) return

        if (!res.ok || !data.valid) {
          setValid(false)
          setErrorReason(data.reason || "Tautan undangan tidak valid atau sudah kedaluwarsa.")
        } else {
          setValid(true)
          setInviteData({
            role: data.invite.role,
            businessName: data.tenant.businessName,
            tagline: data.tenant.tagline,
            logoUrl: data.tenant.logoUrl,
          })
        }
      } catch (err: any) {
        if (!isMounted) return
        setValid(false)
        setErrorReason(err.message || "Gagal memvalidasi tautan undangan.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (token) {
      checkToken()
    }

    return () => {
      isMounted = false
    }
  }, [token])

  // 2. Handle switching Google/Clerk accounts (Bab 11.3 & Bab 4.C)
  const handleSignOutAndSwitch = async () => {
    try {
      setSwitchingAccount(true)
      setAcceptError(null)
      await signOut({ redirectUrl: `/join/${encodeURIComponent(token)}` })
    } catch (err) {
      console.error("Gagal keluar akun:", err)
    } finally {
      setSwitchingAccount(false)
    }
  }

  // 3. User-confirmed Accept Invite (atomic check & bind)
  const handleAcceptInvite = async () => {
    if (!valid || accepting || acceptedSuccess) return

    try {
      setAccepting(true)
      setAcceptError(null)

      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setAcceptError(data.error || "Gagal memproses pendaftaran undangan.")
        setAccepting(false)
      } else {
        setAcceptedSuccess(data.message || "Undangan berhasil diterima! Mengalihkan...")
        const targetUrl = data.redirectUrl || "/dashboard"
        setTimeout(() => {
          router.replace(targetUrl)
        }, 1500)
      }
    } catch (err: any) {
      setAcceptError(err.message || "Terjadi kesalahan sistem saat menerima undangan.")
      setAccepting(false)
    }
  }

  const clerkAppearance = {
    baseTheme: isDark ? dark : undefined,
    layout: {
      unsafe_disableDevelopmentModeWarnings: true,
    },
    variables: {
      colorPrimary: isDark ? "#10b981" : "#059669",
      colorBackground: isDark ? "#0f172a" : "#ffffff",
      colorInputBackground: isDark ? "#020617" : "#f8fafc",
      colorInputText: isDark ? "#f8fafc" : "#0f172a",
      colorText: isDark ? "#f8fafc" : "#0f172a",
      colorTextSecondary: isDark ? "#94a3b8" : "#64748b",
      colorDanger: "#ef4444",
      borderRadius: "0.875rem",
      fontFamily: "inherit",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "w-full shadow-none border-none",
      footer: "hidden",
      footerAction: "hidden",
      footerPages: "hidden",
      card: isDark
        ? "w-full bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-xl rounded-3xl p-5 sm:p-7"
        : "w-full bg-white backdrop-blur-2xl border border-slate-200 shadow-lg rounded-3xl p-5 sm:p-7",
      formButtonPrimary: "bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md",
    },
  }

  const roleDescriptions: Record<string, string> = {
    KARYAWAN: "Akses operasional: memindai struk/nota, memasukkan data belanja, dan pencatatan kasir.",
    MANAGER: "Akses manajerial: menyetujui transaksi dual-control, verifikasi laporan, dan cetak rekap.",
    ADMIN: "Akses administratif staf: mengelola nota belanja, audit transaksi, dan mengoperasikan sistem toko.",
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

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
            Undangan Resmi Bergabung ke Tim Toko
          </p>
        </div>

        {/* State: Loading */}
        {loading && (
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-lg">
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Memeriksa keabsahan tautan undangan...
            </p>
          </div>
        )}

        {/* State: Invalid or Expired Token */}
        {!loading && valid === false && (
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tautan Tidak Dapat Digunakan
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {errorReason || "Tautan undangan ini sudah kedaluwarsa, dinonaktifkan, atau sudah mencapai batas penggunaan."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Masuk</span>
              </Link>
            </div>
          </div>
        )}

        {/* State: Valid Token */}
        {!loading && valid === true && inviteData && (
          <div className="space-y-4">
            {/* Business & Invitation Header Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Store className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Undangan Bergabung
                  </p>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    {inviteData.businessName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {inviteData.tagline || "Bisnis Scota"}
                  </p>
                </div>
              </div>

              {/* Role Info Badge */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Posisi / Peran yang Diberikan:
                  </span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {inviteData.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  {roleDescriptions[inviteData.role] || "Akses operasional sesuai instruksi pemilik toko."}
                </p>
              </div>

              {/* Error during accept (e.g. Anti-overlap violation - Bab 2 Prinsip #6) */}
              {acceptError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>Pendaftaran Tidak Dapat Diproses</span>
                  </div>
                  <p className="text-[11px] leading-relaxed pl-6">
                    {acceptError}
                  </p>
                  <div className="pt-1 flex items-center gap-2 pl-6">
                    <button
                      type="button"
                      onClick={handleSignOutAndSwitch}
                      disabled={switchingAccount}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-900 text-[11px] font-bold text-rose-900 dark:text-rose-100 transition-colors"
                    >
                      {switchingAccount ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                      <span>Ganti Akun Google Lain</span>
                    </button>
                    <Link
                      href="/"
                      className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Beranda
                    </Link>
                  </div>
                </div>
              )}

              {/* Success Acceptance Banner */}
              {acceptedSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs space-y-1.5 animate-in fade-in duration-200 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="font-bold text-sm">{acceptedSuccess}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Menyiapkan ruang kerja toko Anda...
                  </p>
                </div>
              )}

              {/* Sign in with Google (Clerk) - When user is not logged in */}
              {!isClerkSignedIn && (
                <div className="pt-1">
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-3">
                    Lanjutkan dengan Akun Google Anda untuk mengonfirmasi identitas:
                  </p>
                  <SignIn
                    routing="hash"
                    appearance={clerkAppearance}
                    fallbackRedirectUrl={`/join/${token}`}
                  />
                </div>
              )}

              {/* When Clerk is already signed in - Explicit identity verification & Ganti Akun button (Bab 11.3 & Bab 4.C) */}
              {isClerkSignedIn && !acceptedSuccess && !acceptError && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {clerkUser?.imageUrl ? (
                        <img
                          src={clerkUser.imageUrl}
                          alt={clerkUser.fullName || "User"}
                          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Masuk sebagai:
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {clerkUser?.fullName || clerkUser?.username || "Pengguna Google"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {clerkUser?.primaryEmailAddress?.emailAddress || ""}
                        </p>
                      </div>
                    </div>

                    {/* Tombol "Bukan Anda? Ganti Akun" (Bab 11.3) */}
                    <button
                      type="button"
                      onClick={handleSignOutAndSwitch}
                      disabled={switchingAccount || accepting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors shrink-0 shadow-xs"
                      title="Keluar dari akun ini dan masuk dengan akun Google lain"
                    >
                      {switchingAccount ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>Ganti Akun</span>
                    </button>
                  </div>

                  {/* Action button to confirm join */}
                  <button
                    type="button"
                    onClick={handleAcceptInvite}
                    disabled={accepting || switchingAccount}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menghubungkan ke Toko...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Gabung sebagai {inviteData.role}</span>
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Security Guarantee Footer */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Otentikasi Resmi Google
              </span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Langsung Terhubung
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

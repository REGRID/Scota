"use client"

import React, { useState, useEffect } from "react"
import { SignIn, SignUp } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { ArrowLeft, ShieldCheck, Zap, Sparkles } from "lucide-react"
import { SubscriptionTier } from "@/lib/subscription"
import { useTheme, ThemeToggle } from "@/lib/theme"

interface AdminLoginScreenProps {
  onLoginSuccess?: (token: string, username: string) => void
  onBackToLanding?: () => void
  initialMode?: "login" | "register" | "forgot"
  initialTier?: SubscriptionTier
}

export function AdminLoginScreen({
  onLoginSuccess,
  onBackToLanding,
  initialMode = "login",
}: AdminLoginScreenProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const [authMode, setAuthMode] = useState<"login" | "register">(
    initialMode === "register" ? "register" : "login"
  )

  useEffect(() => {
    if (initialMode === "register" || initialMode === "login") {
      setAuthMode(initialMode)
    }
  }, [initialMode])

  const switchMode = (mode: "login" | "register") => {
    setAuthMode(mode)
    if (typeof window !== "undefined") {
      const targetPath = mode === "register" ? "/register" : "/login"
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath)
      }
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
      headerTitle: isDark ? "text-base font-bold text-white tracking-tight" : "text-base font-bold text-slate-900 tracking-tight",
      headerSubtitle: isDark ? "text-xs text-slate-400 font-medium" : "text-xs text-slate-500 font-medium",
      formButtonPrimary: isDark
        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-[0.99]"
        : "bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-[0.99]",
      formFieldInput: isDark
        ? "bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs py-2.5 px-3.5 transition-colors"
        : "bg-slate-50 border border-slate-300 text-slate-900 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-xs py-2.5 px-3.5 transition-colors",
      formFieldLabel: isDark ? "text-xs font-semibold text-slate-300" : "text-xs font-semibold text-slate-700",
      socialButtonsBlockButton: isDark
        ? "bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 rounded-xl py-2.5 text-xs font-semibold transition-all"
        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl py-2.5 text-xs font-semibold transition-all",
      socialButtonsBlockButtonText: isDark ? "text-xs font-semibold text-slate-200" : "text-xs font-semibold text-slate-700",
      dividerLine: isDark ? "bg-slate-800" : "bg-slate-200",
      dividerText: isDark
        ? "text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-900 px-3"
        : "text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-white px-3",
      footerActionLink: isDark ? "text-emerald-400 hover:text-emerald-300 font-bold text-xs" : "text-emerald-600 hover:text-emerald-700 font-bold text-xs",
      footerActionText: isDark ? "text-xs text-slate-400" : "text-xs text-slate-500",
      identityPreviewText: isDark ? "text-xs text-slate-300" : "text-xs text-slate-700",
      identityPreviewEditButtonIcon: isDark ? "text-emerald-400" : "text-emerald-600",
      formFieldAction: isDark ? "text-xs text-emerald-400 hover:text-emerald-300 font-medium" : "text-xs text-emerald-600 hover:text-emerald-700 font-medium",
      alert: isDark
        ? "bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs rounded-xl"
        : "bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl",
      alertText: isDark ? "text-xs text-rose-300" : "text-xs text-rose-700",
    },
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Ambient Gradient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-4 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header Logo */}
        <div className="text-center space-y-1">
          <img
            src={isDark ? "/scota-logo-dark.png" : "/scota-logo.png"}
            alt="Scota — Cerdas Scan Nota & Pembukuan"
            className="h-10 sm:h-11 w-auto mx-auto object-contain drop-shadow-xs"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Platform Cerdas Digitalisasi & Rekapitulasi Nota Bisnis
          </p>
        </div>

        {/* Tab Switcher: Masuk vs Daftar */}
        <div className="flex bg-white dark:bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              authMode === "login"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              authMode === "register"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Daftar Toko Baru
          </button>
        </div>

        {/* Guidance for Invited Staff (Section 7 Design Spec) */}
        <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5 text-left">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Staf / Karyawan Toko?</span> Jika Anda diundang oleh pemilik toko, silakan gunakan <strong>Tautan Undangan Khusus</strong> (<code className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px]">/join/[token]</code>) yang dibagikan oleh pemilik toko Anda.
          </div>
        </div>

        {/* Clerk Auth Card */}
        <div className="flex justify-center w-full">
          {authMode === "login" ? (
            <SignIn
              routing="hash"
              appearance={clerkAppearance}
              signUpUrl="/register"
              fallbackRedirectUrl="/dashboard"
            />
          ) : (
            <SignUp
              routing="hash"
              appearance={clerkAppearance}
              signInUrl="/login"
              fallbackRedirectUrl="/dashboard"
            />
          )}
        </div>

        {/* Back to Home & Footer Meta */}
        <div className="flex flex-col items-center gap-2.5 pt-1">
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-900/60"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Beranda</span>
            </button>
          )}

          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-500" /> Keamanan Terenkripsi
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-500" /> Otentikasi Instan
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}


"use client"

import React, { useState, useEffect } from "react"
import { SignIn, SignUp } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { ArrowLeft, ShieldCheck, Zap } from "lucide-react"
import { SubscriptionTier } from "@/lib/subscription"

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
    baseTheme: dark,
    variables: {
      colorPrimary: "#10b981", // Emerald 500
      colorBackground: "#0f172a", // Slate 900
      colorInputBackground: "#020617", // Slate 950
      colorInputText: "#f8fafc", // Slate 50
      colorText: "#f8fafc",
      colorTextSecondary: "#94a3b8",
      colorDanger: "#ef4444",
      borderRadius: "0.875rem",
      fontFamily: "inherit",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      card: "w-full bg-slate-900/95 backdrop-blur-2xl border border-slate-800 shadow-2xl rounded-3xl p-4 sm:p-6",
      headerTitle: "text-base font-bold text-white tracking-tight",
      headerSubtitle: "text-xs text-slate-400 font-medium",
      formButtonPrimary:
        "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99]",
      formFieldInput:
        "bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs py-2.5 px-3.5 transition-colors",
      formFieldLabel: "text-xs font-semibold text-slate-300",
      socialButtonsBlockButton:
        "bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 rounded-xl py-2.5 text-xs font-semibold transition-all",
      socialButtonsBlockButtonText: "text-xs font-semibold text-slate-200",
      dividerLine: "bg-slate-800",
      dividerText: "text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-900 px-3",
      footerActionLink: "text-emerald-400 hover:text-emerald-300 font-bold text-xs",
      footerActionText: "text-xs text-slate-400",
      identityPreviewText: "text-xs text-slate-300",
      identityPreviewEditButtonIcon: "text-emerald-400",
      formFieldAction: "text-xs text-emerald-400 hover:text-emerald-300 font-medium",
      alert: "bg-red-950/30 border border-red-500/40 text-red-300 text-xs rounded-xl",
      alertText: "text-xs text-red-300",
    },
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Ambient Gradient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-4 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header Logo */}
        <div className="text-center space-y-1">
          <img
            src="/scota-logo-detailed-dark.png"
            alt="Scota — Cerdas Scan Nota & Pembukuan"
            className="h-11 sm:h-12 w-auto mx-auto object-contain drop-shadow-md"
          />
          <p className="text-xs text-slate-400 font-medium">
            Platform Cerdas Digitalisasi & Rekapitulasi Nota Bisnis
          </p>
        </div>

        {/* Tab Switcher: Masuk vs Daftar */}
        <div className="flex bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-md">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authMode === "login"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authMode === "register"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Daftar Akun
          </button>
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
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-slate-900/60"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Beranda</span>
            </button>
          )}

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> Keamanan Terenkripsi
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-500" /> Otentikasi Clerk
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

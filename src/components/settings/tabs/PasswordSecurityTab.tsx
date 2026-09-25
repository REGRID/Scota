"use client"

import React, { useState } from "react"
import { Lock, KeyRound, Loader2, Check, Eye, EyeOff, ShieldCheck, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { SettingsCard, SettingsCardHeader, SettingsCardFooter } from "@/components/settings/SettingsCard"

interface PasswordSecurityTabProps {
  currentUser: string
  oldPassword: string
  setOldPassword: (val: string) => void
  newPassword: string
  setNewPassword: (val: string) => void
  isUpdatingPassword: boolean
  onUpdatePassword: () => Promise<void>
}

export function PasswordSecurityTab({
  currentUser,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  isUpdatingPassword,
  onUpdatePassword,
}: PasswordSecurityTabProps) {
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!oldPassword.trim()) {
      toast.error("Kata sandi saat ini wajib diisi.")
      return
    }

    if (!newPassword.trim()) {
      toast.error("Kata sandi baru wajib diisi.")
      return
    }

    if (newPassword.trim().length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter demi keamanan.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi baru tidak cocok.")
      return
    }

    await onUpdatePassword()
    setConfirmPassword("")
  }

  const isLengthValid = newPassword.length >= 8
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Keamanan Akun & Kata Sandi"
          description="Kelola kata sandi kredensial toko Anda untuk akses alternatif langsung melalui ID Pengguna dan Kata Sandi."
          icon={KeyRound}
        />

        {/* Current Credential Info Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  ID Pengguna Kredensial Toko:
                </span>
                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white uppercase tracking-wider">
                  {currentUser || "ADMIN"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kredensial ini digunakan untuk masuk selain melalui Google Single Sign-On (SSO).
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kredensial Aktif</span>
          </div>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Kata Sandi Saat Ini</span>
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan kata sandi saat ini"
                className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password & Confirm Password Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Konfirmasi Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Validation Checklist */}
          {newPassword.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] animate-in fade-in duration-150">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                  isLengthValid
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                <Check className={`w-3 h-3 ${isLengthValid ? "text-emerald-500" : "text-slate-400"}`} />
                <span>Minimal 8 karakter</span>
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                  isMatch
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                <Check className={`w-3 h-3 ${isMatch ? "text-emerald-500" : "text-slate-400"}`} />
                <span>Konfirmasi cocok</span>
              </span>
            </div>
          )}

          <SettingsCardFooter>
            <span className="text-[11px] text-slate-400">
              Perubahan kata sandi akan langsung berlaku untuk sesi login kredensial berikutnya.
            </span>
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Perbarui Kata Sandi</span>
                </>
              )}
            </button>
          </SettingsCardFooter>
        </form>
      </SettingsCard>
    </div>
  )
}

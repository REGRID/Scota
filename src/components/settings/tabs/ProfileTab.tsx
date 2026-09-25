"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CheckCircle2,
  Edit3,
  LogOut,
  Shield,
  Building2,
  Loader2,
  Check,
  X,
  CreditCard,
  Sparkles,
  Smartphone,
  Tag,
} from "lucide-react"
import { toast } from "sonner"
import { SettingsCard, SettingsCardHeader, SettingsCardFooter } from "@/components/settings/SettingsCard"
import { Branch } from "@/components/BranchSwitcher"

interface ProfileTabProps {
  clerkUser: any
  isClerkSignedIn: boolean
  clerkSignOut: () => Promise<void>
  currentUser: string
  currentUserRole: string
  branches: Branch[]
  onNavigateTab: (tab: any) => void
  onUpdateUserName: (name: string) => void
}

interface UserProfileData {
  name: string
  email: string
  phone: string
  secondaryEmail: string
  jobTitle: string
  city: string
  promoOptIn: boolean
}

export function ProfileTab({
  clerkUser,
  isClerkSignedIn,
  clerkSignOut,
  currentUser,
  currentUserRole,
  branches,
  onNavigateTab,
  onUpdateUserName,
}: ProfileTabProps) {
  const router = useRouter()

  // Inline Quick Name Edit Modal / Banner
  const [isEditingName, setIsEditingName] = useState(false)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [isSavingQuickName, setIsSavingQuickName] = useState(false)

  // Personal Developer CRM Identity Form State
  const [profileData, setProfileData] = useState<UserProfileData>({
    name: clerkUser?.fullName || currentUser || "",
    email: clerkUser?.primaryEmailAddress?.emailAddress || "",
    phone: "",
    secondaryEmail: "",
    jobTitle: currentUserRole || "Owner / Pemilik",
    city: "",
    promoOptIn: true,
  })
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const displayName = profileData.name || clerkUser?.fullName || currentUser || "Pengguna Scota"
  const email =
    profileData.email ||
    clerkUser?.primaryEmailAddress?.emailAddress ||
    (currentUser.includes("@") ? currentUser : `${currentUser}@gmail.com`)
  const accountId = clerkUser?.id || currentUser
  const userRole = currentUserRole || (isClerkSignedIn ? "OWNER" : "ADMIN")

  // Load user CRM identity from /api/user/profile
  useEffect(() => {
    let isMounted = true
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.user && isMounted) {
            setProfileData({
              name: data.user.name || clerkUser?.fullName || currentUser || "",
              email: data.user.email || email,
              phone: data.user.phone || "",
              secondaryEmail: data.user.secondaryEmail || "",
              jobTitle: data.user.jobTitle || userRole || "Owner / Pemilik",
              city: data.user.city || "",
              promoOptIn: data.user.promoOptIn ?? true,
            })
          }
        }
      } catch (err) {
        console.warn("Could not load user CRM profile:", err)
      } finally {
        if (isMounted) setIsLoadingProfile(false)
      }
    }

    loadUserProfile()
    return () => {
      isMounted = false
    }
  }, [clerkUser, currentUser, email, userRole])

  const handleSaveQuickName = async () => {
    setIsSavingQuickName(true)
    try {
      if (clerkUser) {
        await clerkUser.update({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
        })
      }
      const full = `${editFirstName} ${editLastName}`.trim()
      if (full) {
        localStorage.setItem("nota_admin_user", full)
        onUpdateUserName(full)
        setProfileData((prev) => ({ ...prev, name: full }))
      }
      toast.success("Nama profil berhasil diperbarui!")
      setIsEditingName(false)
    } catch (err: any) {
      toast.error(err?.errors?.[0]?.message || "Gagal memperbarui profil")
    } finally {
      setIsSavingQuickName(false)
    }
  }

  const handleSavePersonalProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!profileData.name.trim()) {
      toast.error("Nama lengkap pengelola wajib diisi")
      return
    }

    setIsSavingProfile(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || "Gagal menyimpan identitas profil akun")
        return
      }

      localStorage.setItem("nota_admin_user", profileData.name.trim())
      onUpdateUserName(profileData.name.trim())
      toast.success("Identitas akun & kontak pengelola berhasil disimpan!")
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi saat menyimpan profil")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar dari sesi akun ini?")) {
      try {
        if (isClerkSignedIn) await clerkSignOut()
      } catch {}
      try {
        await fetch("/api/auth/logout", { method: "POST" })
      } catch {}
      localStorage.removeItem("nota_admin_token")
      localStorage.removeItem("nota_admin_user")
      localStorage.removeItem("nota_staff_name")
      router.push("/")
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Profile Hero Identity Header Card */}
      <SettingsCard>
        <SettingsCardHeader
          title="Profil Saya & Identitas Akun"
          description="Kelola nama tampilan, status otentikasi Google SSO, dan hak kelola akun pengelola Scota."
          icon={User}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isClerkSignedIn ? "Google SSO Aktif" : "Sesi Sistem"}</span>
            </span>
          }
        />

        {/* Profile Hero Box */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            {clerkUser?.imageUrl ? (
              <img
                src={clerkUser.imageUrl}
                alt={displayName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md shrink-0 ring-4 ring-emerald-500/10"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shrink-0">
                {(displayName[0] || "A").toUpperCase()}
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {userRole}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{email}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded ml-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Terverifikasi</span>
                </span>
              </p>

              <p className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">
                ID Akun: {accountId.length > 20 ? `${accountId.slice(0, 18)}...` : accountId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setEditFirstName(clerkUser?.firstName || currentUser.split(" ")[0] || "")
                setEditLastName(clerkUser?.lastName || currentUser.split(" ").slice(1).join(" ") || "")
                setIsEditingName(true)
              }}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-800 shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Ubah Nama</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </div>

        {/* Inline Name Editor Form */}
        {isEditingName && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-3 animate-in fade-in zoom-in-98 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-emerald-500" />
                <span>Ubah Nama Tampilan Profil</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Nama Depan
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Nama Depan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Nama Belakang
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Nama Belakang"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingQuickName}
                onClick={handleSaveQuickName}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingQuickName ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* 2. Personal Developer CRM Identity & Contact Details Card */}
      <SettingsCard>
        <SettingsCardHeader
          title="Identitas Akun & Kontak Pengelola"
          description="Data kontak resmi akun pemilik toko. Digunakan oleh tim pengembang Scota untuk korespondensi resmi, verifikasi akun, dan pengiriman promo lanjutan."
          icon={Smartphone}
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-bold border border-sky-500/20">
              <Sparkles className="w-3 h-3 text-sky-500" />
              <span>CRM & Layanan Promo</span>
            </span>
          }
        />

        <form onSubmit={handleSavePersonalProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-500" />
                <span>Nama Lengkap Pengelola</span>
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Nomor WhatsApp / HP Aktif */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>Nomor WhatsApp / HP Aktif</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="081234567890 atau +6281234567890"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Jalur utama developer untuk mengirimkan kupon diskon lisensi dan bantuan teknis darurat.
              </p>
            </div>

            {/* Email Utama Akun (Readonly Google SSO) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email Akun Utama (Login)</span>
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-mono outline-none cursor-not-allowed"
              />
            </div>

            {/* Email Kontak Sekunder / Penagihan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-500" />
                <span>Email Kontak Cadangan / Penagihan (Opsional)</span>
              </label>
              <input
                type="email"
                value={profileData.secondaryEmail}
                onChange={(e) => setProfileData({ ...profileData, secondaryEmail: e.target.value })}
                placeholder="contoh: keuangan@bisnis.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Email alternatif untuk bukti tagihan dan notifikasi pembukuan penting.
              </p>
            </div>

            {/* Jabatan / Peran Pengguna di Toko */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                <span>Jabatan / Posisi Pengelola</span>
              </label>
              <select
                value={profileData.jobTitle}
                onChange={(e) => setProfileData({ ...profileData, jobTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Pemilik (Owner) / Founder">Pemilik (Owner) / Founder</option>
                <option value="Direktur / General Manager">Direktur / General Manager</option>
                <option value="Manajer Operasional / Toko">Manajer Operasional / Toko</option>
                <option value="Supervisor / SPV Keuangan">Supervisor / SPV Keuangan</option>
                <option value="Staf Akuntan / Pembukuan">Staf Akuntan / Pembukuan</option>
                <option value="Kasir / Staf Outlet">Kasir / Staf Outlet</option>
              </select>
            </div>

            {/* Domisili / Kota */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>Kota / Domisili Operasional</span>
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                placeholder="Contoh: Surabaya, Jakarta, Denpasar"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Promo & Broadcast Opt-In Toggle Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 mt-2">
            <div className="space-y-1 pr-4">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Penawaran Promo & Pembaruan Sistem Eksklusif</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Saya bersedia menerima penawaran voucher perpanjangan lisensi, diskon kuota OCR, dan fitur terbaru dari developer via WhatsApp & Email.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setProfileData({ ...profileData, promoOptIn: !profileData.promoOptIn })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                profileData.promoOptIn ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  profileData.promoOptIn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <SettingsCardFooter>
            <span className="text-[11px] text-slate-400">
              Data kontak digunakan secara aman untuk verifikasi akun dan layanan purna jual pengembang.
            </span>
            <button
              type="submit"
              disabled={isSavingProfile || isLoadingProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Profil Akun</span>
                </>
              )}
            </button>
          </SettingsCardFooter>
        </form>
      </SettingsCard>

      {/* 3. System & Session Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Auth & Security Overview */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Autentikasi & Keamanan Sesi</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Metode Masuk:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                {isClerkSignedIn ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Google SSO (OAuth 2.0)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Kredensial Sistem</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Enkripsi Sesi:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TLS 1.3 & JWT Signed</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Status Akun:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] tracking-wide">
                AKTIF & TERVERIFIKASI
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Workspace & Access Overview */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-emerald-500" />
            <span>Workspace & Hak Kelola</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Hak Akses:</span>
              <span className="font-black text-slate-900 dark:text-white uppercase">
                {userRole}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Akses Cabang:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {branches.length > 0 ? `${branches.length} Cabang Terhubung` : "Outlet Utama"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Paket Langganan:</span>
              <button
                type="button"
                onClick={() => onNavigateTab("billing")}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Buka Kuota &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

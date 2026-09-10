"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  User,
  Phone,
  Store,
  Coffee,
  Briefcase,
  Wrench,
  Package,
  HeartPulse,
  Sparkles,
  ArrowRight,
  Upload,
  Camera,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"

const BUSINESS_CATEGORIES = [
  { id: "Toko & Ritel", label: "Toko & Ritel", icon: Store, desc: "Minimarket, Sembako, Butik, Toko Grosir" },
  { id: "Resto & Kafe", label: "Resto & Kafe", icon: Coffee, desc: "F&B, Coffee Shop, Warung, Kuliner" },
  { id: "Kantor & Jasa", label: "Kantor & Jasa", icon: Briefcase, desc: "Agensi, Konsultan, Studio, Jasa Profesi" },
  { id: "Bengkel & Otomotif", label: "Bengkel & Otomotif", icon: Wrench, desc: "Servis Kendaraan, Sparepart, Cuci Mobil" },
  { id: "Logistik & Olshop", label: "Logistik & Olshop", icon: Package, desc: "Online Shop, Gudang, Supplier, Ekspedisi" },
  { id: "Kesehatan & Kecantikan", label: "Kesehatan & Salon", icon: HeartPulse, desc: "Klinik, Apotek, Salon, Spa" },
]

const DAILY_SCALE_OPTIONS = [
  { id: "< 20 nota/hari", title: "< 20 Nota / Hari", desc: "Cocok untuk usaha baru atau rintisan" },
  { id: "20 - 100 nota/hari", title: "20 – 100 Nota / Hari", desc: "Operasional toko aktif & berkembang" },
  { id: "> 100 nota/hari", title: "> 100 Nota / Hari", desc: "Volume tinggi, cabang ramai, atau grosir" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [businessName, setBusinessName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [phone, setPhone] = useState("")
  const [businessType, setBusinessType] = useState("Toko & Ritel")
  const [estimatedDailyTransactions, setEstimatedDailyTransactions] = useState("20 - 100 nota/hari")
  const [logoUrl, setLogoUrl] = useState("")
  const [userRole, setUserRole] = useState("OWNER")

  // Load initial profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" })
        if (res.status === 401) {
          router.replace("/login")
          return
        }
        if (res.ok) {
          const data = await res.json()
          if (data.businessName && !data.businessName.startsWith("Bisnis Pengguna")) {
            setBusinessName(data.businessName)
          }
          if (data.ownerName) setOwnerName(data.ownerName)
          if (data.phone) setPhone(data.phone)
          if (data.businessType) setBusinessType(data.businessType)
          if (data.estimatedDailyTransactions) {
            setEstimatedDailyTransactions(data.estimatedDailyTransactions)
          }
          if (data.logoUrl) setLogoUrl(data.logoUrl)
          if (data.role) setUserRole(data.role)
        }
      } catch (err) {
        console.error("Gagal memuat profil onboarding:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [router])

  // Handle logo image upload and client-side resize
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Harap unggah file gambar (JPG, PNG, atau WebP)")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file logo maksimal 5MB")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const maxDim = 256
        let w = img.width
        let h = img.height
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        ctx?.drawImage(img, 0, 0, w, h)
        const compressedDataUrl = canvas.toDataURL("image/webp", 0.85)
        setLogoUrl(compressedDataUrl)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!businessName.trim()) {
      toast.error("Mohon isi Nama Usaha / Toko Anda")
      return
    }
    if (!ownerName.trim()) {
      toast.error("Mohon isi Nama Penanggung Jawab")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          businessType,
          estimatedDailyTransactions,
          logoUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data organisasi")
      }

      toast.success("Profil bisnis berhasil disimpan!")
      if (typeof window !== "undefined") {
        localStorage.setItem("nota_seen_onboarding", "true")
      }
      router.replace("/dashboard")
    } catch (err: any) {
      console.error("Onboarding submit error:", err)
      toast.error(err.message || "Terjadi kesalahan saat menyimpan data")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nota_seen_onboarding", "true")
    }
    router.replace("/dashboard")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">Menyiapkan form onboarding...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Dynamic Background Aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden z-10 transition-all">
        {/* Top Gradient Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Title Section */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Setup Profil Organisasi & Bisnis
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Lengkapi Data Bisnis Anda
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Bantu kami mengonfigurasi format nota, kategori pengeluaran, dan dashboard keuangan yang sesuai untuk usaha Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo Upload Section */}
            <div className="flex flex-col items-center justify-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden shadow-inner"
              >
                {logoUrl ? (
                  <>
                    <img
                      src={logoUrl}
                      alt="Logo Bisnis"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Camera className="w-5 h-5 text-emerald-400" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold text-slate-400">Logo Usaha</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {logoUrl ? "Ganti Logo" : "Upload Logo (Opsional)"}
                </button>
                <p className="text-[11px] text-slate-400 mt-0.5">Format PNG, JPG, atau WebP (Maks. 5MB)</p>
              </div>
            </div>

            {/* Inputs: Nama Usaha & Pemilik */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nama Usaha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  Nama Bisnis / Toko <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Contoh: Kopi Titik Temu, Toko Berkah"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder:text-slate-400 outline-none transition-all"
                />
              </div>

              {/* Nama Pemilik / Penanggung Jawab */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Nama Pemilik / PIC <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder:text-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Nomor WhatsApp Bisnis */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Nomor WhatsApp Bisnis
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder:text-slate-400 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Digunakan untuk notifikasi rekap pembukuan harian & penawaran fitur eksklusif.
              </p>
            </div>

            {/* Kategori Bisnis Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                Jenis / Kategori Bisnis
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BUSINESS_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isSelected = businessType === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setBusinessType(cat.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-500/80 text-white shadow-md shadow-emerald-950/30"
                          : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-400"}`} />
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{cat.label}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{cat.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Estimasi Transaksi Nota Harian */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                Estimasi Nota / Transaksi Harian
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {DAILY_SCALE_OPTIONS.map((opt) => {
                  const isSelected = estimatedDailyTransactions === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEstimatedDailyTransactions(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-500/80 text-white"
                          : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.title}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit & Navigation Buttons */}
            <div className="pt-3 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan Profil Bisnis...
                  </>
                ) : (
                  <>
                    Lanjutkan ke Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Data tersimpan aman & terenkripsi
                </span>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-slate-400 hover:text-slate-200 hover:underline transition-colors cursor-pointer"
                >
                  Lewati untuk sekarang
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

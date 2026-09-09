"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useUser, UserButton, Show } from "@clerk/nextjs"
import {
  Sparkles,
  CheckCircle2,
  Zap,
  ShieldCheck,
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  Layers,
  FileSpreadsheet,
  Clock,
  Smartphone,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Building2,
  Star,
  Receipt,
  Scan,
  Check,
  Lock,
  Store,
  Briefcase,
  Coffee,
  ShoppingBag,
  Truck,
  Wrench,
  Camera,
  FolderSync,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  FileUp,
  Loader2,
  AlertCircle,
  Trash2,
  FileText,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Eye,
  Maximize2,
  Menu,
  Sliders,
  DollarSign,
  Users,
  CheckCircle,
  Sparkle,
  HelpCircle,
} from "lucide-react"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { compressImageBase64 } from "@/lib/ocr"
import { getSupportWhatsAppNumber } from "@/lib/contactConfig"
import { ThemeToggle } from "@/lib/theme"

interface IntroductionDashboardProps {
  isAuthenticated?: boolean | null
  onEnterApp: (options?: { mode?: "login" | "register"; tier?: SubscriptionTier }) => void
  onOpenPricingModal?: () => void
}

interface CustomParsedResult {
  merchantName: string
  date: string
  items: Array<{
    name: string
    category: string
    subCategory?: string
    price: number
    quantity?: number
  }>
  totalAmount: number
  subtotal?: number
  receiptId?: string
}

export function IntroductionDashboard({
  isAuthenticated,
  onEnterApp,
  onOpenPricingModal,
}: IntroductionDashboardProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  const [cachedUser, setCachedUser] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nota_admin_user")
    }
    return null
  })
  const [sessionUser, setSessionUser] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nota_admin_user")
      if (stored) setCachedUser(stored)
    }

    // Unified check against Scota internal auth session
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setSessionUser(data.user.staffName || data.user.fullName || data.user.username)
        }
      })
      .catch(() => {})
  }, [])

  const isUserLoggedIn = Boolean(
    isAuthenticated === true ||
    (isLoaded && isSignedIn) ||
    Boolean(sessionUser) ||
    Boolean(cachedUser)
  )

  const activeDisplayName =
    user?.fullName ||
    user?.username ||
    sessionUser ||
    cachedUser ||
    "Pengguna"

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Interactive Live Demo Simulator State
  const [simStep, setSimStep] = useState<number>(1)
  const [selectedReceiptType, setSelectedReceiptType] = useState<"retail" | "office" | "operational" | "custom">("retail")

  // Custom User Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isScanningCustom, setIsScanningCustom] = useState<boolean>(false)
  const [scanProgressMessage, setScanProgressMessage] = useState<string>("")
  const [customParsedData, setCustomParsedData] = useState<CustomParsedResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showSourceModal, setShowSourceModal] = useState<boolean>(false)
  const [showImageLightbox, setShowImageLightbox] = useState<boolean>(false)
  const [lightboxZoom, setLightboxZoom] = useState<number>(1)
  const [lightboxRotate, setLightboxRotate] = useState<number>(0)
  const [activeSection, setActiveSection] = useState<string>("simulasi")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const docInputRef = useRef<HTMLInputElement | null>(null)

  // Demo Quota State
  const [demoQuota, setDemoQuota] = useState<{
    dailyLimit: number
    remaining: number
    used: number
    allowed: boolean
  } | null>(null)

  const fetchDemoQuota = async () => {
    try {
      const res = await fetch("/api/quota", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setDemoQuota(data)
      }
    } catch {}
  }

  useEffect(() => {
    fetchDemoQuota()
  }, [])

  // Scrollspy to detect active section dynamically on scroll
  useEffect(() => {
    const sectionIds = ["simulasi", "jenis-usaha", "komparasi", "fitur", "harga", "faq"]

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i]
        const el = document.getElementById(id)
        if (el) {
          const top = el.offsetTop
          if (scrollPosition >= top) {
            setActiveSection(id)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const businessTypes = [
    { name: "Toko & Ritel", icon: Store, desc: "Struk supplier & kasir" },
    { name: "Kantor & Bisnis", icon: Briefcase, desc: "Klaim & biaya operasional" },
    { name: "Resto & Kafe", icon: Coffee, desc: "Belanja bahan baku" },
    { name: "Studio & Agensi", icon: Camera, desc: "Sewa alat & operasional" },
    { name: "Bengkel & Servis", icon: Wrench, desc: "Suku cadang & perkakas" },
    { name: "Logistik & Olshop", icon: Truck, desc: "Ongkir & kemasan paket" },
  ]

  const faqs = [
    {
      q: "Apakah cocok untuk semua jenis usaha?",
      a: "Ya. Scota dirancang untuk toko ritel, restoran, kantor, studio kreatif, bengkel, logistik, hingga UMKM dan pekerja lepas.",
    },
    {
      q: "Bisa membaca struk thermal dan bon tulis tangan?",
      a: "Bisa. Sistem membaca struk thermal kasir, bon faktur kertas, kuitansi tulisan tangan, hingga invoice digital PDF.",
    },
    {
      q: "Bagaimana cara aktivasi lisensinya?",
      a: "Pilih paket bulanan atau tahunan. Lisensi langsung aktif seketika tanpa perlu instalasi aplikasi tambahan.",
    },
    {
      q: "Bisa menggunakan nama dan logo usaha sendiri?",
      a: "Bisa. Identitas usaha, logo, dan kop surat otomatis tercetak pada dokumen ekspor PDF dan Excel.",
    },
    {
      q: "Dapat diakses dari HP, tablet, dan laptop?",
      a: "Bisa. Aplikasi berbasis web responsif (PWA), dapat diakses bersamaan melalui browser HP, tablet kasir, dan laptop.",
    },
  ]

  const handleOrderWhatsApp = (tierKey: SubscriptionTier) => {
    const plan = TIER_CONFIG[tierKey]
    const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
    const cycleText = billingCycle === "yearly" ? "Tahunan (Hemat 17%)" : "Bulanan"
    const message = encodeURIComponent(
      `Halo Tim Scota, saya ingin memesan paket *${plan.name}* (${cycleText}) seharga Rp ${price.toLocaleString("id-ID")}. Mohon info aktivasi lisensinya.`
    )
    const phone = getSupportWhatsAppNumber()
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank")
  }

  const navItems = [
    { id: "simulasi", label: "Simulasi" },
    { id: "jenis-usaha", label: "Sektor Usaha" },
    { id: "komparasi", label: "Komparasi" },
    { id: "fitur", label: "Fitur" },
    { id: "harga", label: "Paket Harga" },
    { id: "faq", label: "FAQ" },
  ]

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setIsMobileMenuOpen(false)
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -75
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }

  // Handle User Uploading Real Receipt Image
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setScanError("Pilih berkas gambar (JPG, PNG, WEBP) atau PDF.")
      return
    }

    setScanError(null)
    setUploadedFileName(file.name)
    const previewUrl = URL.createObjectURL(file)
    setUploadedImage(previewUrl)
    setSelectedReceiptType("custom")
    setCustomParsedData(null)

    const reader = new FileReader()
    reader.onload = async () => {
      const rawBase64 = reader.result as string
      try {
        const compressedBase64 = await compressImageBase64(rawBase64, 1280, 1280, 0.82)
        setUploadedBase64(compressedBase64)
        await handleScanUploadedFile(compressedBase64, file)
      } catch {
        setUploadedBase64(rawBase64)
        await handleScanUploadedFile(rawBase64, file)
      }
    }
    reader.onerror = () => {
      setScanError("Gagal membaca gambar. Silakan coba lagi.")
    }
    reader.readAsDataURL(file)
  }

  // Trigger Real Cloud Scan for Uploaded Receipt
  const handleScanUploadedFile = async (base64Arg?: string, fileArg?: File) => {
    const base64Data = base64Arg || uploadedBase64
    const fileObj = fileArg || fileInputRef.current?.files?.[0] || cameraInputRef.current?.files?.[0] || galleryInputRef.current?.files?.[0] || docInputRef.current?.files?.[0]
    if (!base64Data && !fileObj) return

    setIsScanningCustom(true)
    setScanError(null)
    setSimStep(2)

    try {
      setScanProgressMessage("Mengekstrak data nota...")

      let res: Response
      if (base64Data) {
        res = await fetch("/api/parse-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64Data }),
        })
      } else {
        const formData = new FormData()
        if (fileObj) formData.append("image", fileObj)
        res = await fetch("/api/parse-receipt", {
          method: "POST",
          body: formData,
        })
      }

      const data = await res.json()
      const result = data?.result || data?.parsed || (data?.items ? data : null)

      if (res.ok && result) {
        setCustomParsedData({
          merchantName: result.merchantName || "Struk Pembelian Usaha",
          date: result.date || new Date().toISOString().split("T")[0],
          items: result.items && result.items.length > 0 ? result.items : [
            {
              name: "Total Transaksi Nota",
              category: "Operasional & Kantor",
              subCategory: "Umum",
              price: result.totalAmount || 0,
              quantity: 1,
            }
          ],
          totalAmount: result.totalAmount || (result.items || []).reduce((a: number, b: any) => a + (b.price || 0), 0) || 0,
          subtotal: result.subtotal,
          receiptId: data?.savedReceiptId || result?.receiptId || result?.id,
        })
        setScanError(null)
      } else {
        const errMsg = data?.message || data?.error || "Gagal membaca nota. Pastikan foto jelas dan tidak buram."
        setScanError(errMsg)
      }
    } catch (err: any) {
      console.error("Scan error:", err)
      setScanError(err.message || "Gagal memproses nota.")
    } finally {
      setIsScanningCustom(false)
      setScanProgressMessage("")
    }
  }

  const handleResetCustomUpload = () => {
    setUploadedImage(null)
    setUploadedBase64(null)
    setUploadedFileName(null)
    setCustomParsedData(null)
    setScanError(null)
    setSelectedReceiptType("retail")
    setSimStep(1)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
    if (docInputRef.current) docInputRef.current.value = ""
  }

  const handleOpenLightbox = () => {
    setLightboxZoom(1)
    setLightboxRotate(0)
    setShowImageLightbox(true)
  }

  const handleZoomIn = () => setLightboxZoom((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 3.5))
  const handleZoomOut = () => setLightboxZoom((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.5))
  const handleRotate = () => setLightboxRotate((prev) => (prev + 90) % 360)
  const handleResetZoom = () => {
    setLightboxZoom(1)
    setLightboxRotate(0)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#080d1a] dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* 1. TOP STICKY NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#080d1a]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 z-10">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-xl md:hidden text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/scota-logo-dark.png"
                alt="Scota"
                className="h-8 sm:h-9 w-auto object-contain dark:block hidden"
              />
              <img
                src="/scota-logo.png"
                alt="Scota"
                className="h-8 sm:h-9 w-auto object-contain dark:hidden block"
              />
            </Link>
          </div>

          {/* Nav Links (Desktop) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1.5 text-xs z-10">
            {navItems.map((item) => {
              const isActive = activeSection === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => scrollToSection(e, item.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer text-xs font-semibold ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </div>

          {/* Action CTA & Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 z-10">
            <ThemeToggle />

            {isUserLoggedIn ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 active:bg-emerald-700 text-white dark:text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Buka</span> Dashboard
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
                {isSignedIn ? (
                  <div className="flex items-center pl-0.5">
                    <UserButton
                      appearance={{
                        elements: {
                          userButtonAvatarBox:
                            "w-8 h-8 sm:w-9 sm:h-9 border border-emerald-500/50 hover:border-emerald-400 transition-all shadow-xs",
                          userButtonPopoverCard:
                            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl rounded-2xl",
                          userPreviewMainIdentifier: "text-slate-900 dark:text-white font-bold text-xs",
                          userPreviewSecondaryIdentifier: "text-slate-500 dark:text-slate-400 text-[11px]",
                          userButtonPopoverActionButton:
                            "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl",
                          userButtonPopoverActionButtonIcon: "text-emerald-600 dark:text-emerald-400",
                          userButtonPopoverFooter: "hidden",
                        },
                      }}
                    />
                  </div>
                ) : (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all cursor-pointer shadow-2xs"
                    title={`Login sebagai ${activeDisplayName}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-[11px] uppercase shadow-2xs">
                      {activeDisplayName[0].toUpperCase()}
                    </div>
                    <span className="capitalize hidden md:inline text-xs font-bold max-w-[120px] truncate">
                      {activeDisplayName}
                    </span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 active:bg-emerald-700 text-white dark:text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <span>Daftar Gratis</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#080d1a]/95 backdrop-blur-xl px-4 py-3 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
            {navItems.map((item) => {
              const isActive = activeSection === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => scrollToSection(e, item.id)}
                  className={`block px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <Link
                href="/pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 py-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl"
              >
                Paket Harga
              </Link>
              {isUserLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2 text-center text-xs font-bold text-white bg-emerald-600 dark:bg-emerald-500 rounded-xl"
                >
                  Buka Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  Masuk
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200/80 dark:border-slate-800/80">

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-5 sm:space-y-6">
            {/* Main Headline (Max 2 lines) */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12] text-balance">
              Otomatisasi Pembukuan & Scan Nota untuk Semua Jenis Usaha
            </h1>

            {/* Subtext (< 20 words) */}
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto text-balance">
              Digitalisasi otomatis struk, bon kasir, dan faktur fisik menjadi pembukuan rapi berbasis AI dalam hitungan detik.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isUserLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Buka Dashboard & Scan Nota</span>
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Coba Gratis 14 Hari</span>
                </Link>
              )}


              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <Receipt className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Lihat Paket Harga</span>
              </Link>
            </div>

            {/* Trust Micro-Metrics */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 sm:gap-x-8 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" /> Semua Jenis Usaha
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" /> Multi-Akses Kasir & Admin
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" /> Ekspor PDF & Excel Resmi
              </span>
            </div>
          </div>

          {/* 3. LIVE INTERACTIVE SCANNER & UPLOAD SIMULATOR */}
          <div id="simulasi" className="scroll-mt-24 mt-12 max-w-4xl mx-auto bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl dark:shadow-2xl backdrop-blur-md">
            {/* Header Simulator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Coba Scan Nota Sekarang
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      Demo Langsung
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Unggah foto nota untuk melihat ekstraksi data otomatis.
                  </p>
                </div>
              </div>

              {/* Quota Badge Indicator */}
              {demoQuota && (
                <div className="self-start sm:self-auto">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      demoQuota.remaining > 0
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                        : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${demoQuota.remaining > 0 ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-rose-500 dark:bg-rose-400"}`} />
                    <span>
                      {demoQuota.remaining > 0
                        ? `Sisa Uji Coba: ${demoQuota.remaining}/${demoQuota.dailyLimit || 2} Hari Ini`
                        : "Batas Uji Coba Habis (0/2)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={docInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Viewport */}
            {!uploadedImage && !isScanningCustom && !customParsedData && !scanError ? (
              <div className="pt-6">
                {demoQuota && !demoQuota.allowed ? (
                  <div className="bg-slate-50 dark:bg-slate-950/90 rounded-3xl p-6 sm:p-10 border border-amber-300 dark:border-amber-500/30 text-center space-y-5 relative overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                      <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>

                    <div className="space-y-2 max-w-md mx-auto">
                      <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Kuota Uji Coba Hari Ini Habis
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Anda telah menggunakan batas maksimal 2x uji coba scan nota gratis per hari untuk alamat IP ini. Buat akun bisnis Anda sekarang untuk mendapatkan kuota scan penuh tanpa batas.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => onEnterApp({ mode: "register" })}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Mulai Free Trial 14 Hari</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEnterApp({ mode: "login" })}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                      >
                        Masuk ke Akun
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowSourceModal(true)}
                    className="bg-slate-50/70 dark:bg-slate-950/80 rounded-3xl p-6 sm:p-12 border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-emerald-500/50 transition-all text-center space-y-6 relative overflow-hidden shadow-xs dark:shadow-2xl group cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm group-hover:scale-105 transition-transform">
                        <Scan className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                      </div>

                      <div className="space-y-1.5 max-w-xl mx-auto">
                        <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          Unggah atau Foto Nota
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                          Mendukung struk thermal kasir, bon belanja, dan faktur PDF.
                        </p>
                      </div>

                      {/* 1 Single Clean Action Button */}
                      <div className="pt-1.5 flex justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowSourceModal(true)
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Pilih atau Foto Nota</span>
                        </button>
                      </div>

                      {/* Feature Trust Pills */}
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Ekstraksi Real-Time Presisi
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Akurasi 99.8%
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Rekapitulasi Otomatis
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* LEFT COLUMN: Image Preview */}
                <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-3 relative overflow-hidden flex flex-col justify-between min-h-[340px]">
                  <div className="relative w-full h-full flex flex-col items-center justify-between space-y-3">
                    <div
                      onClick={handleOpenLightbox}
                      className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex items-center justify-center cursor-pointer group select-none shadow-inner"
                      title="Klik untuk memperbesar"
                    >
                      <img
                        src={uploadedImage || ""}
                        alt="Foto Nota"
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />

                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Foto Nota</span>
                      </div>

                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 text-slate-900 dark:text-white text-xs font-bold shadow-xl flex items-center gap-2 transform translate-y-1 group-hover:translate-y-0 transition-transform">
                          <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Perbesar</span>
                        </div>
                      </div>

                      {isScanningCustom && (
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 shadow-[0_0_15px_#10b981] animate-bounce top-0" />
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResetCustomUpload()
                        }}
                        className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-white/90 dark:bg-slate-950/80 hover:bg-rose-500 text-slate-500 dark:text-slate-400 hover:text-white border border-slate-200 dark:border-slate-700 transition-all cursor-pointer z-10 shadow-md"
                        title="Ganti foto nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-full pt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        onClick={handleOpenLightbox}
                        className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Detail</span>
                      </button>

                      <button
                        onClick={() => setShowSourceModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 font-semibold flex items-center gap-1.5 cursor-pointer transition-all text-xs"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Ganti Nota</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Results */}
                <div className="bg-slate-50 dark:bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Hasil Ekstraksi
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        Akurasi 99.8%
                      </span>
                    </div>

                    {isScanningCustom ? (
                      <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
                        <Loader2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 animate-spin" />
                        <div className="space-y-1">
                          <strong className="block text-sm text-slate-900 dark:text-white font-bold">Membaca Nota...</strong>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{scanProgressMessage}</p>
                        </div>
                      </div>
                    ) : scanError ? (
                      <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 rounded-2xl my-2">
                        <AlertCircle className="w-8 h-8 text-rose-500 dark:text-rose-400" />
                        <div className="space-y-1">
                          <strong className="block text-xs text-rose-800 dark:text-rose-300 font-bold">Gagal Ekstraksi</strong>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">{scanError}</p>
                        </div>
                        <button
                          onClick={() => handleScanUploadedFile()}
                          className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Pindai Ulang</span>
                        </button>
                      </div>
                    ) : customParsedData ? (
                      <div className="space-y-2.5 pt-2">
                        <div className="p-3 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200 dark:border-emerald-500/40 flex justify-between items-center text-xs shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Store className="w-4 h-4" />
                            </div>
                            <div>
                              <strong className="block text-slate-900 dark:text-white text-sm font-bold tracking-tight">{customParsedData.merchantName}</strong>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Tanggal: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{customParsedData.date}</span></span>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-400/30 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Terbaca
                          </span>
                        </div>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {customParsedData.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex justify-between items-center text-xs transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-slate-800 dark:text-slate-100 font-semibold">{item.name}</strong>
                                  {(item.quantity || 1) > 1 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold">
                                      {item.quantity}x
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-md text-[9.5px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 font-medium">
                                    {item.category} {item.subCategory ? `• ${item.subCategory}` : ""}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm shrink-0">
                                Rp {(item.price || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-gradient-to-r dark:from-emerald-950/80 dark:via-slate-900 dark:to-slate-900 border-2 border-emerald-400 dark:border-emerald-500/60 flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white shadow-sm">
                          <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">TOTAL PENGELUARAN</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-base sm:text-lg">
                            Rp {customParsedData.totalAmount.toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div className="pt-1 flex flex-col sm:flex-row gap-2">
                          <Link
                            href={
                              isUserLoggedIn
                                ? "/dashboard"
                                : customParsedData.receiptId
                                ? `/register?claimReceipt=${encodeURIComponent(customParsedData.receiptId)}`
                                : "/register"
                            }
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 active:scale-[0.98] text-white dark:text-slate-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>{isUserLoggedIn ? "Buka Dashboard Nota" : "Simpan Nota Ini — Daftar Gratis"}</span>
                          </Link>
                          <button
                            onClick={() => setShowSourceModal(true)}
                            className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Pindai Nota Lain</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Status Pembukuan:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Laporan Terbarui
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. BUSINESS TYPES SECTION */}
      <section id="jenis-usaha" className="scroll-mt-24 py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Sektor Usaha</h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cocok untuk Berbagai Jenis Usaha
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {businessTypes.map((b, idx) => {
              const Icon = b.icon
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center space-y-2 hover:border-emerald-500/50 transition-all group shadow-xs hover:shadow-md"
                >
                  <div className="w-10 h-10 mx-auto rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white">{b.name}</strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{b.desc}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 5. SPREADSHEET VS NOTA AI COMPARISON SECTION */}
      <section id="komparasi" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wide">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Komparasi Pembukuan
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Tinggalkan Cara Lama yang Menyita Waktu
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Perbandingan pencatatan spreadsheet manual dengan otomatisasi Scota.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* CARD 1: SPREADSHEET MANUAL (THE PROBLEM) */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-950/80 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <strong className="block text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Spreadsheet Manual
                      </strong>
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Rentan Salah & Boros Waktu</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                    Cara Lama
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-semibold">Input Manual Lambat</strong>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Mengetik nota satu per satu menyita waktu 2–4 jam per minggu.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-semibold">Rumus Mudah Rusak</strong>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Penggunaan sheet bersama berisiko merusak formula dan menghapus data.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-semibold">Nota Kertas Cepat Hilang</strong>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Tinta struk thermal cepat pudar dan kertas bon mudah tercecer.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-semibold">Rentan Selisih Kas</strong>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Salah ketik nominal memicu selisih saldo yang sulit dilacak.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-semibold">Tanpa Alur Approval</strong>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Perubahan angka dapat terjadi tanpa otorisasi resmi pemilik bisnis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Risiko selisih kas dan kebocoran dana operasional.</span>
              </div>
            </div>

            {/* CARD 2: NOTA AI SAAS (THE SOLUTION) */}
            <div className="bg-emerald-50/40 dark:bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden flex flex-col justify-between shadow-xl dark:shadow-2xl shadow-emerald-500/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                      <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <strong className="block text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Platform Scota
                      </strong>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Otomatis, Cepat & Aman</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    Solusi Cerdas
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-bold">Ekstraksi Otomatis Presisi</strong>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Sekali foto, sistem memproses item, nominal, diskon, dan tanggal secara terstruktur.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-bold">Cloud Aman & Terproteksi</strong>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Data tersimpan aman di cloud; kasir mengunggah dan Admin memverifikasi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-bold">Arsip Foto Nota Digital</strong>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Setiap transaksi terhubung dengan foto nota asli untuk kebutuhan audit.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-bold">Kategori Otomatis</strong>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Bebas salah ketik dan pos pengeluaran terkelompok rapi secara otomatis.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white block font-bold">Approval & Laporan Resmi</strong>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Alur persetujuan dari ponsel dan ekspor dokumen PDF/Excel berlogo usaha.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Hemat 95% Waktu Pembukuan
                </span>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
                >
                  Coba Sekarang
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. BENTO GRID FEATURES */}
      <section id="fitur" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Fitur Unggulan</h2>
            <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Fitur Lengkap untuk Pembukuan Praktis
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Semua yang Anda butuhkan untuk mengelola pengeluaran usaha.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento 1: Smart Visual Scanner */}
            <div className="md:col-span-2 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Scan className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ekstraksi Nota Berakurasi Tinggi</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                AI mengenali nama barang, nominal, diskon, dan pajak dari aneka nota belanja, struk kasir, hingga kuitansi fisik secara presisi.
              </p>
            </div>

            {/* Bento 2: Self-Learning Memory */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Katalog Cerdas</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sistem otomatis mengingat produk dan kategori langganan usaha Anda untuk mempercepat pencatatan berikutnya.
              </p>
            </div>

            {/* Bento 3: Dual-Admin Approval */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Approval Bertingkat</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Kasir mengunggah nota, Admin 1 memeriksa rincian, dan Admin 2 memberikan persetujuan akhir.
              </p>
            </div>

            {/* Bento 4: PDF & Excel Official Statements */}
            <div className="md:col-span-2 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Laporan Resmi Ber-Branding</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Cetak laporan keuangan bulanan format PDF dan Excel lengkap dengan logo resmi bisnis Anda untuk audit dan pajak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRICING & SUBSCRIPTION PLANS */}
      <section id="harga" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Paket Langganan</h2>
            <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Harga Transparan Sesuai Kebutuhan
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Pilih paket sesuai volume nota usaha Anda. Lisensi langsung aktif seketika.
            </p>

            {/* Cycle Toggle */}
            <div className="pt-4 flex justify-center">
              <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${billingCycle === "monthly" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${billingCycle === "yearly" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                >
                  Tahunan
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                    Hemat 17%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {(["starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
              const plan = TIER_CONFIG[tierKey]
              const isPro = tierKey === "pro"
              const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly

              return (
                <div
                  key={tierKey}
                  className={`relative rounded-3xl p-6 sm:p-8 border flex flex-col justify-between transition-all ${isPro
                      ? "bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-xl dark:shadow-2xl shadow-emerald-500/10 ring-2 ring-emerald-500/30"
                      : "bg-slate-50/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase px-4 py-0.5 rounded-full shadow-md tracking-wider">
                      Paling Populer
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                          Rp {price.toLocaleString("id-ID")}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          /{billingCycle === "yearly" ? "tahun" : "bulan"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8 space-y-2">
                    <Link
                      href="/register"
                      className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${isPro
                          ? "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 active:scale-[0.98]"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]"
                        }`}
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Coba Gratis 14 Hari</span>
                    </Link>
                    <button
                      onClick={() => handleOrderWhatsApp(tierKey)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Pesan via WhatsApp</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
            >
              <span>Lihat Komparasi Fitur Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FAQ SECTION */}
      <section id="faq" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">FAQ</h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Pertanyaan Umum
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left text-sm font-bold text-slate-900 dark:text-white flex justify-between items-center gap-4 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="py-12 bg-slate-900 dark:bg-slate-950 text-slate-400 text-xs border-t border-slate-800 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/scota-icon.png"
              alt="Scota"
              className="w-8 h-8 object-contain"
            />
            <div>
              <span className="font-bold text-white">Scota Platform</span>
              <p className="text-[11px] text-slate-400">
                © {new Date().getFullYear()} Scota Platform. Solusi otomatisasi pembukuan bisnis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">
              Paket Harga
            </Link>
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
              Privasi
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
              Ketentuan
            </Link>
            <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
              Masuk
            </Link>
            {isUserLoggedIn ? (
              <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                Buka Dashboard →
              </Link>
            ) : (
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                Daftar Gratis →
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* Action Sheet Modal */}
      {showSourceModal && (
        <div
          onClick={() => setShowSourceModal(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-4.5 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Pilih Sumber Nota
              </h4>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setShowSourceModal(false)
                  cameraInputRef.current?.click()
                }}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                      Kamera
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Foto nota langsung</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setShowSourceModal(false)
                  galleryInputRef.current?.click()
                }}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
                      Galeri
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Pilih dari galeri foto</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setShowSourceModal(false)
                  docInputRef.current?.click()
                }}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      Dokumen PDF
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Unggah berkas invoice PDF</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </button>
            </div>

            <button
              onClick={() => setShowSourceModal(false)}
              className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showImageLightbox && uploadedImage && (
        <div
          onClick={() => setShowImageLightbox(false)}
          className="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="truncate">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                  {customParsedData?.merchantName || "Detail Foto Nota"}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {uploadedFileName || "nota.jpg"} {customParsedData ? `• ${customParsedData.date}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-mono font-bold text-emerald-400 px-2 min-w-[48px] text-center hidden sm:inline-block">
                {Math.round(lightboxZoom * 100)}%
              </span>

              <button
                onClick={handleZoomIn}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={handleRotate}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Putar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetZoom}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer hidden sm:flex"
                title="Reset 100%"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-6 bg-slate-700 mx-1" />

              <button
                onClick={() => setShowImageLightbox(false)}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            onClick={() => setShowImageLightbox(false)}
            className="flex-1 w-full max-w-5xl mx-auto my-3 sm:my-4 flex items-center justify-center overflow-auto rounded-3xl border border-slate-800/80 bg-slate-900/40 p-4 relative"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative transition-transform duration-200 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotate}deg)`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={uploadedImage}
                alt="Foto Nota"
                className="max-h-[70vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-slate-700/50"
              />
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl mx-auto p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          >
            {customParsedData ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Hasil:</span>
                <strong className="text-white font-bold">{customParsedData.merchantName}</strong>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  Rp {customParsedData.totalAmount.toLocaleString("id-ID")}
                </span>
                <span className="text-slate-400">({customParsedData.items.length} item)</span>
              </div>
            ) : (
              <span className="text-slate-400">Gunakan kontrol perbesar atau putar untuk rincian teks struk.</span>
            )}

            <button
              onClick={() => setShowImageLightbox(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all cursor-pointer text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

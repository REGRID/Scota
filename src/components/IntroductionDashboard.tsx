"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Sparkles,
  CheckCircle2,
  Zap,
  ShieldCheck,
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
} from "lucide-react"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { compressImageBase64 } from "@/lib/ocr"

interface IntroductionDashboardProps {
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
}

export function IntroductionDashboard({
  onEnterApp,
  onOpenPricingModal,
}: IntroductionDashboardProps) {
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const docInputRef = useRef<HTMLInputElement | null>(null)

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
    { name: "Kantor & Perusahaan", icon: Briefcase, desc: "Klaim reimbursement & ATK" },
    { name: "Resto, Cafe & F&B", icon: Coffee, desc: "Belanja bahan & perlengkapan" },
    { name: "Studio & Agensi", icon: Camera, desc: "Aset, sewa & freelance" },
    { name: "Bengkel & Jasa", icon: Wrench, desc: "Sparepart & alat kerja" },
    { name: "Logistik & Olshop", icon: Truck, desc: "Ongkir, bensin & packaging" },
  ]

  const faqs = [
    {
      q: "Apakah bisa digunakan untuk semua jenis bisnis dan usaha?",
      a: "Tentu saja! Scota dirancang universal untuk segala jenis usaha: Toko Ritel, Kantor/Perusahaan, Resto & Cafe, Agensi & Studio Kreatif, Bengkel, Kontraktor, Ekspedisi, hingga UMKM & Freelancer.",
    },
    {
      q: "Apakah sistem dapat membaca bon tulisan tangan atau struk kasir thermal?",
      a: "Ya! Pemindai visual kami terlatih membaca berbagai format: struk kasir thermal minimarket/supermarket, bon faktur kertas pasar, kuitansi tulis tangan, hingga invoice digital PDF.",
    },
    {
      q: "Bagaimana sistem langganan & aktivasi lisensinya?",
      a: "Pilih paket bulanan atau tahunan yang sesuai dengan kebutuhan kuota nota usaha Anda. Setelah konfirmasi, Anda akan menerima Kunci Lisensi resmi yang langsung aktif tanpa instalasi software rumit.",
    },
    {
      q: "Apakah laporan ekspor bisa memakai Nama & Logo Bisnis saya sendiri?",
      a: "Pasti! Anda bebas mengatur Nama Usaha, Logo, Alamat, dan Catatan Resmi di profil bisnis. Setiap ekspor dokumen PDF dan Excel akan otomatis menggunakan branding usaha Anda.",
    },
    {
      q: "Bisa dipakai di HP, Tablet kasir, dan Laptop sekaligus?",
      a: "Bisa! Aplikasi ini berbasis Progressive Web App (PWA) modern yang ringan dan responsif, dapat diakses dari browser HP Android/iOS, tablet kasir toko, maupun laptop akunting Anda.",
    },
  ]

  const handleOrderWhatsApp = (tierKey: SubscriptionTier) => {
    const plan = TIER_CONFIG[tierKey]
    const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
    const cycleText = billingCycle === "yearly" ? "Tahunan (Hemat 17%)" : "Bulanan"
    const message = encodeURIComponent(
      `Halo Tim Scota, saya ingin berlangganan paket *${plan.name}* (${cycleText}) seharga Rp ${price.toLocaleString("id-ID")}. Mohon info prosedur aktivasi lisensi untuk usaha kami.`
    )
    window.open(`https://wa.me/6281234567890?text=${message}`, "_blank")
  }

  const navItems = [
    { id: "simulasi", label: "Simulasi" },
    { id: "jenis-usaha", label: "Semua Usaha" },
    { id: "komparasi", label: "Komparasi" },
    { id: "fitur", label: "Fitur" },
    { id: "harga", label: "Harga" },
    { id: "faq", label: "FAQ" },
  ]

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -75 // Height offset for sticky navbar
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }

  // Handle User Uploading Real Receipt Image
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setScanError("Silakan pilih file gambar (JPG, PNG, atau WEBP).")
      return
    }

    setScanError(null)
    setUploadedFileName(file.name)
    const previewUrl = URL.createObjectURL(file)
    setUploadedImage(previewUrl)
    setSelectedReceiptType("custom")
    setCustomParsedData(null)

    // Convert and compress to optimized base64 Data URL for instant OCR processing
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
      setScanError("Gagal membaca file gambar. Silakan coba unggah ulang.")
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
      setScanProgressMessage("Membaca & mengekstrak data nota...")

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
        })
        setScanError(null)
      } else {
        const errMsg = data?.message || data?.error || "Gagal mengekstrak foto nota. Pastikan gambar jelas dan tidak buram."
        setScanError(errMsg)
      }
    } catch (err: any) {
      console.error("Scan error:", err)
      setScanError(err.message || "Gagal memproses struk melalui server OCR.")
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. TOP NAVBAR */}
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 z-10">
            <img
              src="/scota-logo-dark.png"
              alt="Scota"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>

          {/* Nav Links (Desktop) with Dynamic Active Scrollspy - Absolutely Centered */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1.5 text-xs z-10">
            {navItems.map((item) => {
              const isActive = activeSection === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => scrollToSection(e, item.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black shadow-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 font-semibold border border-transparent"
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </div>

          {/* Action CTA */}
          <div className="flex items-center gap-2 sm:gap-3 z-10">
            <button
              onClick={() => onEnterApp({ mode: "login" })}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer"
            >
              Masuk
            </button>
            <button
              onClick={() => onEnterApp({ mode: "register", tier: "trial" })}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-98 cursor-pointer"
            >
              <span>Daftar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 border-b border-slate-900">
        {/* Ambient Backlight Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-emerald-500/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-extrabold tracking-wide uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Platform Digitalisasi Struk & Faktur Bisnis #1
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Otomatisasi Pembukuan & Scan Nota untuk Semua Jenis Usaha
            </h1>

            {/* Subtext highlighting Spreadsheet pain points */}
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto">
              Tinggalkan input manual satu per satu di spreadsheet yang rawan terhapus dan membuang waktu. Cukup foto nota fisik, sistem otomatis mengekstrak rincian barang, nominal, dan merekapitulasi pembukuan dalam hitungan detik.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onEnterApp({ mode: "register", tier: "trial" })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/30 active:scale-98 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-slate-950" />
                <span>Mulai Uji Coba Gratis 14 Hari</span>
              </button>

              <a
                href="#harga"
                onClick={(e) => scrollToSection(e, "harga")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Lihat Paket Langganan</span>
              </a>
            </div>

            {/* Trust Micro-Metrics */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" /> Cocok untuk Semua Bisnis
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" /> Multi-Role Kasir & Admin
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" /> Ekspor PDF & Excel Branding Usaha
              </span>
            </div>
          </div>

          {/* 3. LIVE INTERACTIVE SCANNER & UPLOAD SIMULATOR */}
          <div id="simulasi" className="scroll-mt-24 mt-12 max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md">
            {/* Header Simulator & Tab Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    Live Simulator: Coba Scan Nota Sekarang
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Interaktif
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pindai foto nota atau bon pengeluaran secara langsung untuk melihat sistem mengekstrak data secara otomatis.
                  </p>
                </div>
              </div>
            </div>

            {/* Hidden File Inputs for Specific Sources */}
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

            {/* Viewport: Full Width Upload Hero on Default, Split Grid when Active */}
            {!uploadedImage && !isScanningCustom && !customParsedData && !scanError ? (
              /* A. FULL-WIDTH SPACIOUS HERO UPLOAD DROPZONE */
              <div className="pt-6">
                <div
                  onClick={() => setShowSourceModal(true)}
                  className="bg-slate-950/80 rounded-3xl p-6 sm:p-12 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 transition-all text-center space-y-6 relative overflow-hidden shadow-2xl group cursor-pointer"
                >
                  {/* Subtle Background Glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

                  <div className="space-y-4 relative z-10">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10 group-hover:scale-110 transition-transform">
                      <Scan className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                    </div>

                    <div className="space-y-1.5 max-w-xl mx-auto">
                      <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                        Unggah atau Potret Foto Nota Sekarang
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Pindai struk kasir thermal, bon belanja toko, kuitansi kertas, atau faktur PDF untuk mengekstrak seluruh data nominal & item secara otomatis.
                      </p>
                    </div>

                    {/* 3 Quick Action Source Cards */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2"
                    >
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 hover:bg-emerald-950/50 border border-slate-800 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center space-y-2 transition-all cursor-pointer group/btn active:scale-95 shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover/btn:bg-emerald-500 group-hover/btn:text-slate-950 transition-colors">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-white">Ambil via Kamera</span>
                        <span className="text-[10.5px] text-slate-400">Potret langsung nota fisik</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 hover:bg-teal-950/50 border border-slate-800 hover:border-teal-500/50 flex flex-col items-center justify-center text-center space-y-2 transition-all cursor-pointer group/btn active:scale-95 shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover/btn:bg-teal-500 group-hover/btn:text-slate-950 transition-colors">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-white">Pilih dari Galeri</span>
                        <span className="text-[10.5px] text-slate-400">Foto struk di album HP/PC</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/50 flex flex-col items-center justify-center text-center space-y-2 transition-all cursor-pointer group/btn active:scale-95 shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover/btn:bg-purple-500 group-hover/btn:text-slate-950 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-white">Upload Dokumen / PDF</span>
                        <span className="text-[10.5px] text-slate-400">Berkas faktur & nota PDF</span>
                      </button>
                    </div>

                    {/* Feature Trust Pills */}
                    <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Ekstraksi Kilat ~1.5 Detik
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Akurasi 99.8% Multi-Barang
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Otomatis Masuk Pembukuan Usaha
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* B. 2-COLUMN SPLIT RESULTS VIEW */
              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* LEFT COLUMN: Input Receipt (Uploaded Image with Lightbox) */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300 space-y-3 relative overflow-hidden flex flex-col justify-between min-h-[340px]">
                  <div className="relative w-full h-full flex flex-col items-center justify-between space-y-3">
                    {/* Clickable Image Container with Hover Zoom & Tooltip */}
                    <div
                      onClick={handleOpenLightbox}
                      className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 flex items-center justify-center cursor-pointer group select-none shadow-inner"
                      title="Klik untuk melihat foto lebih jelas & perbesar"
                    >
                      <img
                        src={uploadedImage || ""}
                        alt="Foto Nota Terunggah"
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Top Left Badge: Original Verified Photo */}
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-[10px] font-black flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Foto Nota Terlampir</span>
                      </div>

                      {/* Hover Center Pill for Detail/Zoom */}
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="px-4 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 text-white text-xs font-bold shadow-2xl flex items-center gap-2 transform translate-y-1 group-hover:translate-y-0 transition-transform">
                          <Maximize2 className="w-4 h-4 text-emerald-400" />
                          <span>Klik untuk Perbesar & Detail</span>
                        </div>
                      </div>

                      {/* Animated Laser Scan Bar */}
                      {isScanningCustom && (
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-[0_0_15px_#10b981] animate-bounce top-0" />
                      )}

                      {/* Delete / Reset Button Top-Right */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResetCustomUpload()
                        }}
                        className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-slate-950/80 hover:bg-red-500 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer z-10 shadow-md"
                        title="Hapus / Ganti Foto Nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Friendly Bottom Toolbar */}
                    <div className="w-full pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <button
                        onClick={handleOpenLightbox}
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Foto Lebih Jelas</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-medium flex items-center gap-1 cursor-pointer transition-all"
                          title="Ambil foto ulang via kamera"
                        >
                          <Camera className="w-3 h-3 text-emerald-400" /> Kamera
                        </button>
                        <button
                          onClick={() => galleryInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-medium flex items-center gap-1 cursor-pointer transition-all"
                          title="Pilih foto dari galeri"
                        >
                          <ImageIcon className="w-3 h-3 text-teal-400" /> Galeri
                        </button>
                        <button
                          onClick={() => docInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-medium flex items-center gap-1 cursor-pointer transition-all"
                          title="Pilih file dokumen/PDF"
                        >
                          <FileText className="w-3 h-3 text-purple-400" /> Dokumen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Auto-Categorization Extraction Output */}
                <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Hasil Ekstraksi Otomatis
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Akurasi 99.8%
                      </span>
                    </div>

                    {/* Scanning In-Progress Feedback */}
                    {isScanningCustom ? (
                      <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
                        <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
                        <div className="space-y-1">
                          <strong className="block text-sm text-white font-bold">Sedang Membaca & Mengekstrak Nota...</strong>
                          <p className="text-xs text-emerald-400 font-medium">{scanProgressMessage}</p>
                        </div>
                      </div>
                    ) : scanError ? (
                      /* Error State with Retry */
                      <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-red-950/20 border border-red-500/30 rounded-2xl my-2">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                        <div className="space-y-1">
                          <strong className="block text-xs text-red-300 font-bold">Ekstraksi Nota Gagal</strong>
                          <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">{scanError}</p>
                        </div>
                        <button
                          onClick={() => handleScanUploadedFile()}
                          className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Coba Pindai Ulang</span>
                        </button>
                      </div>
                    ) : customParsedData ? (
                      /* Real Extracted Results from Upload */
                      <div className="space-y-2.5 pt-2">
                        {/* Merchant Store Card Header */}
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 flex justify-between items-center text-xs shadow-md">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                              <Store className="w-4 h-4" />
                            </div>
                            <div>
                              <strong className="block text-white text-sm font-black tracking-tight">{customParsedData.merchantName}</strong>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Tanggal Nota: <span className="text-emerald-400 font-mono font-bold">{customParsedData.date}</span></span>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-400/30 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" /> Selesai
                          </span>
                        </div>

                        {/* Item Rows with Smooth Scroll if Long */}
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {customParsedData.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex justify-between items-center text-xs transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-slate-100 font-bold">{item.name}</strong>
                                  {(item.quantity || 1) > 1 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">
                                      {item.quantity}x
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-md text-[9.5px] bg-slate-800 text-slate-300 border border-slate-700/80 font-medium">
                                    {item.category} {item.subCategory ? `• ${item.subCategory}` : ""}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono text-emerald-400 font-extrabold text-xs sm:text-sm shrink-0">
                                Rp {(item.price || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Pengeluaran Card */}
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-2 border-emerald-500/60 flex justify-between items-center text-xs font-black text-white shadow-lg shadow-emerald-500/10">
                          <span className="text-slate-300 uppercase tracking-wider text-[11px]">TOTAL PENGELUARAN</span>
                          <span className="text-emerald-400 font-mono text-base sm:text-lg">
                            Rp {customParsedData.totalAmount.toLocaleString("id-ID")}
                          </span>
                        </div>

                        {/* Quick Action CTA Row */}
                        <div className="pt-1 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => onEnterApp({ mode: "register", tier: "trial" })}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Gunakan di Dashboard Scota</span>
                          </button>
                          <button
                            onClick={() => setShowSourceModal(true)}
                            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Pindai foto nota lainnya"
                          >
                            <RefreshCw className="w-3 h-3 text-emerald-400" />
                            <span>Pindai Nota Lain</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Status Pembukuan:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Laporan & Rekapitulasi Terupdate
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. BUSINESS TYPES SECTION */}
      <section id="jenis-usaha" className="scroll-mt-24 py-16 sm:py-20 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Fleksibilitas Tanpa Batas</h2>
            <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Satu Aplikasi untuk Semua Sektor Usaha
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {businessTypes.map((b, idx) => {
              const Icon = b.icon
              return (
                <div
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center space-y-2 hover:border-emerald-500/50 transition-all group"
                >
                  <div className="w-10 h-10 mx-auto rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-white">{b.name}</strong>
                    <span className="text-[10px] text-slate-400">{b.desc}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 5. SPREADSHEET VS NOTA AI COMPARISON SECTION */}
      <section id="komparasi" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-900 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-extrabold uppercase tracking-wide">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              Tinggalkan Cara Lama yang Lambat & Rawan Rusak
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Kenapa Harus Beralih dari Spreadsheet Manual?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Menginput nota satu per satu di Excel atau Google Sheets bukan hanya melelahkan dan membuang waktu, tapi juga menyimpan risiko finansial yang merugikan bisnis Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* CARD 1: SPREADSHEET MANUAL (THE PROBLEM) */}
            <div className="bg-slate-900/60 border border-red-950/80 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <strong className="block text-sm sm:text-base font-black text-white">
                        Spreadsheet Manual (Excel / Google Sheets)
                      </strong>
                      <span className="text-[11px] text-red-400/90 font-bold">Rawan Human Error & Boros Waktu</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                    Cara Lama
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Problem 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Input Manual Menghabiskan Waktu</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Staf kasir atau akunting harus mengetik tanggal, nama toko, rincian barang, dan nominal satu per satu yang memakan 2–4 jam setiap minggunya.
                      </p>
                    </div>
                  </div>

                  {/* Problem 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Banyak Akses Rawan Terhapus & Rumus Rusak</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Ketika banyak staf kasir/admin memiliki link sheet bersama, cell dan formula rumus rawan tertimpa, terhapus, atau salah ketik tanpa disadari.
                      </p>
                    </div>
                  </div>

                  {/* Problem 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Nota Fisik Sering Hilang & Tulisan Pudar</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Struk kasir kertas thermal mudah pudar atau tercecer, menyulitkan proses audit dan verifikasi bukti fisik pengeluaran riil.
                      </p>
                    </div>
                  </div>

                  {/* Problem 4 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Selisih Kas Kecil & Human Error</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Salah memasukkan angka atau salah hitung diskon memicu selisih saldo kas (*petty cash*) yang sulit dilacak sumber kesalahannya.
                      </p>
                    </div>
                  </div>

                  {/* Problem 5 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Tanpa Sistem Persetujuan & Log Audit</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        Tidak ada alur approval resmi. Semua orang dapat mengedit atau mengubah angka pengeluaran tanpa jejak otorisasi dari Owner/Manager.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-red-400 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Risiko selisih kas & kebocoran dana operasional bisnis.</span>
              </div>
            </div>

            {/* CARD 2: NOTA AI SAAS (THE SOLUTION) */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden flex flex-col justify-between shadow-2xl shadow-emerald-500/10">
              {/* Subtle top glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <strong className="block text-sm sm:text-base font-black text-white">
                        Platform Scota
                      </strong>
                      <span className="text-[11px] text-emerald-400 font-bold">Otomatisasi 100% Cepat & Terproteksi</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 shadow-md">
                    Solusi Cerdas
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Solution 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-black">Sekali Foto Selesai dalam 1 Detik</strong>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Sistem cerdas otomatis membaca nama barang, harga, diskon, dan tanggal dari struk kasir, faktur belanja, hingga bon tulisan tangan secara instan.
                      </p>
                    </div>
                  </div>

                  {/* Solution 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-black">Database Cloud Aman & Role Terproteksi</strong>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Data tersimpan permanen di cloud. Kasir hanya dapat mengajukan nota, sedangkan Admin/Owner memverifikasi. Rumus tidak akan pernah rusak.
                      </p>
                    </div>
                  </div>

                  {/* Solution 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-black">Arsip Foto Nota Digital Tersimpan Selamanya</strong>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Setiap baris pembukuan otomatis terlampir foto nota fisik yang tajam. Aman dari risiko nota hilang, basah, atau tulisan pudar saat audit.
                      </p>
                    </div>
                  </div>

                  {/* Solution 4 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-black">Akurasi 99.8% & Pemetaan Kategori Otomatis</strong>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Mencegah salah ketik angka (*zero human error*) dan otomatis mengelompokkan biaya ke kategori operasional yang sesuai standar akuntansi.
                      </p>
                    </div>
                  </div>

                  {/* Solution 5 */}
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-black">Approval Bertingkat & Ekspor Laporan Resmi</strong>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                        Alur persetujuan pengeluaran dari HP + ekspor dokumen PDF dan Excel rapi siap cetak lengkap dengan Logo & Nama Resmi Usaha Anda.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-black flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Hemat hingga 95% Waktu Pembukuan
                </span>
                <button
                  onClick={() => onEnterApp({ mode: "register", tier: "trial" })}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Coba Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. BENTO GRID FEATURES */}
      <section id="fitur" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Fitur Unggulan</h2>
            <p className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Solusi Pembukuan Lengkap untuk Menghemat Waktu & Biaya
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Otomatiskan alur pencatatan nota, verifikasi bertingkat, dan laporan keuangan usaha Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento 1: Smart Visual Scanner */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Scan className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">Pemindaian Visual Berakurasi Tinggi</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                Teknologi pemindai cerdas yang secara instan mengenali nama barang, jumlah nominal, potongan diskon, dan pajak dari berbagai jenis nota belanja, struk kasir minimarket, hingga kuitansi fisik.
              </p>
            </div>

            {/* Bento 2: Self-Learning Memory */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Auto-Katalog & Self-Learning</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sistem semakin pintar setiap kali digunakan. Platform mengingat nama produk dan kategori yang pernah Anda verifikasi untuk mempercepat pemrosesan nota berikutnya.
              </p>
            </div>

            {/* Bento 3: Dual-Admin Approval */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Alur Persetujuan Bertingkat</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Karyawan mengunggah nota, Admin 1 memeriksa data barang, dan Admin 2 memberikan persetujuan final sebelum masuk ke laporan keuangan resmi.
              </p>
            </div>

            {/* Bento 4: PDF & Excel Official Statements */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">Ekspor Laporan Resmi Ber-Branding Usaha</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                Cetak laporan rekapitulasi keuangan bulanan dalam format PDF dan Excel berlogo dan ber-watermark nama toko atau perusahaan Anda sendiri untuk kebutuhan pajak dan audit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PRICING & SUBSCRIPTION PLANS */}
      <section id="harga" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Pilihan Paket Langganan</h2>
            <p className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Investasi Terjangkau untuk Pembukuan Rapi & Akurat
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Pilih paket sesuai volume nota bulanan usaha Anda. Aktivasi instan dengan kunci lisensi resmi.
            </p>

            {/* Cycle Toggle */}
            <div className="pt-4 flex justify-center">
              <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === "monthly" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === "yearly" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Tahunan
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 font-extrabold">
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
                  className={`relative rounded-3xl p-6 sm:p-8 border flex flex-col justify-between transition-all ${
                    isPro
                      ? "bg-slate-900 border-emerald-500 shadow-2xl shadow-emerald-950/60 ring-2 ring-emerald-500/40"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[10px] font-black uppercase px-4 py-0.5 rounded-full shadow-lg tracking-wider">
                      Paling Populer
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-black text-white">{plan.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-white">
                          Rp {price.toLocaleString("id-ID")}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          /{billingCycle === "yearly" ? "tahun" : "bulan"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-snug">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8 space-y-2">
                    <button
                      onClick={() => onEnterApp({ mode: "register", tier: "trial" })}
                      className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                        isPro
                          ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 active:scale-98"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 active:scale-98"
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Mulai Gratis 14 Hari</span>
                    </button>
                    <button
                      onClick={() => handleOrderWhatsApp(tierKey)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900/80 border border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Atau Tanya / Pesan via WhatsApp</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8. FAQ SECTION */}
      <section id="faq" className="scroll-mt-24 py-16 sm:py-24 border-b border-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider">FAQ</h2>
            <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pertanyaan yang Sering Diajukan
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left text-sm font-bold text-white flex justify-between items-center gap-4 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
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
      <footer className="py-12 bg-slate-950 text-slate-400 text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/scota-icon.png"
              alt="Scota"
              className="w-8 h-8 object-contain"
            />
            <div>
              <span className="font-bold text-white">Scota Platform</span>
              <p className="text-[11px] text-slate-500">
                © {new Date().getFullYear()} Scota Platform. Solusi pembukuan untuk semua jenis bisnis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => onEnterApp({ mode: "login" })} className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer">
              Buka Aplikasi / Masuk Dashboard
            </button>
          </div>
        </div>
      </footer>

      {/* iOS & Android Native-Feel Action Sheet Modal */}
      {showSourceModal && (
        <div 
          onClick={() => setShowSourceModal(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-[28px] sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            {/* Grabber Bar for Mobile */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Scan className="w-4 h-4 text-emerald-400" />
                  Pilih Sumber Foto Nota
                </h4>
                <p className="text-[11px] text-slate-400">Pilih metode pengambilan nota dari HP atau komputer</p>
              </div>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Source Action Options */}
            <div className="space-y-2">
              {/* Option 1: Kamera */}
              <button
                onClick={() => {
                  setShowSourceModal(false)
                  cameraInputRef.current?.click()
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                      Ambil Foto dengan Kamera
                    </strong>
                    <span className="text-[11px] text-slate-400">Buka kamera HP untuk memotret nota fisik langsung</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </button>

              {/* Option 2: Galeri Foto */}
              <button
                onClick={() => {
                  setShowSourceModal(false)
                  galleryInputRef.current?.click()
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                      Pilih dari Galeri Foto
                    </strong>
                    <span className="text-[11px] text-slate-400">Pilih foto struk belanja yang sudah tersimpan di album</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </button>

              {/* Option 3: Dokumen / PDF */}
              <button
                onClick={() => {
                  setShowSourceModal(false)
                  docInputRef.current?.click()
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <strong className="block text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                      Pilih Berkas Dokumen / PDF
                    </strong>
                    <span className="text-[11px] text-slate-400">Pilih berkas PDF atau gambar faktur dari file manager</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowSourceModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* High-Resolution Photo Detail & Zoom Lightbox Modal */}
      {showImageLightbox && uploadedImage && (
        <div
          onClick={() => setShowImageLightbox(false)}
          className="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200 select-none"
        >
          {/* Top Bar Header & Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="truncate">
                <h4 className="text-xs sm:text-sm font-black text-white truncate">
                  {customParsedData?.merchantName || "Detail Foto Nota Fisik"}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {uploadedFileName || "nota-terunggah.jpg"} {customParsedData ? `• Tanggal: ${customParsedData.date}` : ""}
                </p>
              </div>
            </div>

            {/* Zoom & Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Perkecil (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-mono font-bold text-emerald-400 px-2 min-w-[48px] text-center hidden sm:inline-block">
                {Math.round(lightboxZoom * 100)}%
              </span>

              <button
                onClick={handleZoomIn}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Perbesar (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={handleRotate}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Putar 90° (Rotate)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetZoom}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer hidden sm:flex"
                title="Reset Ukuran (100%)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-6 bg-slate-700 mx-1" />

              <button
                onClick={() => setShowImageLightbox(false)}
                className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all cursor-pointer"
                title="Tutup (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Image Viewport with Pan/Zoom Transform */}
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
                alt="Detail Foto Nota"
                className="max-h-[70vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-slate-700/50"
              />
            </div>
          </div>

          {/* Bottom Floating Info Summary Pill */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl mx-auto p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          >
            {customParsedData ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Hasil Scan:</span>
                <strong className="text-white font-bold">{customParsedData.merchantName}</strong>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-400 font-extrabold text-sm">
                  Rp {customParsedData.totalAmount.toLocaleString("id-ID")}
                </span>
                <span className="text-slate-400">({customParsedData.items.length} item)</span>
              </div>
            ) : (
              <span className="text-slate-400">Gunakan tombol perbesar atau putar untuk melihat detail tulisan pada struk.</span>
            )}

            <button
              onClick={() => setShowImageLightbox(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all cursor-pointer text-xs"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

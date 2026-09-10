"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import {
  X,
  QrCode,
  Building2,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Download,
} from "lucide-react"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { PakasirPaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/pakasir"

interface PakasirCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  tier: SubscriptionTier
  billingCycle: "monthly" | "yearly"
  onSuccess?: () => void
}

const VA_OPTIONS: { id: PakasirPaymentMethod; label: string; bank: string }[] = [
  { id: "bni_va", label: "BNI Virtual Account", bank: "BNI" },
  { id: "bri_va", label: "BRI Virtual Account", bank: "BRI" },
  { id: "cimb_niaga_va", label: "CIMB Niaga Virtual Account", bank: "CIMB Niaga" },
  { id: "permata_va", label: "Permata Virtual Account", bank: "Permata" },
  { id: "maybank_va", label: "Maybank Virtual Account", bank: "Maybank" },
  { id: "bnc_va", label: "Bank Neo Commerce (BNC)", bank: "BNC" },
]

export function PakasirCheckoutModal({
  isOpen,
  onClose,
  tier,
  billingCycle,
  onSuccess,
}: PakasirCheckoutModalProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<"qris" | "va" | "hosted">("qris")
  const [selectedVa, setSelectedVa] = useState<PakasirPaymentMethod>("bni_va")
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Payment active state
  const [orderData, setOrderData] = useState<{
    orderId: string
    invoiceNumber: string
    checkoutUrl?: string
    payment?: {
      amount: number
      fee: number
      total_payment: number
      payment_method: string
      payment_number: string
      expired_at: string
    }
  } | null>(null)

  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "completed">("idle")
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(900) // 15 minutes in seconds

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const plan = TIER_CONFIG[tier] || TIER_CONFIG.pro
  const basePrice = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
  const cycleLabel = billingCycle === "yearly" ? "Tahunan (12 Bulan)" : "Bulanan"

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOrderData(null)
      setPaymentStatus("idle")
      setErrorMessage(null)
      setIsLoading(false)
      setTimeLeft(900)
    }
  }, [isOpen, tier, billingCycle])

  // Render QR Code onto canvas when QR string arrives
  useEffect(() => {
    if (orderData?.payment?.payment_number && qrCanvasRef.current && selectedCategory === "qris") {
      QRCode.toCanvas(qrCanvasRef.current, orderData.payment.payment_number, {
        width: 220,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }).catch((err) => console.error("QR Code generate error:", err))
    }
  }, [orderData, selectedCategory])

  // Polling payment status every 3 seconds once order is active
  useEffect(() => {
    if (!orderData?.orderId || paymentStatus === "completed") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status?order_id=${encodeURIComponent(orderData.orderId)}`)
        const data = await res.json()
        if (data.status === "completed" || data.status === "lunas") {
          setPaymentStatus("completed")
          clearInterval(interval)
          if (onSuccess) onSuccess()
        }
      } catch (err) {
        console.warn("Status polling notice:", err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [orderData?.orderId, paymentStatus, onSuccess])

  // Countdown timer
  useEffect(() => {
    if (!orderData || paymentStatus === "completed" || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [orderData, paymentStatus, timeLeft])

  if (!isOpen) return null

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleDownloadQr = () => {
    if (!qrCanvasRef.current) return
    const link = document.createElement("a")
    link.download = `QRIS-${orderData?.orderId || "scota"}.png`
    link.href = qrCanvasRef.current.toDataURL("image/png")
    link.click()
  }

  const handleCreatePayment = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const paymentMethod: PakasirPaymentMethod | "url" = 
      selectedCategory === "hosted" 
        ? "url" 
        : selectedCategory === "qris" 
        ? "qris" 
        : selectedVa

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          billingCycle,
          paymentMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat tagihan pembayaran.")
      }

      if (selectedCategory === "hosted" && data.checkoutUrl) {
        // Redirect directly to Pakasir Hosted Payment page
        window.location.href = data.checkoutUrl
        return
      }

      setOrderData(data)
      setPaymentStatus("pending")
    } catch (err: any) {
      console.error("Payment create error:", err)
      setErrorMessage(err.message || "Gagal menghubungkan ke gateway pembayaran.")
    } finally {
      setIsLoading(false)
    }
  }

  const formatMinutes = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const totalAmount = orderData?.payment?.total_payment || basePrice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Pembayaran Langganan Scota
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Didukung oleh Payment Gateway Pakasir (Otomatis & Realtime)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Order Summary Card */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Paket Pilihan
              </span>
              <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {plan.name}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
                Siklus: <span className="font-semibold">{cycleLabel}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Tagihan
              </span>
              <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                Rp {totalAmount.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3.5 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* STATE 1: SELECTION */}
          {paymentStatus === "idle" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Pilih Metode Pembayaran
                </label>
                
                {/* Method Category Tabs */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("qris")}
                    className={`flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center leading-tight ${
                      selectedCategory === "qris"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <QrCode className="w-4 h-4 mb-1" />
                    <span>QRIS Instan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory("va")}
                    className={`flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center leading-tight ${
                      selectedCategory === "va"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Building2 className="w-4 h-4 mb-1" />
                    <span>Virtual Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory("hosted")}
                    className={`flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center leading-tight ${
                      selectedCategory === "hosted"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ExternalLink className="w-4 h-4 mb-1" />
                    <span>Web Pakasir</span>
                  </button>
                </div>
              </div>

              {/* Sub-options based on category */}
              {selectedCategory === "qris" && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                        QRIS Standar Bank Indonesia
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Dapat di-scan menggunakan GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin Mandiri, BRImo, dll.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCategory === "va" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Pilih Bank Tujuan Virtual Account:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VA_OPTIONS.map((va) => (
                      <button
                        key={va.id}
                        type="button"
                        onClick={() => setSelectedVa(va.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                          selectedVa === va.id
                            ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xs">{va.bank}</span>
                        {selectedVa === va.id && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCategory === "hosted" && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Anda akan dialihkan ke halaman web pembayaran resmi Pakasir. Setelah pembayaran berhasil, Anda otomatis dikembalikan ke Scota dengan paket yang telah aktif.
                </div>
              )}

              <button
                type="button"
                onClick={handleCreatePayment}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghubungkan ke Pakasir...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Bayar Sekarang (Rp {basePrice.toLocaleString("id-ID")})
                  </>
                )}
              </button>
            </div>
          )}

          {/* STATE 2: ACTIVE PAYMENT DISPLAY */}
          {paymentStatus === "pending" && orderData && (
            <div className="space-y-4">
              {/* Timer Bar */}
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                  Selesaikan Pembayaran Dalam:
                </div>
                <div className="font-mono font-black text-sm">
                  {formatMinutes(timeLeft)}
                </div>
              </div>

              {/* QRIS Display */}
              {selectedCategory === "qris" && (
                <div className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm mb-3">
                    <canvas ref={qrCanvasRef} className="rounded-lg" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs">
                    Scan kode QR di atas menggunakan aplikasi mobile banking atau e-wallet apa saja.
                  </p>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh QR
                    </button>
                    {orderData.payment?.payment_number && (
                      <button
                        type="button"
                        onClick={() => handleCopy(orderData.payment!.payment_number, "qr")}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
                      >
                        {copiedField === "qr" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedField === "qr" ? "Tersalin!" : "Salin String QR"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Virtual Account Display */}
              {selectedCategory === "va" && orderData.payment?.payment_number && (
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nomor Virtual Account ({orderData.payment.payment_method.toUpperCase()})
                    </span>
                    <div className="flex items-center justify-between mt-1 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-wider">
                        {orderData.payment.payment_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(orderData.payment!.payment_number, "va")}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                      >
                        {copiedField === "va" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Jumlah Transfer Persis
                    </span>
                    <div className="flex items-center justify-between mt-1 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                        Rp {orderData.payment.total_payment.toLocaleString("id-ID")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(orderData.payment!.total_payment.toString(), "amount")}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                      >
                        {copiedField === "amount" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Polling Indicator */}
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                Mendeteksi pembayaran secara otomatis...
              </div>
            </div>
          )}

          {/* STATE 3: COMPLETED SUCCESS SCREEN */}
          {paymentStatus === "completed" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-inner animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Pembayaran Berhasil Dikonfirmasi!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
                Terima kasih! Paket <span className="font-bold text-emerald-600 dark:text-emerald-400">{plan.name}</span> Anda sekarang telah aktif dengan seluruh kuota dan fitur lengkap.
              </p>

              <div className="pt-4 w-full">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    router.push("/dashboard")
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Buka Dashboard Scota
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            256-bit SSL Enkripsi Bank
          </div>
          <div>Transaksi Resmi & Otomatis</div>
        </div>
      </div>
    </div>
  )
}

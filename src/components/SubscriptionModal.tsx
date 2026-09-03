"use client"

import React, { useState } from "react"
import {
  X,
  Sparkles,
  CheckCircle2,
  Key,
  Building2,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  MessageCircle,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  SubscriptionInfo,
  SubscriptionTier,
  TIER_CONFIG,
} from "@/lib/subscription"

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: SubscriptionInfo | null
  onSubscriptionUpdated: (updated: SubscriptionInfo) => void
}

export function SubscriptionModal({
  isOpen,
  onClose,
  subscription,
  onSubscriptionUpdated,
}: SubscriptionModalProps) {
  const [activeTab, setActiveTab] = useState<"plans" | "license" | "profile">("plans")
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [licenseInput, setLicenseInput] = useState("")
  const [isActivating, setIsActivating] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Studio Profile Form State
  const [studioName, setStudioName] = useState(subscription?.studioProfile?.studioName || "Scota Business")
  const [tagline, setTagline] = useState(subscription?.studioProfile?.tagline || "Creative Photography & Digital Imaging")
  const [address, setAddress] = useState(subscription?.studioProfile?.address || "")
  const [phone, setPhone] = useState(subscription?.studioProfile?.phone || "")
  const [invoiceFooter, setInvoiceFooter] = useState(
    subscription?.studioProfile?.invoiceFooter || "Terima kasih atas kerja sama Anda dengan Studio Foto kami."
  )

  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<SubscriptionTier | null>(null)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)
  const [copiedVa, setCopiedVa] = useState(false)

  if (!isOpen) return null

  const currentTier = subscription?.tier || "trial"
  const currentExpiry = subscription?.validUntil ? new Date(subscription.validUntil) : new Date()
  const daysRemaining = Math.max(0, Math.ceil((currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  const handleSimulatePaymentSuccess = async (tier: SubscriptionTier) => {
    setIsSimulatingPayment(true)
    try {
      // Direct license upgrade call
      const durationDays = billingCycle === "yearly" ? 365 : 30
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + durationDays)
      
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_license",
          licenseKey: `NP-${tier.toUpperCase()}-${durationDays}D-AUTO-SIMULATION`,
        }),
      })

      const data = await res.json()
      toast.success(`Pembayaran Berhasil! Paket Anda aktif sebagai ${TIER_CONFIG[tier].name}.`)
      setSelectedCheckoutPlan(null)
      if (data.sub) {
        onSubscriptionUpdated(data.sub)
      } else {
        onSubscriptionUpdated({
          tier,
          status: "active",
          validUntil: expiry.toISOString(),
          monthlyScanLimit: TIER_CONFIG[tier].monthlyScanLimit,
          usedScansThisMonth: 0,
          studioProfile: subscription?.studioProfile || {
            studioName,
            tagline,
            address,
            phone,
            invoiceFooter,
          },
        })
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses upgrade")
    } finally {
      setIsSimulatingPayment(false)
    }
  }

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseInput.trim()) {
      toast.error("Masukkan kode lisensi atau voucher Anda")
      return
    }

    setIsActivating(true)
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_license",
          licenseKey: licenseInput.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengaktifkan lisensi")
      }

      toast.success(data.message || "Lisensi berhasil diaktifkan!")
      setLicenseInput("")
      if (data.sub) {
        onSubscriptionUpdated(data.sub)
      }
    } catch (err: any) {
      toast.error(err.message || "Kode lisensi tidak valid")
    } finally {
      setIsActivating(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studioName.trim()) {
      toast.error("Nama Studio wajib diisi")
      return
    }

    setIsSavingProfile(true)
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          studioProfile: {
            studioName: studioName.trim(),
            tagline: tagline.trim(),
            address: address.trim(),
            phone: phone.trim(),
            invoiceFooter: invoiceFooter.trim(),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyimpan profil")
      }

      toast.success("Profil Studio Foto berhasil disimpan!")
      if (subscription) {
        onSubscriptionUpdated({
          ...subscription,
          studioProfile: data.studioProfile,
        })
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan profil")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleOrderPlan = (tierKey: SubscriptionTier) => {
    const plan = TIER_CONFIG[tierKey]
    const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
    const cycleText = billingCycle === "yearly" ? "Tahunan (Hemat 2 Bulan)" : "Bulanan"
    const message = encodeURIComponent(
      `Halo Tim Scota, saya ingin berlangganan paket *${plan.name}* (${cycleText}) seharga Rp ${price.toLocaleString("id-ID")} untuk Usaha kami (${studioName}). Mohon info rekening / QRIS pembayaran.`
    )
    window.open(`https://wa.me/6281234567890?text=${message}`, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-sm">
              NP
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Langganan & Profil Bisnis
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  {TIER_CONFIG[currentTier]?.name || "Active Plan"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Masa aktif: {daysRemaining} hari lagi ({currentExpiry.toLocaleDateString("id-ID", { dateStyle: "medium" })})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/50">
          <button
            onClick={() => setActiveTab("plans")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "plans"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            Pilihan Paket
          </button>
          <button
            onClick={() => setActiveTab("license")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "license"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Key className="w-4 h-4" />
            Aktivasi Lisensi
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "profile"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Profil Usaha / Bisnis
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {activeTab === "plans" && (
            <div className="space-y-6">
              {/* Billing Cycle Switch */}
              <div className="flex justify-center">
                <div className="inline-flex items-center p-1 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      billingCycle === "monthly"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      billingCycle === "yearly"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Tahunan
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 font-extrabold">
                      Hemat 17%
                    </span>
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
                  const plan = TIER_CONFIG[tierKey]
                  const isCurrent = currentTier === tierKey
                  const isPro = tierKey === "pro"
                  const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly

                  return (
                    <div
                      key={tierKey}
                      className={`relative rounded-3xl p-5 border flex flex-col justify-between transition-all ${
                        isPro
                          ? "bg-slate-800/80 border-emerald-500 shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {isPro && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-md tracking-wider">
                          Paling Populer Studio
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-black text-white">{plan.name}</h3>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-white">
                              Rp {price.toLocaleString("id-ID")}
                            </span>
                            <span className="text-xs text-slate-400">
                              /{billingCycle === "yearly" ? "tahun" : "bulan"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          {plan.features.map((feat, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-6 space-y-2">
                        <button
                          onClick={() => setSelectedCheckoutPlan(tierKey)}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isCurrent
                              ? "bg-slate-700 text-slate-300 cursor-default"
                              : isPro
                              ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20 active:scale-98"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {isCurrent ? "Paket Anda Saat Ini" : "Bayar Instan QRIS / VA"}
                        </button>

                        {!isCurrent && (
                          <button
                            onClick={() => handleOrderPlan(tierKey)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Pesan via WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Interactive Checkout Modal Overlay if Selected */}
              {selectedCheckoutPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl text-slate-100 relative">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-sm font-black text-white block">Checkout {TIER_CONFIG[selectedCheckoutPlan].name}</strong>
                          <span className="text-[11px] text-slate-400">Total: Rp {(billingCycle === "yearly" ? TIER_CONFIG[selectedCheckoutPlan].priceYearly : TIER_CONFIG[selectedCheckoutPlan].priceMonthly).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedCheckoutPlan(null)} className="text-slate-400 hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* QRIS Display Box */}
                    <div className="bg-white rounded-2xl p-4 text-center space-y-2 text-slate-950 shadow-inner">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-black text-xs tracking-wider">QRIS STANDAR PEMBAYARAN</span>
                        <span className="text-[10px] font-bold text-slate-500">NMID: ID102026889912</span>
                      </div>

                      {/* Mock QR Code Pattern */}
                      <div className="w-44 h-44 mx-auto bg-slate-950 rounded-xl p-2.5 flex items-center justify-center">
                        <div className="w-full h-full bg-white rounded-lg p-2 grid grid-cols-6 gap-1">
                          {Array.from({ length: 36 }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`rounded-xs ${
                                idx % 2 === 0 || idx % 5 === 0 ? "bg-slate-950" : "bg-transparent"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 font-semibold">
                        Scan menggunakan BCA Mobile, GoPay, OVO, Dana, ShopeePay
                      </div>
                    </div>

                    {/* Virtual Account Options */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>BCA Virtual Account:</span>
                        <strong className="text-emerald-400 font-mono select-all">8801 2938 4819 029</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Mandiri Virtual Account:</span>
                        <strong className="text-teal-400 font-mono select-all">8910 8827 1029 384</strong>
                      </div>
                    </div>

                    {/* Auto Simulator Confirmation Button */}
                    <button
                      type="button"
                      disabled={isSimulatingPayment}
                      onClick={() => handleSimulatePaymentSuccess(selectedCheckoutPlan)}
                      className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSimulatingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi Pembayaran...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Simulasi Konfirmasi Pembayaran Berhasil</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Guarantees / Security note */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Pembayaran resmi via Transfer Bank / QRIS otomatis dengan aktivasi instan 24/7.
                </span>
              </div>
            </div>
          )}

          {activeTab === "license" && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Aktivasi Kunci Lisensi</h3>
                <p className="text-xs text-slate-400">
                  Masukkan kode lisensi atau voucher yang Anda dapatkan setelah melakukan pembayaran berlangganan.
                </p>
              </div>

              <form onSubmit={handleActivateLicense} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Kode Lisensi / Voucher</label>
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    placeholder="Contoh: NP-PRO-30D-XXXX-XXXX"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl px-4 py-3 text-sm font-mono text-emerald-400 uppercase tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isActivating || !licenseInput.trim()}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengaktifkan Lisensi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Aktifkan Sekarang</span>
                    </>
                  )}
                </button>
              </form>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2 text-xs text-slate-400">
                <h4 className="font-bold text-slate-200">Belum memiliki kunci lisensi?</h4>
                <p>
                  Pilih paket di tab <strong>Pilihan Paket</strong> atau hubungi tim billing untuk mendapatkan kode aktivasi resmi studio Anda.
                </p>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="max-w-2xl mx-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Nama Usaha / Toko / Perusahaan <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Contoh: PT Sumber Rezeki / Toko Maju Jaya"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                  <p className="text-[11px] text-slate-400">Nama ini akan dicetak di header resmi laporan PDF & Excel.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Slogan / Tagline Usaha</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Digitalisasi Struk & Pengeluaran"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" /> No. Telepon / WhatsApp Usaha
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Alamat Lengkap Kantor / Toko
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Alamat kantor, toko, atau cabang usaha..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Catatan Footer Laporan PDF
                  </label>
                  <textarea
                    rows={2}
                    value={invoiceFooter}
                    onChange={(e) => setInvoiceFooter(e.target.value)}
                    placeholder="Catatan resmi di bagian bawah dokumen laporan..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none resize-none"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Profil...</span>
                    </>
                  ) : (
                    <span>Simpan Profil Studio</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

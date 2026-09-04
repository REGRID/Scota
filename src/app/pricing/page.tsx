"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Check,
  Zap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import { getSupportWhatsAppNumber } from "@/lib/contactConfig"

const TIER_DESCRIPTIONS: Record<SubscriptionTier, string> = {
  trial: "Coba seluruh fitur unggulan Scota tanpa biaya selama 14 hari.",
  starter: "Solusi efisien untuk UMKM, toko kelontong, dan usaha rintisan.",
  pro: "Pilihan terbaik untuk kafe, resto, retail, dan bisnis berkembang.",
  enterprise: "Kapasitas penuh multi-cabang dengan integrasi kustom.",
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const handleOrderWhatsApp = (tierKey: SubscriptionTier) => {
    const plan = TIER_CONFIG[tierKey]
    const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
    const cycleText = billingCycle === "yearly" ? "Tahunan (Hemat 17%)" : "Bulanan"
    const message = encodeURIComponent(
      `Halo Tim Scota, saya ingin berlangganan paket *${plan.name}* (${cycleText}) seharga Rp ${price.toLocaleString(
        "id-ID"
      )}. Mohon info prosedur aktivasi lisensi untuk usaha kami.`
    )
    const phone = getSupportWhatsAppNumber()
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank")
  }

  const faqs = [
    {
      q: "Apakah ada biaya tersembunyi atau komitmen kontrak?",
      a: "Tidak ada sama sekali. Anda hanya membayar biaya langganan sesuai paket yang dipilih (bulanan atau tahunan). Anda bebas membatalkan atau beralih paket kapan saja.",
    },
    {
      q: "Bagaimana cara kerja Uji Coba Gratis 14 Hari?",
      a: "Begitu mendaftar akun baru, Anda langsung mendapatkan kuota gratis dan akses ke fitur Scan Nota AI tanpa perlu memasukkan kartu kredit ataupun deposit.",
    },
    {
      q: "Bagaimana jika kuota scan nota bulanan saya habis?",
      a: "Anda dapat melakukan upgrade ke paket yang lebih tinggi kapan saja melalui WhatsApp CS kami atau menunggu reset kuota pada siklus bulan berikutnya.",
    },
    {
      q: "Apakah data nota dan transaksi bisnis saya aman?",
      a: "Sangat aman. Seluruh data dienkripsi dengan standar industri SSL/TLS dan disimpan dalam database terproteksi Row-Level Security.",
    },
    {
      q: "Apakah laporan ekspor bisa memakai Nama & Logo Bisnis saya sendiri?",
      a: "Pasti! Anda bebas mengatur Nama Usaha, Logo, Alamat, dan Catatan Resmi di profil bisnis. Setiap ekspor dokumen PDF dan Excel akan otomatis menggunakan branding usaha Anda.",
    },
  ]

  const comparisonFeatures = [
    { name: "Batas Scan Nota Bulanan", trial: "30 Nota/bln", starter: "150 Nota/bln", pro: "500 Nota/bln", enterprise: "Tanpa Batas" },
    { name: "Kecepatan AI Vision OCR", trial: "Standar", starter: "Prioritas Cepat", pro: "Prioritas Turbo", enterprise: "Ultra Fast Dedicated" },
    { name: "Ekspor Excel & CSV", trial: true, starter: true, pro: true, enterprise: true },
    { name: "Ekspor Dokumen Laporan PDF", trial: false, starter: true, pro: true, enterprise: true },
    { name: "Dual-Control Approval (Otorisasi 2 Admin)", trial: false, starter: false, pro: true, enterprise: true },
    { name: "Kustomisasi Logo & Kop Surat", trial: false, starter: true, pro: true, enterprise: true },
    { name: "Integrasi POS / Cloud Sync", trial: false, starter: false, pro: true, enterprise: true },
    { name: "Multi-Admin & Akses Karyawan", trial: "1 Akun", starter: "2 Akun", pro: "Hingga 5 Akun", enterprise: "Multi-Cabang Unlimited" },
    { name: "Dukungan CS & Bantuan Teknis", trial: "Forum Bantuan", starter: "Email & Chat", pro: "WhatsApp Priority", enterprise: "Dedicated Account Manager" },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/scota-logo-dark.png" alt="Scota" className="h-8 sm:h-9 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Beranda</span>
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <span>Daftar Gratis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-extrabold tracking-wide uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            Transparan & Fleksibel Tanpa Biaya Tersembunyi
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Pilih Paket yang Sesuai dengan Skala Usaha Anda
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Mulai dari uji coba gratis hingga operasional multi-cabang tanpa batas. Otomatisasi pembukuan bisnis Anda hari ini.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="pt-4 flex items-center justify-center">
            <div className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Bayar Bulanan
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === "yearly"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Bayar Tahunan</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black">
                  Hemat 17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {(["trial", "starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
            const plan = TIER_CONFIG[tierKey]
            const isPopular = tierKey === "pro"
            const isFree = tierKey === "trial"
            const price = isFree ? 0 : billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly

            return (
              <div
                key={tierKey}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 border transition-all ${
                  isPopular
                    ? "bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/20 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-emerald-500 text-slate-950 font-black text-[11px] rounded-full uppercase tracking-wider shadow-md">
                    Paling Populer
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{TIER_DESCRIPTIONS[tierKey]}</p>
                  </div>

                  <div className="pt-2 pb-4 border-b border-slate-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-400">Rp</span>
                      <span className="text-3xl sm:text-4xl font-black text-white">
                        {price.toLocaleString("id-ID")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {isFree ? "/14 hari" : billingCycle === "yearly" ? "/thn" : "/bln"}
                      </span>
                    </div>
                    {billingCycle === "yearly" && !isFree && (
                      <p className="text-[11px] text-emerald-400 font-bold mt-1">
                        Rp {Math.round(price / 12).toLocaleString("id-ID")} / bulan
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Fitur Termasuk:
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  {isFree ? (
                    <Link
                      href="/register"
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mulai Gratis</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOrderWhatsApp(tierKey)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        isPopular
                          ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/20"
                          : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Pesan via WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 overflow-hidden">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-black text-white">Tabel Komparasi Fitur Detail</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Perbandingan lengkap kemampuan teknis tiap paket langganan Scota.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold">Fitur Platform</th>
                  <th className="py-3 px-4 font-bold text-center">Trial (14 Hari)</th>
                  <th className="py-3 px-4 font-bold text-center">Starter</th>
                  <th className="py-3 px-4 font-bold text-center text-emerald-400">Pro (Bisnis)</th>
                  <th className="py-3 px-4 font-bold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {comparisonFeatures.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{item.name}</td>
                    <td className="py-3.5 px-4 text-center">
                      {typeof item.trial === "boolean" ? (
                        item.trial ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>
                      ) : (
                        <span className="text-slate-300 font-medium">{item.trial}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {typeof item.starter === "boolean" ? (
                        item.starter ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>
                      ) : (
                        <span className="text-slate-300 font-medium">{item.starter}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center bg-emerald-500/5">
                      {typeof item.pro === "boolean" ? (
                        item.pro ? <Check className="w-4 h-4 text-emerald-400 mx-auto font-bold" /> : <span className="text-slate-600">-</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">{item.pro}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {typeof item.enterprise === "boolean" ? (
                        item.enterprise ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>
                      ) : (
                        <span className="text-slate-300 font-medium">{item.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Pertanyaan Sering Diajukan (FAQ)</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Segala hal yang perlu Anda ketahui seputar sistem aktivasi dan langganan Scota.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-r from-emerald-900/40 via-slate-900 to-teal-900/30 border border-emerald-500/30 text-center space-y-4 shadow-2xl">
          <h3 className="text-2xl sm:text-3xl font-black text-white">
            Siap Menghemat Waktu Pembukuan Bisnis Anda?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Daftar sekarang untuk aktivasi instan atau hubungi tim konsultan kami jika memiliki kebutuhan sistem khusus.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/25"
            >
              <Zap className="w-4 h-4" />
              <span>Daftar Akun Gratis</span>
            </Link>
            <button
              type="button"
              onClick={() => handleOrderWhatsApp("pro")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Konsultasi via WhatsApp</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-slate-950 text-slate-400 text-xs border-t border-slate-900 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/scota-icon.png" alt="Scota" className="w-7 h-7 object-contain" />
            <div>
              <span className="font-bold text-white text-xs">Scota Platform</span>
              <p className="text-[10.5px] text-slate-500">
                © {new Date().getFullYear()} Scota Platform. Solusi otomatisasi pembukuan bisnis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-xs">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              Beranda
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
            <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
              Buka Dashboard →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

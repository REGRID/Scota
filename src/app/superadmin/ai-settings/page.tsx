"use client"

import { useState, useEffect } from "react"
import {
  Sparkles,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Sliders,
  Check,
  Activity,
  Server,
  Phone,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import { getSupportWhatsAppNumber, setSupportWhatsAppNumber } from "@/lib/contactConfig"

export default function SuperadminAiSettingsPage() {
  const [apiKey, setApiKey] = useState("")
  const [maskedKeyPlaceholder, setMaskedKeyPlaceholder] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [temperature, setTemperature] = useState("0.1")
  const [autoLearnEnabled, setAutoLearnEnabled] = useState(true)
  const [supportWhatsApp, setSupportWhatsApp] = useState("6285215973776")
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latencyMs?: number } | null>(null)

  // Load configuration from server on mount
  useEffect(() => {
    async function loadServerAiSettings() {
      try {
        const res = await fetch("/api/superadmin/ai-settings")
        if (res.ok) {
          const data = await res.json()
          if (data.settings?.apiKeyMasked) {
            setMaskedKeyPlaceholder(data.settings.apiKeyMasked)
          }
        }
      } catch (err) {
        console.warn("Gagal memuat pengaturan AI server:", err)
      }
    }
    loadServerAiSettings()

    if (typeof window !== "undefined") {
      setSupportWhatsApp(getSupportWhatsAppNumber())
    }
  }, [])

  // Live Ping Test to Gemini API (via Secure Server Proxy)
  const handleTestConnection = async () => {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "")
    if (!cleanKey && !maskedKeyPlaceholder) {
      toast.error("Masukkan Google Gemini API Key terlebih dahulu untuk menguji koneksi.")
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await fetch("/api/superadmin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          apiKey: cleanKey || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Koneksi gagal (HTTP ${res.status})`)
      }

      setTestResult({
        success: true,
        message: data.message,
        latencyMs: data.latencyMs,
      })
      toast.success(`Tes koneksi Google Gemini berhasil (${data.latencyMs}ms)!`)
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal menghubungi server Google Gemini.",
      })
      toast.error(err.message || "Uji koneksi gagal.")
    } finally {
      setIsTesting(false)
    }
  }

  // Save Settings to Database
  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const payload: { apiKey?: string } = {}
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim()
      }

      const res = await fetch("/api/superadmin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Gagal menyimpan konfigurasi ke server.")
      }

      const data = await res.json()
      if (data.settings?.apiKeyMasked) {
        setMaskedKeyPlaceholder(data.settings.apiKeyMasked)
        setApiKey("") // Kosongkan input setelah tersimpan demi keamanan
      }

      if (supportWhatsApp) {
        setSupportWhatsAppNumber(supportWhatsApp)
      }
      toast.success("Konfigurasi Master AI & WhatsApp berhasil disimpan ke database server!")
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan konfigurasi.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
              Superadmin Control
            </span>
            <span className="text-xs text-slate-400">• Engine AI Master</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Integrasi Google Gemini AI & OCR
          </h1>
          <p className="text-xs text-slate-400">
            Pusat konfigurasi kunci API kecerdasan buatan, model visi nota, dan kebijakan OCR untuk seluruh tenant Scota.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
        >
          <Check className="w-4 h-4" />
          <span>Simpan Konfigurasi Master</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: API Key & Model Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Master API Key */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">Google Gemini Master API Key</h2>
                  <p className="text-[11px] text-slate-400">
                    Kunci sentral yang digunakan seluruh tenant saat memproses pemindaian nota belanja.
                  </p>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  apiKey.length >= 15 || maskedKeyPlaceholder
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                }`}
              >
                {apiKey.length >= 15 || maskedKeyPlaceholder ? "Kunci Aktif di Database" : "Belum Diisi"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">API Key</label>
                {maskedKeyPlaceholder && !apiKey && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tersimpan: {maskedKeyPlaceholder}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={maskedKeyPlaceholder ? `Tersimpan: ${maskedKeyPlaceholder} (ketik baru untuk mengganti)` : "AIzaSy..."}
                  className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 font-bold hover:underline"
                >
                  <span>Buka Google AI Studio untuk Mendapatkan API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
                    <span>{isTesting ? "Menguji Koneksi..." : "Uji Koneksi API"}</span>
                  </button>
                </div>
              </div>

              {/* Test Result Alert */}
              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.latencyMs && (
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Automated AI Vision Engine */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-white">Mesin AI Vision & Ekstraksi OCR</h2>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Terotomatisasi Penuh
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Arsitektur model AI Vision dikelola langsung oleh server tanpa perlu konfigurasi manual.
                  </p>
                </div>
              </div>
            </div>

            {/* Engine Details Banner */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Arsitektur Aktif:</span>
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    Google Gemini Flash (Auto-Resolving)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  <span>Google AI Studio API v1beta</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Sistem secara cerdas menghubungkan proses OCR ke model Flash paling mutakhir dari Google. Seluruh pemindaian struk belanja, nama toko, tanggal transaksi, subtotal, dan rincian item barang diproses dengan latensi sub-2 detik tanpa risiko kendala versi model kedaluwarsa.
              </p>

              {/* Engine Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                  <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 mt-0.5">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Latensi Super Cepat</div>
                    <div className="text-[10px] text-slate-400">Rata-rata 1.2 - 1.8 detik per foto nota</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                  <div className="p-1 rounded bg-blue-500/10 text-blue-400 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Bebas Error 404</div>
                    <div className="text-[10px] text-slate-400">Auto-fallback ke endpoint aktif Google</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                  <div className="p-1 rounded bg-purple-500/10 text-purple-400 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Multimodal Vision</div>
                    <div className="text-[10px] text-slate-400">Akurasi tinggi teks buram & miring</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Platform AI Policies & Self-Learning */}
        <div className="space-y-6">
          {/* Card 3: Self-Learning Memory Engine */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Self-Learning Memory Engine</h3>
                <p className="text-[10px] text-slate-400">Kamus Cerdas Toko & Produk</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Saat pengguna mengoreksi nama merchant atau kategori barang, sistem otomatis menyimpan memori tersebut ke database PostgreSQL sehingga nota serupa di masa depan langsung terkategori dengan benar.
            </p>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-200">Aktivasi Mesin Pembelajaran</span>
              <input
                type="checkbox"
                checked={autoLearnEnabled}
                onChange={(e) => setAutoLearnEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
          </div>

          {/* Card 4: Centralized Architecture Policy */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Kebijakan Kunci API Platform</h3>
                <p className="text-[10px] text-slate-400">Master Sentral Terisolasi (Anti-BYOK)</p>
              </div>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Mode Sentral Eksklusif Superadmin</span>
                  <span className="text-[10px] font-black text-emerald-400">AKTIF</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Fitur bawa API key sendiri (BYOK) bagi pengguna biasa telah dinonaktifkan demi keamanan. Seluruh tenant, kasir, dan demo Google otomatis menggunakan Master API Key ini yang dikontrol penuh oleh Superadmin di database.
                </p>
              </div>
            </div>
          </div>

          {/* Card 5: WhatsApp Sales & Support Hotline */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Nomor WhatsApp Sales / CS</h3>
                <p className="text-[10px] text-slate-400">Tautan Pemesanan & Bantuan Pelanggan</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Nomor ini digunakan secara dinamis untuk seluruh tombol pemesanan paket langganan WhatsApp di Landing Page dan Modal Upgrade.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-300">Nomor WhatsApp (format: 628...):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={supportWhatsApp}
                  onChange={(e) => setSupportWhatsApp(e.target.value)}
                  placeholder="6285215973776"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = supportWhatsApp.replace(/[^\d]/g, "")
                    window.open(`https://wa.me/${clean}?text=Halo%20Admin%20Scota`, "_blank")
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition-all cursor-pointer shrink-0"
                  title="Test Buka WhatsApp"
                >
                  Tes WA
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

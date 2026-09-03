"use client"

import React, { useState, useEffect } from "react"
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
  Server
} from "lucide-react"
import { toast } from "sonner"

export default function SuperadminAiSettingsPage() {
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [aiModel, setAiModel] = useState("gemini-2.5-flash")
  const [temperature, setTemperature] = useState("0.1")
  const [autoLearnEnabled, setAutoLearnEnabled] = useState(true)
  const [tenantCustomKeyAllowed, setTenantCustomKeyAllowed] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latencyMs?: number } | null>(null)

  // Load configuration on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key") || ""
      setApiKey(savedKey)

      const savedModel = localStorage.getItem("scota_ai_model")
      if (savedModel) setAiModel(savedModel)

      const savedAutoLearn = localStorage.getItem("scota_ai_autolearn")
      if (savedAutoLearn !== null) setAutoLearnEnabled(savedAutoLearn === "true")

      const savedCustomKeyAllowed = localStorage.getItem("scota_ai_tenant_custom_allowed")
      if (savedCustomKeyAllowed !== null) setTenantCustomKeyAllowed(savedCustomKeyAllowed === "true")
    }
  }, [])

  // Live Ping Test to Gemini API
  const handleTestConnection = async () => {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "")
    if (!cleanKey) {
      toast.error("Masukkan Google Gemini API Key terlebih dahulu sebelum menguji koneksi.")
      return
    }

    setIsTesting(true)
    setTestResult(null)
    const startTime = Date.now()

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${cleanKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Ping test: balas satu kata 'OK'." }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
        }),
      })

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errText = await res.text()
        if (errText.includes("API_KEY_INVALID") || res.status === 400) {
          throw new Error("API Key tidak valid atau dinonaktifkan oleh Google.")
        }
        if (res.status === 429) {
          throw new Error("Kuota API Google Cloud terlampaui (Rate Limit / Quota Exceeded).")
        }
        throw new Error(`Koneksi gagal (HTTP ${res.status}): ${errText.slice(0, 100)}`)
      }

      const data = await res.json()
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK"

      setTestResult({
        success: true,
        message: `Koneksi Berhasil! Model ${aiModel} merespons: "${reply}"`,
        latencyMs,
      })
      toast.success(`Tes koneksi Google Gemini berhasil (${latencyMs}ms)!`)
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

  // Save Settings
  const handleSaveSettings = () => {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "")
    localStorage.setItem("gemini_api_key", cleanKey)
    localStorage.setItem("scota_ai_model", aiModel)
    localStorage.setItem("scota_ai_autolearn", String(autoLearnEnabled))
    localStorage.setItem("scota_ai_tenant_custom_allowed", String(tenantCustomKeyAllowed))

    toast.success("Konfigurasi Master AI & OCR Platform berhasil disimpan!")
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
                  apiKey.length >= 15
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                }`}
              >
                {apiKey.length >= 15 ? "Kunci Terkonfigurasi" : "Belum Diisi"}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
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

          {/* Card 2: Model & Performance Tuning */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">Model AI Vision & Ekstraksi OCR</h2>
                <p className="text-[11px] text-slate-400">
                  Pilih arsitektur model AI untuk membaca detail struk, toko, subtotal, dan barang.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setAiModel("gemini-2.5-flash")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  aiModel === "gemini-2.5-flash"
                    ? "border-emerald-500 bg-emerald-500/10 text-white font-bold"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-emerald-400">Gemini 2.5 Flash</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                    Rekomendasi
                  </span>
                </div>
                <p className="text-[11px] font-normal leading-relaxed text-slate-300">
                  Model generasi terbaru: latensi super cepat (~1.2 detik), sangat hemat token, dan akurat membaca nota kusut.
                </p>
              </div>

              <div
                onClick={() => setAiModel("gemini-1.5-pro")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  aiModel === "gemini-1.5-pro"
                    ? "border-emerald-500 bg-emerald-500/10 text-white font-bold"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-blue-400">Gemini 1.5 Pro</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 uppercase">
                    Heavy Workload
                  </span>
                </div>
                <p className="text-[11px] font-normal leading-relaxed text-slate-300">
                  Kapasitas penalaran tertinggi untuk faktur pajak panjang atau multi-halaman berukuran besar.
                </p>
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
              Saat pengguna mengoreksi nama merchant atau kategori barang, sistem otomatis menyimpan memori tersebut ke database Postgres Supabase sehingga nota serupa di masa depan langsung terkategori dengan benar.
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

          {/* Card 4: Tenant Isolation Policy */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Kebijakan Kunci API Tenant</h3>
                <p className="text-[10px] text-slate-400">Sentralisasi vs BYOK</p>
              </div>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Mode Sentral (Rekomendasi SaaS)</span>
                  <span className="text-[10px] font-black text-emerald-400">AKTIF</span>
                </div>
                <p className="text-slate-400">
                  Seluruh tenant menggunakan Master API Key Superadmin. Tenant tidak dibebani teknis API dan admin platform dapat mengontrol kuota langganan secara terpusat.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

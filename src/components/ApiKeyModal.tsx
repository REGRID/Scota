"use client"

import React, { useState, useEffect } from "react"
import { KeyRound, X, ExternalLink, Check, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (key: string) => void
}

export function ApiKeyModal({ isOpen, onClose, onSaved }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gemini_api_key") || ""
      setApiKey(stored)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "")
    if (!cleanKey) {
      toast.error("Kunci API tidak boleh kosong.")
      return
    }

    if (cleanKey.length < 15) {
      toast.error("Format kunci API terlalu pendek. Pastikan menyalin seluruh kunci API dari Google AI Studio.")
      return
    }

    localStorage.setItem("gemini_api_key", cleanKey)
    setSavedSuccess(true)
    toast.success("Kunci Google Gemini API berhasil disimpan!")

    if (onSaved) {
      onSaved(cleanKey)
    }

    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 900)
  }

  const handleClear = () => {
    localStorage.removeItem("gemini_api_key")
    setApiKey("")
    toast.info("Kunci API telah dihapus dari browser.")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-2xs">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Google Gemini API Key
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Diperlukan untuk memindai & membaca nota belanja
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Sistem membutuhkan <strong>Gemini API Key</strong> untuk melakukan OCR & ekstraksi cerdas item nota.
            </span>
          </div>
          <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              <span>Dapatkan API Key Gratis di Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Input Form */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Masukkan API Key (AIzaSy...)
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Contoh: AIzaSyD..."
              className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Kunci ini disimpan secara lokal di browser Anda dan juga dapat dikonfigurasi permanen di file <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono">.env.local</code> (variabel: <code className="font-mono">GEMINI_API_KEY</code>).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {apiKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold hover:underline cursor-pointer"
            >
              Hapus Kunci
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Simpan Kunci</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect } from "react"
import {
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Clock,
  CheckCircle2,
  RotateCw,
  RotateCcw,
  Play,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Zap,
  Layers,
  Maximize2,
  X,
} from "lucide-react"
import { rotateImageBase64, compressImageBase64 } from "@/lib/ocr"
import { ImageInteractiveLightbox } from "@/components/ImageInteractiveLightbox"
import { useAppDialog } from "@/components/ui/app-dialog"
import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"

export interface BatchFileItem {
  file: File
  base64: string
}

interface ReceiptImageUploadProps {
  onImageSelected: (file: File, base64: string) => void
  onBatchSelected?: (batch: BatchFileItem[]) => void
  onCancelScan?: () => void
  isProcessing: boolean
  ocrProgressStatus?: string
  ocrProgressPercent?: number
  quotaError?: string | null
}

export function ReceiptImageUpload({
  onImageSelected,
  onBatchSelected,
  onCancelScan,
  isProcessing,
  ocrProgressStatus = "",
  ocrProgressPercent = 0,
  quotaError = null,
}: ReceiptImageUploadProps) {
  const { showAlert } = useAppDialog()
  const [isDragOver, setIsDragOver] = useState(false)

  // Single or Batch Files State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [batchBase64s, setBatchBase64s] = useState<string[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null)
  const [rotationDegrees, setRotationDegrees] = useState(0)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // GSAP Animation Refs
  const containerRef = React.useRef<HTMLDivElement>(null)
  const laserBeamRef = React.useRef<HTMLDivElement>(null)
  const progressBarRef = React.useRef<HTMLDivElement>(null)
  const compressionRing1Ref = React.useRef<HTMLDivElement>(null)
  const compressionRing2Ref = React.useRef<HTMLDivElement>(null)
  const compressionIconRef = React.useRef<HTMLDivElement>(null)
  const previewStageRef = React.useRef<HTMLDivElement>(null)
  const previewImageRef = React.useRef<HTMLImageElement>(null)

  // 1. GSAP Laser Beam Scan Sweep
  useGSAP(() => {
    if (isProcessing && laserBeamRef.current) {
      const tl = gsap.timeline({ repeat: -1, yoyo: true })
      tl.fromTo(
        laserBeamRef.current,
        { y: 0, opacity: 0.75 },
        { y: 168, opacity: 1, duration: 1.4, ease: "power1.inOut" }
      )
      return () => tl.kill()
    }
  }, { dependencies: [isProcessing], scope: containerRef })

  // 2. GSAP Smooth Progress Bar Tweening
  useGSAP(() => {
    if (isProcessing && progressBarRef.current) {
      const targetPercent = Math.max(Math.round(ocrProgressPercent * 100), 28)
      gsap.to(progressBarRef.current, {
        width: `${targetPercent}%`,
        duration: 0.55,
        ease: "power2.out",
      })
    }
  }, { dependencies: [ocrProgressPercent, isProcessing], scope: containerRef })

  // 3. GSAP Compression Sonar Pulse
  useGSAP(() => {
    if (isCompressing) {
      const tl = gsap.timeline({ repeat: -1 })
      if (compressionRing1Ref.current) {
        tl.fromTo(
          compressionRing1Ref.current,
          { scale: 0.9, opacity: 0.9 },
          { scale: 1.6, opacity: 0, duration: 1.3, ease: "power2.out" },
          0
        )
      }
      if (compressionRing2Ref.current) {
        tl.fromTo(
          compressionRing2Ref.current,
          { scale: 0.9, opacity: 0.7 },
          { scale: 1.9, opacity: 0, duration: 1.3, ease: "power2.out" },
          0.35
        )
      }
      if (compressionIconRef.current) {
        gsap.to(compressionIconRef.current, {
          scale: 1.06,
          duration: 0.65,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        })
      }
      return () => tl.kill()
    }
  }, { dependencies: [isCompressing], scope: containerRef })

  // 4. GSAP Preview Stage Entrance
  useGSAP(() => {
    if (selectedBase64 && !isProcessing && !isCompressing && previewStageRef.current) {
      gsap.fromTo(
        previewStageRef.current,
        { opacity: 0, y: 18, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.4)" }
      )
    }
  }, { dependencies: [selectedBase64, isProcessing, isCompressing], scope: containerRef })

  // 5. GSAP Smooth Rotation Physics on preview image
  useGSAP(() => {
    if (previewImageRef.current) {
      gsap.to(previewImageRef.current, {
        rotate: rotationDegrees,
        duration: 0.45,
        ease: "back.out(1.5)",
      })
    }
  }, { dependencies: [rotationDegrees], scope: containerRef })

  useEffect(() => {
    if (!isProcessing) {
      setShowCancelConfirm(false)
    }
  }, [isProcessing])

  // Realtime Quota status state
  const [quotaInfo, setQuotaInfo] = useState<{
    dailyLimit: number
    remaining: number
    used: number
    allowed: boolean
  } | null>(null)

  const fetchQuota = async () => {
    try {
      const res = await fetch("/api/quota", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setQuotaInfo(data)
      }
    } catch (e) {
      console.error("Failed to fetch quota:", e)
    }
  }

  useEffect(() => {
    fetchQuota()
  }, [isProcessing])

  // Timer countdown while processing
  useEffect(() => {
    let interval: any
    if (isProcessing) {
      setTimerSeconds(0)
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      setTimerSeconds(0)
    }

    return () => clearInterval(interval)
  }, [isProcessing])

  const triggerFileInput = (inputId: string) => {
    if (isQuotaReached || isProcessing) return
    const el = document.getElementById(inputId) as HTMLInputElement
    if (el) el.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    processFiles(files)
  }

  const processFiles = async (files: File[]) => {
    const validImages = files.filter((f) => f.type.startsWith("image/"))
    if (validImages.length === 0) {
      showAlert({ title: "Format Tidak Didukung", description: "Harap pilih file gambar (JPG, PNG, WEBP, HEIC)", variant: "warning" })
      return
    }

    setIsCompressing(true)
    setSelectedFiles(validImages)
    setCurrentFileIndex(0)
    setRotationDegrees(0)

    // Pre-compress all batch images in background so mass upload transitions smoothly
    const base64Results: string[] = []
    for (let i = 0; i < validImages.length; i++) {
      const b64 = await readFileAsBase64Compressed(validImages[i])
      base64Results.push(b64)
    }

    setBatchBase64s(base64Results)
    setSelectedBase64(base64Results[0])
    setIsCompressing(false)
  }

  const readFileAsBase64Compressed = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const rawBase64 = e.target?.result as string
        const compressed = await compressImageBase64(rawBase64, 1200, 1200, 0.82)
        resolve(compressed)
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSelectBatchIndex = (index: number) => {
    if (index >= 0 && index < selectedFiles.length && batchBase64s[index]) {
      setCurrentFileIndex(index)
      setRotationDegrees(0)
      setSelectedBase64(batchBase64s[index])
    }
  }

  const handleStartScan = async () => {
    if (selectedFiles.length === 0 || !selectedBase64 || isCompressing) return
    if (quotaInfo && !quotaInfo.allowed) return

    if (onBatchSelected && selectedFiles.length > 1 && batchBase64s.length === selectedFiles.length) {
      const batchPayload: BatchFileItem[] = []
      for (let i = 0; i < selectedFiles.length; i++) {
        let b64 = batchBase64s[i]
        if (i === currentFileIndex && rotationDegrees !== 0) {
          b64 = await rotateImageBase64(b64, rotationDegrees)
        }
        batchPayload.push({ file: selectedFiles[i], base64: b64 })
      }
      onBatchSelected(batchPayload)
      return
    }

    let finalBase64 = selectedBase64
    if (rotationDegrees !== 0) {
      finalBase64 = await rotateImageBase64(selectedBase64, rotationDegrees)
    }

    onImageSelected(selectedFiles[currentFileIndex], finalBase64)
  }

  const handleRotateLeft = () => setRotationDegrees((prev) => (prev + 270) % 360)
  const handleRotateRight = () => setRotationDegrees((prev) => (prev + 90) % 360)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) processFiles(files)
  }

  const isQuotaReached = (quotaInfo && !quotaInfo.allowed) || Boolean(quotaError)

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto space-y-4">
      {/* Quota Limit Warning Toast / Alert */}
      {isQuotaReached && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-md space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Pemberitahuan Kuota / API</span>
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed font-medium">
            {quotaError ||
              "Batas pemrosesan harian tercapai atau koneksi terganggu. Silakan periksa paket atau coba beberapa saat lagi."}
          </p>
        </div>
      )}

      {/* Native Hidden File Inputs */}
      <input
        id="gallery-file-input"
        type="file"
        multiple
        accept="image/png, image/jpeg, image/jpg, image/webp, image/heic, image/*"
        className="sr-only"
        onChange={(e) => {
          handleFileChange(e)
          e.target.value = ""
        }}
        disabled={isProcessing || isQuotaReached}
      />
      <input
        id="camera-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          handleFileChange(e)
          e.target.value = ""
        }}
        disabled={isProcessing || isQuotaReached}
      />

      {/* Main Upload / Batch Screen */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!isQuotaReached) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all overflow-hidden ${
          isQuotaReached
            ? "border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 opacity-75 cursor-not-allowed"
            : isDragOver
            ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
            : "border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm dark:shadow-2xl hover:border-slate-400 dark:hover:border-slate-700"
        }`}
      >
        {isProcessing ? (
          /* GSAP POWERED WAITING & PROCESSING SCREEN */
          <div className="flex flex-col items-center justify-center py-4 space-y-5">
            {selectedBase64 && (
              <div className="relative w-48 h-48 rounded-2xl bg-slate-950 overflow-hidden shadow-2xl border border-emerald-500/50 flex items-center justify-center group">
                {/* HUD Corner Reticles */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />

                {/* Laser Scanning Beam (GSAP Animated) */}
                <div
                  ref={laserBeamRef}
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399,0_0_25px_#10b981] z-20 pointer-events-none"
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-3 bg-emerald-400/40 blur-md rounded-full" />
                </div>

                {/* Subtle Grid Matrix */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:14px_14px] z-10 pointer-events-none" />

                {/* eslint-disable-next-html-element */}
                <img
                  src={selectedBase64}
                  alt="Nota Preview"
                  className="w-full h-full object-contain opacity-85"
                  style={{ transform: `rotate(${rotationDegrees}deg)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent z-10" />
                <div className="absolute bottom-2 inset-x-0 flex justify-center z-20">
                  <span className="text-[10px] font-black text-emerald-400 bg-slate-900/90 px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Memindai Nota...
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-center max-w-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-emerald-500" /> Durasi: {timerSeconds} detik
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl">
                Menganalisis Nota...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {ocrProgressStatus || "AI sedang mengekstrak teks dan nominal..."}
              </p>
            </div>

            <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 text-left text-xs shadow-sm">
              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> 1. Optimasi Gambar
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Selesai</span>
              </div>

              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-500 dark:text-sky-400" /> 2. Ekstraksi AI Vision
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-bold font-mono">
                  {ocrProgressPercent > 0 ? `${Math.round(ocrProgressPercent * 100)}%` : "Proses..."}
                </span>
              </div>

              <div className="flex items-center justify-between font-semibold text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" /> 3. Pemetaan Form
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Auto...</span>
              </div>
            </div>

            {/* GSAP Fluid Progress Bar */}
            <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-300 dark:border-slate-800 p-0.5">
              <div
                ref={progressBarRef}
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                style={{ width: `${Math.max(Math.round(ocrProgressPercent * 100), 28)}%` }}
              />
            </div>

            {/* Cancel Scan Action Button */}
            {onCancelScan && (
              <div className="pt-2">
                {!showCancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-500/10 hover:text-rose-600 dark:bg-slate-950 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-300 dark:border-slate-800 hover:border-rose-500/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Batalkan proses scan nota"
                  >
                    <X className="w-3.5 h-3.5" />
                    Batalkan
                  </button>
                ) : (
                  <div className="bg-white dark:bg-slate-950 border border-rose-500/30 rounded-2xl p-3.5 text-center space-y-2.5 animate-in fade-in zoom-in-95 duration-150 max-w-xs mx-auto shadow-xl">
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-300">
                      Yakin batalkan pemindaian?
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCancelConfirm(false)
                          onCancelScan()
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        Ya, Batalkan
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-800 transition-all active:scale-95 cursor-pointer"
                      >
                        Tidak
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isCompressing ? (
          /* GSAP POWERED COMPRESSION SCREEN */
          <div className="flex flex-col items-center justify-center py-12 space-y-5">
            <div className="relative flex items-center justify-center w-24 h-24">
              <div
                ref={compressionRing1Ref}
                className="absolute inset-0 rounded-3xl bg-emerald-500/15 border border-emerald-400/40 pointer-events-none"
              />
              <div
                ref={compressionRing2Ref}
                className="absolute inset-0 rounded-3xl bg-teal-500/15 border border-teal-400/30 pointer-events-none"
              />
              <div
                ref={compressionIconRef}
                className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-emerald-500/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10"
              >
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1.5 text-center">
              <h3 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl">
                Memproses Foto Nota...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                {selectedFiles.length > 1
                  ? `Mengompres dan menyiapkan ${selectedFiles.length} foto nota untuk pemindaian optimal...`
                  : "Mengompres foto resolusi tinggi untuk pemindaian AI yang optimal..."}
              </p>
            </div>
            <div className="w-44 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-2/3 rounded-full shadow-xs" />
            </div>
          </div>
        ) : selectedBase64 ? (
          /* GSAP ENTRANCE & ROTATION SCREEN */
          <div ref={previewStageRef} className="flex flex-col items-center space-y-5">
            {selectedFiles.length > 1 && (
              <div className="w-full max-w-md bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-3.5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold px-1">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <Layers className="w-4 h-4" /> Batch ({selectedFiles.length} Nota)
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">Nota #{currentFileIndex + 1}</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {selectedFiles.map((f, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectBatchIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        currentFileIndex === idx
                          ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      Nota #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold border border-amber-500/20">
                Orientasi Gambar
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Pastikan Foto Nota Tegak
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Putar gambar jika posisinya miring agar terbaca akurat oleh AI.
              </p>
            </div>

            <div
              onClick={() => {
                if (!isCompressing && selectedBase64) setShowLightbox(true)
              }}
              className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-slate-100 dark:bg-slate-950 overflow-hidden shadow-sm dark:shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 cursor-pointer group hover:border-emerald-500/80 transition-all"
              title="Klik untuk memperbesar foto"
            >
              {isCompressing ? (
                <div className="flex flex-col items-center justify-center space-y-2 text-emerald-600 dark:text-emerald-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-bold">Mengompres Foto...</span>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-html-element */}
                  <img
                    ref={previewImageRef}
                    src={selectedBase64}
                    alt="Nota Selected"
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                    style={{ transform: `rotate(${rotationDegrees}deg)` }}
                  />

                  {/* Hover Overlay Hint */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700">
                      Klik untuk perbesar
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRotateLeft}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Putar Kiri
              </button>

              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 rounded-xl">
                {rotationDegrees}°
              </span>

              <button
                type="button"
                onClick={handleRotateRight}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" /> Putar Kanan
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full max-w-sm">
              <button
                type="button"
                onClick={() => {
                  setSelectedBase64(null)
                  setSelectedFiles([])
                  setBatchBase64s([])
                }}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Ganti Foto
              </button>

              <button
                type="button"
                disabled={isQuotaReached || isCompressing}
                onClick={handleStartScan}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-lg active:scale-[0.98] cursor-pointer ${
                  isQuotaReached || isCompressing
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25"
                }`}
              >
                {isQuotaReached ? (
                  <>
                    <Lock className="w-4 h-4" /> Kuota Habis
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>
                      {selectedFiles.length > 1
                        ? `Proses Scan Batch (${selectedFiles.length})`
                        : "Mulai Scan Nota"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* INITIAL UPLOAD AREA */
          <div className="flex flex-col items-center space-y-4">
            <label
              htmlFor={isQuotaReached ? undefined : "gallery-file-input"}
              className={`group flex flex-col items-center space-y-3 ${
                isQuotaReached ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-transform ${
                  isQuotaReached
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105"
                }`}
              >
                {isQuotaReached ? <Lock className="w-8 h-8 sm:w-10 sm:h-10" /> : <Upload className="w-8 h-8 sm:w-10 sm:h-10" />}
              </div>

              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {isQuotaReached ? "Kendala Kuota / Akses" : "Unggah atau Foto Nota"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {isQuotaReached
                    ? (quotaError || "Batas pemrosesan harian tercapai.")
                    : "Pilih foto dari galeri atau ambil foto langsung menggunakan kamera."}
                </p>
              </div>
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-md pt-2">
              <button
                type="button"
                disabled={isQuotaReached || isProcessing}
                onClick={() => triggerFileInput("gallery-file-input")}
                className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-xs transition-all active:scale-[0.98] ${
                  isQuotaReached || isProcessing
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 cursor-pointer shadow-xs"
                }`}
              >
                <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Buka Galeri
              </button>

              <button
                type="button"
                disabled={isQuotaReached || isProcessing}
                onClick={() => triggerFileInput("camera-file-input")}
                className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs transition-all active:scale-[0.98] ${
                  isQuotaReached || isProcessing
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer"
                }`}
              >
                <Camera className="w-4 h-4" />
                Ambil Foto
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Mendukung upload banyak file sekaligus
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive Lightbox Modal */}
      {showLightbox && selectedBase64 && (
        <ImageInteractiveLightbox
          imageUrl={selectedBase64}
          altText="Preview Detail Nota"
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  )
}

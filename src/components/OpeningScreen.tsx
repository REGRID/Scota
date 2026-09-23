"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"

interface OpeningScreenProps {
  children: React.ReactNode
}

const PWA_CACHE_KEY = "scota_pwa_cached_state"

export function OpeningScreen({ children }: OpeningScreenProps) {
  // Mount state ensures identical server & initial client render (zero hydration mismatch)
  const [isMounted, setIsMounted] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [stage, setStage] = useState<"playing" | "transitioning" | "ended">("ended")
  const videoRef = useRef<HTMLVideoElement>(null)
  const isLoadedRef = useRef(false)
  const hasTriggeredRef = useRef(false)

  // Trigger smooth transition
  const triggerTransition = useCallback(() => {
    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true
    setStage("transitioning")

    // After animation finishes (750ms), unmount overlay completely
    setTimeout(() => {
      setStage("ended")
      setShowOverlay(false)
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("pwa-opening-init")
      }
    }, 750)
  }, [])

  useEffect(() => {
    setIsMounted(true)

    try {
      const pwaCache = localStorage.getItem(PWA_CACHE_KEY)
      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
      const isReload = navEntries.length > 0 && navEntries[0].type === "reload"

      // Jika cache ditemukan pada PWA / multi-tab mobile, atau sedang refresh: lewati opening
      if (pwaCache || isReload) {
        document.documentElement.classList.remove("pwa-opening-init")
        return
      }

      // Tandai cache aktif pada PWA dan multi-tab mobile
      localStorage.setItem(PWA_CACHE_KEY, JSON.stringify({ cachedAt: Date.now() }))
    } catch {
      // ignore
    }

    // Cache tidak ditemukan: aktifkan overlay opening
    setShowOverlay(true)
    setStage("playing")

    // Check if website has finished loading
    if (document.readyState === "complete") {
      isLoadedRef.current = true
    }
    const handleWindowLoad = () => {
      isLoadedRef.current = true
    }
    window.addEventListener("load", handleWindowLoad)

    // Listen to storage event across mobile multi-tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PWA_CACHE_KEY && e.newValue) {
        triggerTransition()
      }
    }
    window.addEventListener("storage", handleStorageChange)

    // Start video playback
    if (videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.play().catch(() => {})
    }

    // Minimum display time: exactly 3 seconds
    const threeSecondTimer = setTimeout(() => {
      // Jika dalam detik ke-3 loading website sudah selesai: langsung masuk
      if (isLoadedRef.current || document.readyState === "complete") {
        triggerTransition()
      } else {
        const waitInterval = setInterval(() => {
          if (document.readyState === "complete" || isLoadedRef.current) {
            clearInterval(waitInterval)
            triggerTransition()
          }
        }, 100)

        // Safety fallback: maksimum 5 detik
        const maxSafetyTimer = setTimeout(() => {
          clearInterval(waitInterval)
          triggerTransition()
        }, 2000)

        return () => {
          clearInterval(waitInterval)
          clearTimeout(maxSafetyTimer)
        }
      }
    }, 3000)

    // Listen to video timeupdate (detik ke-3)
    const handleTimeUpdate = () => {
      if (videoRef.current && videoRef.current.currentTime >= 3.0) {
        if (isLoadedRef.current || document.readyState === "complete") {
          triggerTransition()
        }
      }
    }

    const videoEl = videoRef.current
    if (videoEl) {
      videoEl.addEventListener("timeupdate", handleTimeUpdate)
    }

    return () => {
      clearTimeout(threeSecondTimer)
      window.removeEventListener("load", handleWindowLoad)
      window.removeEventListener("storage", handleStorageChange)
      if (videoEl) {
        videoEl.removeEventListener("timeupdate", handleTimeUpdate)
      }
    }
  }, [triggerTransition])

  // Prevent background scroll while opening is visible
  useEffect(() => {
    if (showOverlay && stage !== "ended") {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [showOverlay, stage])

  return (
    <>
      {/* Portal overlay mounted only on client when needed, eliminating hydration mismatches */}
      {isMounted && showOverlay && stage !== "ended" && createPortal(
        <div
          role="region"
          aria-label="Opening Scota"
          className={`fixed inset-0 z-[9999999] bg-black flex items-center justify-center overflow-hidden select-none pointer-events-none transition-all duration-750 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            stage === "transitioning"
              ? "opacity-0 scale-125 blur-2xl"
              : "opacity-100 scale-100 blur-none"
          }`}
          style={{ willChange: "transform, opacity, filter" }}
        >
          {/* Centered Brand Opening Video */}
          <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src="/opening.mp4"
              playsInline
              autoPlay
              muted
              preload="auto"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Main Website Content with Blur Zoom In Entrance */}
      <div
        id="opening-content-root"
        className={`w-full min-h-screen flex flex-col ${
          stage === "playing"
            ? "opacity-0 scale-95 blur-md"
            : stage === "transitioning"
            ? "opacity-100 scale-100 blur-none transition-all duration-750 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : ""
        }`}
        style={stage === "transitioning" ? { willChange: "transform, opacity, filter" } : undefined}
      >
        {children}
      </div>
    </>
  )
}

"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"

interface OpeningScreenProps {
  children: React.ReactNode
}

const PWA_CACHE_KEY = "scota_pwa_cached_state"
const SESSION_SEEN_KEY = "scota_opening_seen_session"

export function OpeningScreen({ children }: OpeningScreenProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [stage, setStage] = useState<"playing" | "transitioning" | "ended">("ended")
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasTriggeredRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Trigger smooth transition out
  const triggerTransition = useCallback(() => {
    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    try {
      localStorage.setItem(PWA_CACHE_KEY, JSON.stringify({ cachedAt: Date.now() }))
      sessionStorage.setItem(SESSION_SEEN_KEY, "1")
    } catch {
      // ignore storage errors
    }

    setStage("transitioning")

    // After animation finishes (500ms), unmount overlay completely
    setTimeout(() => {
      setStage("ended")
      setShowOverlay(false)
      if (typeof document !== "undefined") {
        document.body.style.overflow = ""
        document.documentElement.classList.remove("pwa-opening-init")
      }
    }, 500)
  }, [])

  useEffect(() => {
    setIsMounted(true)

    // Check if opening was already shown in this session or cached, or if page is being reloaded
    let shouldSkip = false
    try {
      const pwaCache = localStorage.getItem(PWA_CACHE_KEY)
      const sessionSeen = sessionStorage.getItem(SESSION_SEEN_KEY)
      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
      const isReload = navEntries.length > 0 && navEntries[0].type === "reload"

      if (pwaCache || sessionSeen || isReload) {
        shouldSkip = true
      }
    } catch {
      // ignore
    }

    if (shouldSkip) {
      setShowOverlay(false)
      setStage("ended")
      if (typeof document !== "undefined") {
        document.body.style.overflow = ""
        document.documentElement.classList.remove("pwa-opening-init")
      }
      return
    }

    // Activate overlay opening
    setShowOverlay(true)
    setStage("playing")

    // Absolute hard safety ceiling timeout: 2.2 seconds maximum.
    // Guarantees it will NEVER get stuck under any circumstance!
    timerRef.current = setTimeout(() => {
      triggerTransition()
    }, 2200)

    // Listen to keydown (Esc, Space, Enter) to dismiss instantly
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        triggerTransition()
      }
    }
    window.addEventListener("keydown", handleKeyDown)

    // Listen to storage event across multi-tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PWA_CACHE_KEY && e.newValue) {
        triggerTransition()
      }
    }
    window.addEventListener("storage", handleStorageChange)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("storage", handleStorageChange)
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
    } else if (typeof document !== "undefined") {
      document.body.style.overflow = ""
    }
  }, [showOverlay, stage])

  return (
    <>
      {/* Portal overlay mounted only on client when needed */}
      {isMounted && showOverlay && stage !== "ended" && createPortal(
        <div
          role="region"
          aria-label="Opening Scota"
          onClick={triggerTransition}
          className={`fixed inset-0 z-[9999999] bg-black flex items-center justify-center overflow-hidden select-none cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            stage === "transitioning"
              ? "opacity-0 scale-110 blur-xl pointer-events-none"
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
              onEnded={triggerTransition}
              onError={triggerTransition}
              onTimeUpdate={(e) => {
                if (e.currentTarget.currentTime >= 2.2) {
                  triggerTransition()
                }
              }}
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* Quick Skip Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              triggerTransition()
            }}
            className="absolute top-5 right-5 z-20 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/80 hover:text-white text-xs font-semibold transition-all border border-white/10 cursor-pointer"
          >
            Lewati &rarr;
          </button>
        </div>,
        document.body
      )}

      {/* Main Website Content with Entrance */}
      <div
        id="opening-content-root"
        className={`w-full min-h-screen flex flex-col ${
          stage === "playing"
            ? "opacity-0 scale-95 blur-md"
            : stage === "transitioning"
            ? "opacity-100 scale-100 blur-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : ""
        }`}
        style={stage === "transitioning" ? { willChange: "transform, opacity, filter" } : undefined}
      >
        {children}
      </div>
    </>
  )
}

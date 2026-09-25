"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldAlert, Menu, RefreshCw, Search, Command } from "lucide-react"
import { SystemVitalsWidget } from "@/components/superadmin/SystemVitalsWidget"
import { SuperadminCommandPalette } from "@/components/superadmin/SuperadminCommandPalette"

interface SuperadminTopbarProps {
  onToggleMobileSidebar: () => void
  onRefresh?: () => void
  isLoading?: boolean
}

export function SuperadminTopbar({
  onToggleMobileSidebar,
  onRefresh,
  isLoading = false,
}: SuperadminTopbarProps) {
  const router = useRouter()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 font-sans">
        {/* Left: Mobile Toggle & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white md:hidden hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Superadmin Mission Control</span>
            </div>
          </div>
        </div>

        {/* Right: Actions, Vitals, Search, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Quick Command Palette Button */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all cursor-pointer shadow-sm group"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            <span className="hidden sm:inline">Cari tenant, rute, aksi...</span>
            <span className="sm:hidden">Cari</span>
            <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700/60">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </kbd>
          </button>

          {/* Live System Vitals Widget */}
          <SystemVitalsWidget />

          {/* Refresh Action */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          )}

          {/* Superadmin Profile Badge */}
          <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-800/80">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 ring-1 ring-white/20">
              SA
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <strong className="text-xs font-bold text-white block">REGRID Master</strong>
              <span className="text-[10px] text-emerald-400 font-semibold font-mono">Enterprise Admin</span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal */}
      <SuperadminCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  )
}

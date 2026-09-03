"use client"

import React from "react"
import { ShieldAlert, Menu, Bell, RefreshCw, UserCheck } from "lucide-react"

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
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
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
            <span>Superadmin Command Center</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        )}

        {/* Superadmin Profile Badge */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20">
            SA
          </div>
          <div className="hidden sm:block text-left">
            <strong className="text-xs font-bold text-white block leading-none">REGRID Master</strong>
            <span className="text-[10px] text-emerald-400 font-semibold leading-none">Platform Owner</span>
          </div>
        </div>
      </div>
    </header>
  )
}

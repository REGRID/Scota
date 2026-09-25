"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft, Settings, ShieldCheck, ChevronRight } from "lucide-react"
import { BranchSwitcher } from "@/components/BranchSwitcher"
import { ThemeToggle } from "@/lib/theme"

interface SettingsHeaderProps {
  currentRole: string
  activeTabLabel: string
}

export function SettingsHeader({ currentRole, activeTabLabel }: SettingsHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs & Back Button */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs group"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 hidden sm:block shrink-0" />

          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 min-w-0">
            <span className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold shrink-0">
              <Settings className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Pengaturan</span>
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
              {activeTabLabel}
            </span>
          </nav>
        </div>

        {/* Right: Branch Switcher & Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <BranchSwitcher currentRole={currentRole} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

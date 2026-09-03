"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldAlert, Menu, RefreshCw, Search, X, Building2, ChevronRight, LogOut } from "lucide-react"

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/superadmin/tenants?search=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery("")
    }
  }

  return (
    <>
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
          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs font-medium transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Cari tenant / invoice...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
              /
            </kbd>
          </button>

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

      {/* Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik nama tenant, username, atau nomor invoice..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-xs font-bold text-white placeholder:text-slate-500 focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-1">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase px-2 tracking-wider">
                Akses Cepat
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    router.push("/superadmin/tenants")
                    setSearchOpen(false)
                  }}
                  className="p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left text-xs font-bold text-slate-300 flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Semua Tenant</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    router.push("/superadmin/billing")
                    setSearchOpen(false)
                  }}
                  className="p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left text-xs font-bold text-slate-300 flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-400" />
                    <span>Laporan Billing</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

"use client"

import React, { useState } from "react"
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar"
import { SuperadminTopbar } from "@/components/superadmin/SuperadminTopbar"

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        <SuperadminSidebar />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-xs bg-slate-950 h-full z-10 shadow-2xl animate-in slide-in-from-left">
            <SuperadminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <SuperadminTopbar
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}

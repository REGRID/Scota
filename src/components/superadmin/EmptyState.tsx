"use client"

import React from "react"
import { LucideIcon, Inbox } from "lucide-react"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400">
        <Icon className="w-8 h-8" />
      </div>
      <div className="max-w-sm space-y-1">
        <h4 className="text-sm font-black text-white">{title}</h4>
        {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

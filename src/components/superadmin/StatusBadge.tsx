"use client"

import React from "react"

export type CommonStatus =
  | "active"
  | "trial"
  | "suspended"
  | "expired"
  | "cancelled"
  | "lunas"
  | "pending"
  | "gagal"
  | string

interface StatusBadgeProps {
  status: CommonStatus
  className?: string
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim()

  let style = "bg-slate-800 text-slate-400 border-slate-700"
  let label = status

  switch (normalized) {
    case "active":
    case "lunas":
    case "aktif":
      style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      label = normalized === "lunas" ? "Lunas" : "Aktif"
      break
    case "trial":
      style = "bg-sky-500/10 text-sky-400 border-sky-500/30"
      label = "Trial 14 Hari"
      break
    case "expired":
    case "kadaluarsa":
      style = "bg-rose-500/10 text-rose-400 border-rose-500/30"
      label = "Expired"
      break
    case "suspended":
    case "ditangguhkan":
      style = "bg-amber-500/10 text-amber-400 border-amber-500/30"
      label = "Suspended"
      break
    case "pending":
      style = "bg-amber-500/10 text-amber-300 border-amber-500/30"
      label = "Menunggu Bayar"
      break
    case "cancelled":
    case "gagal":
      style = "bg-slate-800/80 text-slate-400 border-slate-700"
      label = normalized === "gagal" ? "Gagal" : "Dibatalkan"
      break
    default:
      style = "bg-slate-800 text-slate-300 border-slate-700"
      label = status
      break
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize tracking-wide ${style} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{label}</span>
    </span>
  )
}

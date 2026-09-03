"use client"

import React, { useState } from "react"
import { type DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { Calendar as CalendarIcon, Check, RotateCcw, X } from "lucide-react"

export interface CalendarRangeSelectProps {
  dateRange?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  onApply?: (range: DateRange | undefined) => void
  onClose?: () => void
  className?: string
}

export function CalendarRangeSelect({
  dateRange: initialRange,
  onSelect,
  onApply,
  onClose,
  className = "",
}: CalendarRangeSelectProps) {
  const [range, setRange] = useState<DateRange | undefined>(initialRange)

  const handleSelect = (newRange: DateRange | undefined) => {
    setRange(newRange)
    if (onSelect) {
      onSelect(newRange)
    }
  }

  const handleApply = () => {
    if (onApply) {
      onApply(range)
    }
    if (onClose) {
      onClose()
    }
  }

  const handleReset = () => {
    setRange(undefined)
    if (onSelect) {
      onSelect(undefined)
    }
  }

  const setPreset = (type: "today" | "7days" | "30days" | "month") => {
    const today = new Date()
    let from: Date
    let to: Date = today

    if (type === "today") {
      from = today
    } else if (type === "7days") {
      from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    } else if (type === "30days") {
      from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    }

    const newRange: DateRange = { from, to }
    setRange(newRange)
    if (onSelect) {
      onSelect(newRange)
    }
  }

  const formatDateLabel = (date?: Date) => {
    if (!date) return "-"
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    })
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 space-y-1.5 transition-colors duration-200 ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[10.5px] font-black text-slate-900 dark:text-white">
          <CalendarIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Rentang Tanggal</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Presets */}
      <div className="grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={() => setPreset("today")}
          className="py-0.5 px-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[9.5px] font-bold border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer text-center active:scale-95"
        >
          Hari Ini
        </button>
        <button
          type="button"
          onClick={() => setPreset("7days")}
          className="py-0.5 px-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[9.5px] font-bold border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer text-center active:scale-95"
        >
          7 Hari
        </button>
        <button
          type="button"
          onClick={() => setPreset("30days")}
          className="py-0.5 px-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[9.5px] font-bold border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer text-center active:scale-95"
        >
          30 Hari
        </button>
        <button
          type="button"
          onClick={() => setPreset("month")}
          className="py-0.5 px-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[9.5px] font-bold border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer text-center active:scale-95"
        >
          Bulan Ini
        </button>
      </div>

      {/* Visual Calendar */}
      <div>
        <Calendar
          mode="range"
          defaultMonth={range?.from || new Date()}
          selected={range}
          onSelect={handleSelect}
        />
      </div>

      {/* Selected Range Summary & Action Footer */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
        <div className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-300 truncate">
          {range?.from ? (
            <span className="flex items-center gap-0.5">
              <span className="text-slate-900 dark:text-white font-bold">{formatDateLabel(range.from)}</span>
              <span className="text-slate-400 font-normal">s/d</span>
              <span className="text-slate-900 dark:text-white font-bold">{formatDateLabel(range.to || range.from)}</span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Pilih tanggal</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="p-0.5 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default CalendarRangeSelect

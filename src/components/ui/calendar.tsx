"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { id } from "date-fns/locale"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={id}
      showOutsideDays={showOutsideDays}
      className={cn("p-0 bg-transparent select-none text-slate-900 dark:text-slate-100 w-full", className)}
      classNames={{
        root: "w-full",
        months: "relative flex flex-col w-full",
        month: "space-y-1 w-full",
        month_caption: "flex items-center justify-between h-6 px-1 relative mb-0.5",
        caption_label: "text-[11px] font-black tracking-wide text-slate-900 dark:text-white capitalize",
        nav: "absolute top-0 right-0 flex items-center gap-1 z-10",
        button_previous: cn(
          "h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
        ),
        button_next: cn(
          "h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full justify-between mb-1",
        weekday:
          "w-7 text-center text-slate-400 dark:text-slate-500 font-bold text-[9.5px] uppercase tracking-wider",
        weeks: "w-full space-y-0.5 block",
        week: "flex w-full justify-between",
        day: "w-7 h-7 p-0 text-center relative flex items-center justify-center transition-all",
        day_button: cn(
          "w-7 h-7 rounded-full font-bold text-[10.5px] transition-all flex items-center justify-center cursor-pointer select-none",
          "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
          "data-[range-start=true]:bg-emerald-600! data-[range-start=true]:text-white! data-[range-start=true]:rounded-full! data-[range-start=true]:font-black! data-[range-start=true]:shadow-xs!",
          "data-[range-end=true]:bg-emerald-600! data-[range-end=true]:text-white! data-[range-end=true]:rounded-full! data-[range-end=true]:font-black! data-[range-end=true]:shadow-xs!",
          "data-[range-middle=true]:bg-transparent! data-[range-middle=true]:text-emerald-800! dark:data-[range-middle=true]:text-emerald-300! data-[range-middle=true]:font-bold!",
          "data-[today=true]:font-black data-[today=true]:text-emerald-600 dark:data-[today=true]:text-emerald-400"
        ),
        range_start: "bg-emerald-500/20 dark:bg-emerald-500/25 rounded-l-full",
        range_end: "bg-emerald-500/20 dark:bg-emerald-500/25 rounded-r-full",
        range_middle: "bg-emerald-500/15 dark:bg-emerald-500/20 rounded-none",
        selected: "bg-emerald-600 text-white font-black",
        today: "font-black",
        outside:
          "text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-100",
        disabled: "text-slate-300 dark:text-slate-700 opacity-20 cursor-not-allowed pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="w-3 h-3 text-slate-700 dark:text-slate-200" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-700 dark:text-slate-200" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

"use client"

import React, { useState } from "react"
import { ShieldCheck, Clock, User, CheckCircle2, ShieldAlert } from "lucide-react"

export default function SuperadminAuditLogPage() {
  const [logs] = useState([
    {
      id: "LOG-01",
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toLocaleString("id-ID"),
      superadmin: "REGRID Master (rama)",
      action: "UPDATE_SUBSCRIPTION",
      target: "Toko Kopi Senja (kopi_senja)",
      detail: "Upgrade paket ke PRO Usaha (Masa aktif 365 Hari)",
    },
    {
      id: "LOG-02",
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleString("id-ID"),
      superadmin: "REGRID Master (refo)",
      action: "GENERATE_VOUCHER",
      target: "NP-PRO-1Y-AB892",
      detail: "Pembuatan voucher lisensi resmi Pro Usaha 1 Tahun",
    },
    {
      id: "LOG-03",
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toLocaleString("id-ID"),
      superadmin: "REGRID Master (rama)",
      action: "RESET_PASSWORD",
      target: "CV Maju Lancar (maju_lancar)",
      detail: "Reset password atas permintaan pemilik tenant",
    },
    {
      id: "LOG-04",
      timestamp: new Date(Date.now() - 360 * 60 * 1000).toLocaleString("id-ID"),
      superadmin: "System Automated Engine",
      action: "AUTO_ONBOARDING",
      target: "Studio Foto Abadi (studio_abadi)",
      detail: "Aktivasi otomatis Free Trial 14 Hari saat pendaftaran",
    },
  ])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Audit Log & Jejak Aktivitas Superadmin
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Catatan kronologis seluruh aksi penting superadmin (perubahan paket, reset password, pembuatan voucher).
          </p>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
              <tr>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Superadmin Pelaksana</th>
                <th className="py-3.5 px-4">Aksi</th>
                <th className="py-3.5 px-4">Target Tenant / Objek</th>
                <th className="py-3.5 px-4">Detail Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">{l.timestamp}</td>
                  <td className="py-3.5 px-4">
                    <strong className="text-white font-bold block">{l.superadmin}</strong>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 border border-slate-700 text-[10.5px] font-mono font-bold">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{l.target}</td>
                  <td className="py-3.5 px-4 text-slate-300">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

"use client"

import React, { useState } from "react"
import {
  Bell,
  Smartphone,
  ShieldCheck,
  Zap,
  X,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { SettingsCard, SettingsCardHeader } from "@/components/settings/SettingsCard"
import {
  NotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  getNotificationPermissionStatus,
  testNativeOSNotification,
  testBackgroundPushNotification,
  registerPushSubscription,
  unsubscribePushNotifications,
} from "@/lib/pwaNotification"

interface NotificationsTabProps {
  permState: string
  setPermState: (val: string) => void
  isSubscribed: boolean
  setIsSubscribed: (val: boolean) => void
  notifySettings: NotificationSettings
  setNotifySettings: (val: NotificationSettings) => void
}

export function NotificationsTab({
  permState,
  setPermState,
  isSubscribed,
  setIsSubscribed,
  notifySettings,
  setNotifySettings,
}: NotificationsTabProps) {
  const [isSubscribingPush, setIsSubscribingPush] = useState(false)
  const [isTestingBackgroundPush, setIsTestingBackgroundPush] = useState(false)

  const handleTogglePushSubscription = async () => {
    setIsSubscribingPush(true)
    try {
      if (isSubscribed) {
        const ok = await unsubscribePushNotifications()
        if (ok) {
          setIsSubscribed(false)
          toast.success("Web Push dinonaktifkan di perangkat ini")
        } else {
          toast.error("Gagal menonaktifkan push notification")
        }
      } else {
        const granted = await requestNotificationPermission()
        setPermState(getNotificationPermissionStatus())
        if (!granted) {
          toast.error("Izin notifikasi ditolak oleh browser")
          return
        }
        const ok = await registerPushSubscription()
        if (ok) {
          setIsSubscribed(true)
          toast.success("Perangkat berhasil didaftarkan untuk Web Push!")
        } else {
          toast.error("Gagal mendaftarkan Web Push. Pastikan push service aktif.")
        }
      }
    } finally {
      setIsSubscribingPush(false)
    }
  }

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission()
    setPermState(getNotificationPermissionStatus())
    if (granted) {
      testNativeOSNotification()
      toast.success("Notifikasi lokal dikirimkan!")
    } else {
      toast.error("Izin notifikasi belum diberikan")
    }
  }

  const handleTestBackgroundPush = async () => {
    setIsTestingBackgroundPush(true)
    try {
      const res = await testBackgroundPushNotification(5)
      if (res.success) {
        toast.info(res.message || "Push dijadwalkan dalam 5 detik. Kunci layar atau buka aplikasi lain untuk mencoba!")
      } else {
        toast.error(res.message || "Gagal menjadwalkan push notification")
      }
    } catch {
      toast.error("Terjadi kesalahan saat memicu background push")
    } finally {
      setIsTestingBackgroundPush(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Notifikasi & Web Push Alert"
          description="Pemberitahuan instan saat nota baru masuk atau transaksi membutuhkan persetujuan dual-control."
          icon={Bell}
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>Tenant-Isolated</span>
            </span>
          }
        />

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Browser Permission Status */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                permState === "granted"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : permState === "denied"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              <Bell className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Izin Browser</p>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    permState === "granted"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : permState === "denied"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {permState === "granted" ? "Diizinkan" : permState === "denied" ? "Diblokir" : "Belum Aktif"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {permState === "granted"
                  ? "Browser telah memberikan izin untuk menampilkan notifikasi pada perangkat ini."
                  : permState === "denied"
                  ? "Izin notifikasi diblokir pada setelan browser. Buka pengaturan browser untuk mengizinkan."
                  : "Klik tombol aktifkan untuk mengizinkan penerimaan alert transaksi."}
              </p>
            </div>
          </div>

          {/* Card 2: Background Web Push Status */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isSubscribed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              <Smartphone className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Web Push Background</p>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    isSubscribed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isSubscribed ? "Terdaftar (Online)" : "Tidak Aktif"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {isSubscribed
                  ? "Perangkat siap menerima alert HP meskipun aplikasi Scota sedang tertutup."
                  : "Daftarkan perangkat agar tetap menerima alert saat aplikasi ditutup."}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSubscribingPush}
            onClick={handleTogglePushSubscription}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 ${
              isSubscribed
                ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white"
            } disabled:opacity-50`}
          >
            {isSubscribingPush ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isSubscribed ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>{isSubscribed ? "Nonaktifkan Web Push" : "Aktifkan Web Push di Perangkat Ini"}</span>
          </button>

          <button
            type="button"
            onClick={handleTestNotification}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-800"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Uji Notifikasi Lokal</span>
          </button>

          <button
            type="button"
            disabled={isTestingBackgroundPush}
            onClick={handleTestBackgroundPush}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
          >
            {isTestingBackgroundPush ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
            <span>Uji Push HP (Jeda 5s)</span>
          </button>
        </div>

        {/* Channel Preferences */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Preferensi Saluran Notifikasi
          </h3>

          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Pemberitahuan Nota Baru Masuk</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kirim alert saat kasir/staf memindai atau menyimpan nota transaksi belanja baru.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifySettings.newReceiptEnabled}
              onChange={(e) => {
                const updated = { ...notifySettings, newReceiptEnabled: e.target.checked }
                setNotifySettings(updated)
                saveNotificationSettings(updated)
              }}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Alert Persetujuan Dual-Control</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kirim notifikasi instan kepada peninjau saat ada nota yang butuh verifikasi.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifySettings.approvalReqEnabled}
              onChange={(e) => {
                const updated = { ...notifySettings, approvalReqEnabled: e.target.checked }
                setNotifySettings(updated)
                saveNotificationSettings(updated)
              }}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Notifikasi Suara & Banner Sistem OS</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Izinkan notifikasi memicu getaran dan banner pop-up di layar perangkat.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifySettings.osPushEnabled}
              onChange={(e) => {
                const updated = { ...notifySettings, osPushEnabled: e.target.checked }
                setNotifySettings(updated)
                saveNotificationSettings(updated)
              }}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Security & Multi-Tenant Guarantee Note */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11px] leading-relaxed">
            <strong>Jaminan Privasi & Isolasi Tenant:</strong> Seluruh sistem notifikasi Scota terisolasi per tenant. Notifikasi hanya disalurkan ke perangkat staf terdaftar di toko Anda tanpa risiko kebocoran data lintas-organisasi.
          </p>
        </div>
      </SettingsCard>
    </div>
  )
}

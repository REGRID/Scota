"use client"

import React, { useRef } from "react"
import {
  Store,
  Upload,
  Trash2,
  FileText,
  Building,
  Phone,
  Mail,
  Receipt,
  FileCheck,
  Loader2,
  Check,
  Sparkles,
  Percent,
} from "lucide-react"
import { toast } from "sonner"
import { SettingsCard, SettingsCardHeader, SettingsCardFooter } from "@/components/settings/SettingsCard"

export interface BusinessTabProps {
  businessName: string
  setBusinessName: (val: string) => void
  tagline: string
  setTagline: (val: string) => void
  logoUrl: string
  setLogoUrl: (val: string) => void
  businessType: string
  setBusinessType: (val: string) => void
  address: string
  setAddress: (val: string) => void
  phone: string
  setPhone: (val: string) => void
  businessEmail: string
  setBusinessEmail: (val: string) => void
  taxNumber: string
  setTaxNumber: (val: string) => void
  defaultTaxPercent: string
  setDefaultTaxPercent: (val: string) => void
  invoiceFooter: string
  setInvoiceFooter: (val: string) => void
  isSavingBusiness: boolean
  onSaveBusiness: () => Promise<void>
}

export function BusinessTab({
  businessName,
  setBusinessName,
  tagline,
  setTagline,
  logoUrl,
  setLogoUrl,
  businessType,
  setBusinessType,
  address,
  setAddress,
  phone,
  setPhone,
  businessEmail,
  setBusinessEmail,
  taxNumber,
  setTaxNumber,
  defaultTaxPercent,
  setDefaultTaxPercent,
  invoiceFooter,
  setInvoiceFooter,
  isSavingBusiness,
  onSaveBusiness,
}: BusinessTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle Logo Upload with Canvas Compression
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file logo maksimal 5MB")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const maxDim = 256
        let w = img.width
        let h = img.height
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        ctx?.drawImage(img, 0, 0, w, h)
        const compressedDataUrl = canvas.toDataURL("image/webp", 0.85)
        setLogoUrl(compressedDataUrl)
        toast.success("Logo toko berhasil diunggah!")
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoUrl("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    toast.info("Logo dihapus")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim()) {
      toast.error("Nama Usaha / Toko wajib diisi")
      return
    }
    await onSaveBusiness()
  }

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Profil Bisnis & Identitas Toko"
          description="Identitas resmi perusahaan/toko yang dicantumkan pada kop laporan nota belanja, bukti transaksi resmi, dan ekspor dokumen PDF."
          icon={Store}
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
              <FileCheck className="w-3 h-3 text-emerald-500" />
              <span>Output PDF & Cetak Struk</span>
            </span>
          }
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Layout Grid: Form (Left) & Live PDF Mockup (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-7 space-y-5">
              {/* Logo Upload Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Logo Perusahaan / Toko</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Format: PNG, JPG, WebP (Maks 5MB)
                  </span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={logoUrl}
                        alt="Logo Toko"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm ring-4 ring-emerald-500/10 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Store className="w-6 h-6 stroke-[1.5]" />
                      <span className="text-[9px] mt-1 font-semibold">Tanpa Logo</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{logoUrl ? "Ganti Logo" : "Unggah Logo"}</span>
                      </button>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer border border-rose-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Logo ini otomatis dirender di sudut kiri atas setiap berkas ekspor PDF laporan rekapitulasi nota dan kop struk.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nama Usaha & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nama Usaha / Badan Usaha Resmi
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Contoh: Kedai Perkara Kopi"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tagline / Slogan Usaha
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Contoh: Specialty Coffee & Roastery"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Tipe Usaha & Legalitas NPWP/NIB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kategori / Tipe Usaha
                  </label>
                  <select
                    value={businessType || "Food & Beverage (Kafe / Restoran / Kedai)"}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Food & Beverage (Kafe / Restoran / Kedai)">Food & Beverage (Kafe / Restoran / Kedai)</option>
                    <option value="Toko Kelontong / Ritel / Minimarket">Toko Kelontong / Ritel / Minimarket</option>
                    <option value="Jasa, Servis & Konsultan">Jasa, Servis & Konsultan</option>
                    <option value="Bengkel & Otomotif">Bengkel & Otomotif</option>
                    <option value="Klinik, Apotek & Kesehatan">Klinik, Apotek & Kesehatan</option>
                    <option value="Fashion, Butik & Pakaian">Fashion, Butik & Pakaian</option>
                    <option value="Bahan Bangunan & Perkakas">Bahan Bangunan & Perkakas</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Legalitas Resmi (NPWP / NIB / Izin Usaha)
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="Contoh: NPWP: 01.234.567.8-901.000"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-400">
                    Dicetak pada kop surat invoice dan laporan pertanggungjawaban pajak.
                  </p>
                </div>
              </div>

              {/* Telepon CS & Email Bisnis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Nomor Telepon CS / Toko</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 0852-1597-3776 / 031-5551234"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Email Resmi Perusahaan</span>
                  </label>
                  <input
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="Contoh: halo@perkarakopi.id"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Alamat Lengkap Toko */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Alamat Lengkap Toko / Kantor Pusat</span>
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Pemuda No. 45, Surabaya, Jawa Timur 60271"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Tarif Pajak PPN & Footer Nota */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Tarif PPN (%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={defaultTaxPercent}
                    onChange={(e) => setDefaultTaxPercent(e.target.value)}
                    placeholder="11"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Catatan Kaki Struk / Footer Resmi</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceFooter}
                    onChange={(e) => setInvoiceFooter(e.target.value)}
                    placeholder="Terima kasih atas kerja sama Anda dengan usaha kami."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live PDF Document Kop Surat Mockup */}
            <div className="lg:col-span-5 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Pratinjau Nyata Output PDF</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Live Preview
                </span>
              </label>

              {/* White Sheet / Document Replica */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm space-y-4">
                {/* Header Banner */}
                <div className="bg-slate-900 text-white px-3 py-2 rounded-lg flex items-center justify-between text-[10px] font-black tracking-wide">
                  <span className="truncate">LAPORAN REKAPITULASI PEMBUKUAN NOTA</span>
                  <span className="text-emerald-400 shrink-0 text-[8px] uppercase">Official Statement</span>
                </div>

                {/* Company Header Box */}
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {businessName || "Nama Usaha Anda"}
                    </h4>
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                      {tagline || "Tagline / Slogan Usaha"}
                    </p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {address || "Alamat resmi kantor atau gerai toko"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[9px] text-slate-400 font-mono">
                      <span>Telp: {phone || "08xx-xxxx-xxxx"}</span>
                      {taxNumber && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                          {taxNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mockup Data Rows */}
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <span>No. Registrasi Dokumen:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">140008801996 - SCOTA</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <span>Tarif Dasar PPN:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{defaultTaxPercent || "11"}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <span>Status Verifikasi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Sah & Terverifikasi</span>
                  </div>
                </div>

                {/* Mockup Footer Note */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[9px] text-slate-500 dark:text-slate-400 italic text-center">
                  "{invoiceFooter || "Terima kasih atas kerja sama Anda dengan usaha kami."}"
                </div>
              </div>
            </div>
          </div>

          <SettingsCardFooter>
            <span className="text-[11px] text-slate-400">
              Perubahan profil toko otomatis berlaku untuk seluruh cetakan nota dan laporan PDF baru.
            </span>
            <button
              type="submit"
              disabled={isSavingBusiness}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              {isSavingBusiness ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Profil Usaha</span>
                </>
              )}
            </button>
          </SettingsCardFooter>
        </form>
      </SettingsCard>
    </div>
  )
}

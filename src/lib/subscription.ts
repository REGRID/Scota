export type SubscriptionTier = "trial" | "starter" | "pro" | "enterprise" | "developer"

export interface StudioProfile {
  studioName: string
  tagline: string
  address: string
  phone: string
  logoUrl?: string
  invoiceFooter: string
  taxNumber?: string
}

export interface ApprovalWorkflowConfig {
  enableApproval: boolean             // true: butuh verifikasi, false: auto-approve langsung terbit
  approvalTargetRole?: string         // "ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SUPERADMIN"
  approverTarget?: string             // "ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SUPERADMIN" | "SPECIFIC_USER"
  designatedApproverUsername?: string // Username spesifik jika jalur diarahkan ke satu orang
  requireForCreate: boolean           // Butuh approval untuk nota baru
  requireForEdit: boolean             // Butuh approval untuk edit nota
  requireForDelete: boolean           // Butuh approval untuk hapus nota
  requireForSettle: boolean           // Butuh approval untuk pelunasan nota
  minAmountThreshold: number          // 0 = semua nominal, atau misal > 500000 saja
}

export interface SubscriptionInfo {
  tier: SubscriptionTier
  status: "active" | "expiring" | "expired" | "trial" | "suspended"
  validUntil: string // ISO string
  monthlyScanLimit: number
  usedScansThisMonth: number
  studioProfile: StudioProfile
  activeLicenseKey?: string
  approvalWorkflow?: ApprovalWorkflowConfig
}

export interface TierConfig {
  name: string
  monthlyScanLimit: number
  priceMonthly: number
  priceYearly: number
  originalPriceMonthly?: number
  originalPriceYearly?: number
  maxUsers: number
  maxBranches: number
  features: string[]
}

export const DEFAULT_APPROVAL_WORKFLOW: ApprovalWorkflowConfig = {
  enableApproval: false,
  approvalTargetRole: "ANY_ADMIN",
  approverTarget: "ANY_ADMIN",
  requireForCreate: false,
  requireForEdit: false,
  requireForDelete: false,
  requireForSettle: false,
  minAmountThreshold: 0,
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  trial: {
    name: "Trial / Percobaan",
    monthlyScanLimit: 30,
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 2,
    maxBranches: 1,
    features: [
      "30 Scan Nota AI / bulan",
      "Katalog Kategori Otomatis",
      "Ekspor Data Excel & CSV",
      "PWA & Akses Multi-Device",
      "Masa Evaluasi Lengkap 14 Hari",
    ],
  },
  starter: {
    name: "Starter Bisnis",
    monthlyScanLimit: 150,
    priceMonthly: 35000,
    priceYearly: 350000,
    originalPriceMonthly: 70000,
    originalPriceYearly: 700000,
    maxUsers: 3,
    maxBranches: 1,
    features: [
      "150 Scan Nota AI / bulan",
      "Kecepatan AI Vision OCR Prioritas Cepat",
      "Ekspor Dokumen Laporan PDF & Excel Resmi",
      "Kustomisasi Nama & Logo Usaha di Kop Surat",
      "Multi-Akun (Hingga 3 Anggota Staf & Kasir)",
      "PWA Notifikasi Kasir & Admin Realtime",
      "Dukungan Bantuan Email & Chat",
    ],
  },
  pro: {
    name: "Pro Usaha",
    monthlyScanLimit: 600,
    priceMonthly: 60000,
    priceYearly: 600000,
    originalPriceMonthly: 120000,
    originalPriceYearly: 1200000,
    maxUsers: 10,
    maxBranches: 5,
    features: [
      "600 Scan Nota AI / bulan",
      "Kecepatan AI Vision OCR Prioritas Turbo",
      "AI Vision Multi-Foto & Faktur Panjang",
      "Dual-Control Approval (Otorisasi 2 Admin)",
      "Custom Watermark Resmi Usaha di Laporan PDF",
      "Self-Learning AI Memory (Auto-Katalog)",
      "Multi-Cabang (Hingga 5 Cabang Usaha)",
      "Multi-Akun (Hingga 10 Anggota Staf & Kasir)",
      "Pencadangan Otomatis & Export Akuntansi",
      "Dukungan WhatsApp Prioritas Khusus",
    ],
  },
  enterprise: {
    name: "Enterprise Multi-Cabang",
    monthlyScanLimit: 99999,
    priceMonthly: 100000,
    priceYearly: 1000000,
    originalPriceMonthly: 200000,
    originalPriceYearly: 2000000,
    maxUsers: 99,
    maxBranches: 99,
    features: [
      "Unlimited Scan Nota AI (Tanpa Batas Kuota)",
      "Kecepatan AI Vision Ultra Fast Dedicated",
      "Dukungan Multi-Cabang Bebas Tanpa Batas",
      "Bebas Tambah Seluruh Anggota Staf & Kasir",
      "Dual-Control Approval & Peran Kustom Lengkap",
      "Webhook & Integrasi Sistem POS / Akuntansi",
      "Dedicated Database & Jaminan SLA 99.9%",
      "Onboarding & Training Tim Khusus",
      "Dedicated Account Manager Prioritas",
    ],
  },
  developer: {
    name: "Developer / Unlimited Master",
    monthlyScanLimit: 999999,
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 999,
    maxBranches: 999,
    features: [
      "Unlimited Scan Nota AI (Tanpa Batas Kuota)",
      "Semua Fitur Terbuka Penuh Tanpa Batasan",
      "Multi-Cabang & Multi-Usaha Bebas Tanpa Batas",
      "Dual-Control Approval & Peran Kustom Penuh",
      "AI Vision Multimodal Gemini Cloud Tanpa Batas",
      "Ekspor Excel, PDF, CSV, & Akuntansi",
      "Akses Eksklusif Master Platform & Superadmin",
      "Masa Berlaku Selamanya (Lifetime Access)",
    ],
  },
}

export const DEFAULT_STUDIO_PROFILE: StudioProfile = {
  studioName: "Scota Business",
  tagline: "Digitalisasi Struk & Pengeluaran Usaha",
  address: "Jl. Bisnis No. 1, Jakarta",
  phone: "0812-3456-7890",
  invoiceFooter: "Terima kasih atas kerja sama Anda dengan usaha kami.",
}

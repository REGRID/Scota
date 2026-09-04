export type SubscriptionTier = "trial" | "starter" | "pro" | "enterprise"

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
  status: "active" | "expiring" | "expired" | "trial"
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
  maxUsers: number
  features: string[]
}

export const DEFAULT_APPROVAL_WORKFLOW: ApprovalWorkflowConfig = {
  enableApproval: true,
  approvalTargetRole: "ANY_ADMIN",
  approverTarget: "ANY_ADMIN",
  requireForCreate: true,
  requireForEdit: true,
  requireForDelete: true,
  requireForSettle: true,
  minAmountThreshold: 0,
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  trial: {
    name: "Trial / Percobaan",
    monthlyScanLimit: 30,
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 2,
    features: [
      "30 Scan Nota AI / bulan",
      "Katalog Kategori Otomatis",
      "Verifikasi & Persetujuan Admin",
      "Format PDF Standar",
    ],
  },
  starter: {
    name: "Starter Bisnis",
    monthlyScanLimit: 150,
    priceMonthly: 79000,
    priceYearly: 790000,
    maxUsers: 3,
    features: [
      "150 Scan Nota AI / bulan",
      "Kustomisasi Nama & Logo Usaha",
      "Ekspor Laporan PDF & Excel Resmi",
      "Multi-Akun (Admin, Karyawan, Kasir)",
      "PWA Notifikasi Kasir & Admin",
    ],
  },
  pro: {
    name: "Pro Usaha",
    monthlyScanLimit: 600,
    priceMonthly: 199000,
    priceYearly: 1990000,
    maxUsers: 10,
    features: [
      "600 Scan Nota AI / bulan",
      "AI Vision Multi-Foto & Faktur Panjang",
      "Custom Watermark Resmi Usaha di PDF",
      "Self-Learning AI Memory (Auto-Katalog)",
      "Pencadangan Otomatis & Export Akuntansi",
      "Dukungan WhatsApp Prioritas",
    ],
  },
  enterprise: {
    name: "Enterprise Multi-Cabang",
    monthlyScanLimit: 99999,
    priceMonthly: 499000,
    priceYearly: 4990000,
    maxUsers: 99,
    features: [
      "Unlimited Scan Nota AI",
      "Dukungan Multi-Cabang & Multi-Usaha",
      "Custom POS Sync / Webhook API",
      "Dedicated Database & SLA 99.9%",
      "Onboarding & Training Tim Khusus",
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

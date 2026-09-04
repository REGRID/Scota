/**
 * Dynamic configuration for Platform Support & WhatsApp Sales
 */
export const DEFAULT_SUPPORT_WHATSAPP = "6285215973776"

export function normalizeWhatsAppNumber(raw: string): string {
  let clean = (raw || "").replace(/[^\d+]/g, "")
  if (clean.startsWith("+")) {
    clean = clean.substring(1)
  }
  if (clean.startsWith("0")) {
    clean = "62" + clean.substring(1)
  }
  return clean || DEFAULT_SUPPORT_WHATSAPP
}

export function getSupportWhatsAppNumber(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("scota_support_whatsapp")
    if (saved && saved.trim()) {
      return normalizeWhatsAppNumber(saved)
    }
  }

  const envNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
  if (envNumber) {
    return normalizeWhatsAppNumber(envNumber)
  }

  return DEFAULT_SUPPORT_WHATSAPP
}

export function setSupportWhatsAppNumber(newNumber: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("scota_support_whatsapp", normalizeWhatsAppNumber(newNumber))
  }
}

import { NextRequest, NextResponse } from "next/server"
import { sendWebPushNotification } from "@/lib/serverPush"
import { requireRole } from "@/lib/roleGuard"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const {
      title = "Pengujian Notifikasi HP (Background Push)",
      message = "Notifikasi berhasil masuk ke HP meskipun aplikasi dalam keadaan tertutup!",
      url = "/",
      delaySeconds = 0,
    } = body

    // 1. Validasi URL: harus path internal (diawali '/') dan tidak boleh eksternal atau protocol-relative ('//')
    if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
      return NextResponse.json(
        { error: "Parameter URL tidak valid. Hanya path internal relatif (diawali '/') yang diizinkan." },
        { status: 400 }
      )
    }

    // 2. Batasi panjang title dan message untuk mencegah penyalahgunaan
    if (typeof title !== "string" || title.length > 100) {
      return NextResponse.json(
        { error: "Judul notifikasi maksimal 100 karakter." },
        { status: 400 }
      )
    }

    if (typeof message !== "string" || message.length > 300) {
      return NextResponse.json(
        { error: "Isi pesan notifikasi maksimal 300 karakter." },
        { status: 400 }
      )
    }

    const safeDelaySeconds = Math.min(Math.max(Number(delaySeconds) || 0, 0), 60)

    if (safeDelaySeconds > 0) {
      // Delay execution in background
      setTimeout(async () => {
        await sendWebPushNotification({
          tenantId: auth.tenantId,
          title,
          message,
          url,
          tag: `test-push-${Date.now()}`,
        }).catch((err) => console.warn("[Delayed Test Push Error]:", err))
      }, safeDelaySeconds * 1000)

      return NextResponse.json({
        success: true,
        delayed: true,
        message: `Notifikasi push dijadwalkan dalam ${safeDelaySeconds} detik. Silakan kunci layar HP atau tutup aplikasi sekarang untuk menguji!`,
      })
    }

    const result = await sendWebPushNotification({
      tenantId: auth.tenantId,
      title,
      message,
      url,
      tag: `test-push-${Date.now()}`,
    })

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error("[API push/test error]:", err)
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

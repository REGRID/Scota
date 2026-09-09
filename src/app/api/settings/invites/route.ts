import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { createInviteLink, getTenantInvites } from "@/lib/inviteSystem"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    const invites = await getTenantInvites(auth.tenantId)
    return NextResponse.json({ invites })
  } catch (error: any) {
    console.error("GET /api/settings/invites error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat daftar undangan" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const rawRole = (body.role || "KARYAWAN").trim().toUpperCase()
    const maxUses = body.maxUses ? parseInt(body.maxUses, 10) : null
    const expiresInDays = body.expiresInDays ? parseInt(body.expiresInDays, 10) : 3

    // Strict policy: Only OWNER can generate an invite for role ADMIN
    if (rawRole === "ADMIN" && auth.userRole !== "OWNER" && auth.userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat membuat link undangan untuk peran Admin." },
        { status: 403 }
      )
    }

    const result = await createInviteLink({
      tenantId: auth.tenantId,
      role: rawRole,
      maxUses,
      expiresInDays,
    })

    if (!result.success || !result.invite) {
      return NextResponse.json({ error: result.error || "Gagal membuat link undangan" }, { status: 400 })
    }

    return NextResponse.json(
      {
        message: `Link undangan untuk peran ${rawRole} berhasil dibuat.`,
        invite: result.invite,
        url: result.url,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST /api/settings/invites error:", error)
    return NextResponse.json({ error: error.message || "Gagal membuat tautan undangan" }, { status: 500 })
  }
}

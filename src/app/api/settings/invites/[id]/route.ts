import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/roleGuard"
import { revokeInviteLink } from "@/lib/inviteSystem"

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, "manage_staff")
    if (!auth.ok) return auth.response

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID undangan wajib disertakan" }, { status: 400 })
    }

    const result = await revokeInviteLink(id, auth.tenantId)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Gagal menonaktifkan link undangan" }, { status: 400 })
    }

    return NextResponse.json({ message: "Link undangan berhasil dinonaktifkan." })
  } catch (error: any) {
    console.error("DELETE /api/settings/invites/[id] error:", error)
    return NextResponse.json({ error: error.message || "Gagal menonaktifkan link undangan" }, { status: 500 })
  }
}

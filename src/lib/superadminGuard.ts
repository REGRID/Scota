import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { isSuperadminUser } from "@/lib/superadmin"

/**
 * Verifies that the incoming request is authenticated with a valid signed JWT session
 * and has Superadmin / Developer privileges.
 */
export async function requireSuperadmin(
  req: NextRequest
): Promise<{ ok: true; username: string } | { ok: false; response: NextResponse }> {
  const session = await getSession(req)

  if (!session || !session.username) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Akses ditolak. Sesi tidak valid atau belum login." }, { status: 401 }),
    }
  }

  const isSuperadmin = session.role === "SUPERADMIN" || (await isSuperadminUser(session.username))
  if (!isSuperadmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak. Endpoint ini khusus untuk hak akses Superadmin / Developer." },
        { status: 403 }
      ),
    }
  }

  return { ok: true, username: session.username }
}

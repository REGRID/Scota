import { NextRequest, NextResponse } from "next/server"
import { isSuperadminUser } from "@/lib/superadmin"
import { validateAdminCredentials } from "@/lib/adminAccounts"

/**
 * Verifies that the incoming request is authenticated and has Superadmin / Developer privileges.
 * Validates credentials against active database records and configuration.
 */
export async function requireSuperadmin(
  req: NextRequest
): Promise<{ ok: true; username: string } | { ok: false; response: NextResponse }> {
  const authHeader = req.headers.get("authorization") || ""
  const sessionCookie = req.cookies.get("nota_admin_session")?.value || ""
  const token = authHeader.replace("Bearer ", "") || sessionCookie

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Akses ditolak. Silakan login terlebih dahulu." }, { status: 401 }),
    }
  }

  let username = ""
  let password = ""
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const parts = decoded.split(":")
    username = (parts[0] || "").trim().toLowerCase()
    password = (parts[1] || "").trim()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Token sesi tidak valid." }, { status: 401 }),
    }
  }

  if (!username || !password) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Kredensial sesi tidak lengkap." }, { status: 401 }),
    }
  }

  // 1. Verify credentials against primary store
  const isValidCredential = await validateAdminCredentials(username, password)
  if (!isValidCredential) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sesi tidak valid atau telah kedaluwarsa." }, { status: 401 }),
    }
  }

  // 2. Verify Superadmin privileges
  const isSuperadmin = await isSuperadminUser(username)
  if (!isSuperadmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak. Endpoint ini khusus untuk hak akses Superadmin / Developer." },
        { status: 403 }
      ),
    }
  }

  return { ok: true, username }
}

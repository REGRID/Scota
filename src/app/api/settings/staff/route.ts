import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { hashPassword } from "@/lib/password"

const ALLOWED_STAFF_ROLES = ["KARYAWAN", "MANAGER", "ADMIN"]

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const res = await queryPg<{
      id: string
      username: string
      role: string
      fullName: string | null
      phone: string | null
      email: string | null
      status: string | null
      createdAt: string
    }>(
      `SELECT 
        id, 
        username, 
        role, 
        "fullName", 
        phone, 
        email, 
        status, 
        "createdAt"
      FROM admin_accounts
      WHERE "tenantId" = $1
      ORDER BY "createdAt" ASC`,
      [auth.tenantId]
    )

    return NextResponse.json({
      staff: res.rows || [],
    })
  } catch (error: any) {
    console.error("GET /api/settings/staff Error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal memuat daftar staf" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const body = await req.json()
    const rawUsername = (body.username || "").trim().toLowerCase()
    const password = (body.password || body.pin || "").trim()
    const rawRole = (body.role || "KARYAWAN").toUpperCase().trim()
    const fullName = (body.fullName || body.name || "").trim()
    const phone = (body.phone || "").trim() || null
    const email = (body.email || "").trim().toLowerCase() || null

    if (!rawUsername || rawUsername.length < 3) {
      return NextResponse.json(
        { error: "Username wajib diisi minimal 3 karakter (hanya huruf, angka, dan underscore)." },
        { status: 400 }
      )
    }

    if (!/^[a-z0-9_]+$/.test(rawUsername)) {
      return NextResponse.json(
        { error: "Username hanya boleh mengandung huruf kecil, angka, dan underscore (_)." },
        { status: 400 }
      )
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "Password atau PIN wajib diisi minimal 4 karakter." },
        { status: 400 }
      )
    }

    if (!ALLOWED_STAFF_ROLES.includes(rawRole)) {
      return NextResponse.json(
        { error: `Role tidak valid. Role yang diizinkan untuk staf: ${ALLOWED_STAFF_ROLES.join(", ")}.` },
        { status: 400 }
      )
    }

    // Check username collision
    const existing = await queryPg(
      `SELECT id FROM admin_accounts WHERE LOWER(username) = $1`,
      [rawUsername]
    )
    if (existing.rows && existing.rows.length > 0) {
      return NextResponse.json(
        { error: `Username '${rawUsername}' sudah digunakan. Silakan gunakan username lain.` },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const insertRes = await queryPg<{
      id: string
      username: string
      role: string
      fullName: string | null
      phone: string | null
      email: string | null
      status: string | null
      createdAt: string
    }>(
      `INSERT INTO admin_accounts (
        "tenantId", username, password, role, "fullName", phone, email, status, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
      RETURNING id, username, role, "fullName", phone, email, status, "createdAt"`,
      [auth.tenantId, rawUsername, hashedPassword, rawRole, fullName || rawUsername, phone, email]
    )

    return NextResponse.json(
      {
        message: `Staf ${rawUsername} dengan role ${rawRole} berhasil ditambahkan.`,
        account: insertRes.rows[0],
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST /api/settings/staff Error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal menambahkan akun staf" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    let targetId = searchParams.get("id")
    let targetUsername = searchParams.get("username")

    if (!targetId && !targetUsername) {
      try {
        const body = await req.json()
        targetId = body.id
        targetUsername = body.username
      } catch {}
    }

    if (!targetId && !targetUsername) {
      return NextResponse.json(
        { error: "ID atau Username staf yang akan dihapus wajib disertakan." },
        { status: 400 }
      )
    }

    // Prevent self-deletion if matching username is directly supplied
    if (targetUsername && targetUsername.toLowerCase() === auth.username.toLowerCase()) {
      return NextResponse.json(
        { error: "Aksi ditolak: Anda tidak dapat menghapus akun Anda sendiri saat sedang login." },
        { status: 400 }
      )
    }

    // Find target account
    const findRes = await queryPg<{ id: string; username: string; role: string; tenantId: string }>(
      targetId
        ? `SELECT id, username, role, "tenantId" FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`
        : `SELECT id, username, role, "tenantId" FROM admin_accounts WHERE LOWER(username) = $1 AND "tenantId" = $2`,
      targetId ? [targetId, auth.tenantId] : [targetUsername!.toLowerCase(), auth.tenantId]
    )

    const targetAccount = findRes.rows?.[0]
    if (!targetAccount) {
      return NextResponse.json(
        { error: "Akun staf tidak ditemukan di tenant Anda." },
        { status: 404 }
      )
    }

    // Prevent self-deletion by id
    if (targetAccount.username.toLowerCase() === auth.username.toLowerCase()) {
      return NextResponse.json(
        { error: "Aksi ditolak: Anda tidak dapat menghapus akun Anda sendiri saat sedang login." },
        { status: 400 }
      )
    }

    // Prevent deletion of OWNER or SUPERADMIN
    if (["OWNER", "SUPERADMIN"].includes(targetAccount.role.toUpperCase())) {
      return NextResponse.json(
        { error: `Aksi ditolak: Akun dengan role '${targetAccount.role}' tidak dapat dihapus melalui antarmuka staf.` },
        { status: 403 }
      )
    }

    await queryPg(
      `DELETE FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`,
      [targetAccount.id, auth.tenantId]
    )

    return NextResponse.json({
      message: `Akun staf '${targetAccount.username}' berhasil dihapus.`,
      deletedId: targetAccount.id,
    })
  } catch (error: any) {
    console.error("DELETE /api/settings/staff Error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal menghapus akun staf" },
      { status: 500 }
    )
  }
}

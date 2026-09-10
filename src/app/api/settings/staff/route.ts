import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"
import { hashPassword } from "@/lib/password"

const ALLOWED_STAFF_ROLES = ["KARYAWAN", "KASIR", "MANAGER", "ADMIN"]

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    // 1. Get Tenant Owner ID to ensure Owner is never listed as a staff member (Prinsip #3 & #10)
    const tenantRes = await queryPg<{ ownerId: string | null }>(
      `SELECT "ownerId" FROM tenants WHERE id = $1`,
      [auth.tenantId]
    )
    const ownerId = tenantRes.rows?.[0]?.ownerId

    // 2. Query active single-tenant staff (from memberships JOIN users)
    const singleTenantStaffRes = await queryPg<{
      id: string
      userId: string
      username: string
      role: string
      roleName: string
      roleScope: string
      fullName: string | null
      phone: string | null
      email: string | null
      status: string
      createdAt: string
      source: string
    }>(
      `SELECT 
        m.id, 
        m."userId", 
        COALESCE(u.name, split_part(u.email, '@', 1)) as username, 
        COALESCE(r.name, m.role) as role, 
        COALESCE(r.name, m.role) as "roleName", 
        'SINGLE_TENANT' as "roleScope", 
        u.name as "fullName", 
        u.phone, 
        u.email, 
        m.status, 
        m."joinedAt" as "createdAt",
        'MEMBERSHIP' as source
      FROM memberships m
      JOIN users u ON u.id = m."userId"
      LEFT JOIN roles r ON r.id = m."roleId"
      WHERE m."tenantId" = $1 
        AND m.status = 'ACTIVE'
        AND ($2::uuid IS NULL OR m."userId" != $2::uuid)
      ORDER BY m."joinedAt" ASC`,
      [auth.tenantId, ownerId]
    )

    // 3. Query active multi-tenant staff grants (from tenant_access_grants JOIN users)
    const multiTenantStaffRes = await queryPg<{
      id: string
      userId: string
      username: string
      role: string
      roleName: string
      roleScope: string
      fullName: string | null
      phone: string | null
      email: string | null
      status: string
      createdAt: string
      source: string
    }>(
      `SELECT 
        g.id, 
        g."userId", 
        COALESCE(u.name, split_part(u.email, '@', 1)) as username, 
        COALESCE(r.name, 'Multi-Tenant Staff') as role, 
        COALESCE(r.name, 'Multi-Tenant Staff') as "roleName", 
        'MULTI_TENANT' as "roleScope", 
        u.name as "fullName", 
        u.phone, 
        u.email, 
        g.status, 
        g."createdAt",
        'ACCESS_GRANT' as source
      FROM tenant_access_grants g
      JOIN users u ON u.id = g."userId"
      LEFT JOIN roles r ON r.id = g."roleId"
      WHERE g."tenantId" = $1 
        AND g.status = 'ACTIVE'
        AND ($2::uuid IS NULL OR g."userId" != $2::uuid)
      ORDER BY g."createdAt" ASC`,
      [auth.tenantId, ownerId]
    )

    const allActiveStaff = [
      ...(singleTenantStaffRes.rows || []),
      ...(multiTenantStaffRes.rows || []),
    ]

    // 4. Query staff pending owner approval from both memberships and grants (Bab 9)
    const pendingMemberships = await queryPg<{
      id: string
      userId: string
      role: string
      roleScope: string
      status: string
      joinedAt: string
      name: string
      email: string
      avatarUrl: string | null
      source: string
    }>(
      `SELECT 
        m.id, 
        m."userId", 
        COALESCE(r.name, m.role) as role, 
        'SINGLE_TENANT' as "roleScope",
        m.status, 
        m."joinedAt",
        u.name, 
        u.email, 
        u."avatarUrl",
        'MEMBERSHIP' as source
       FROM memberships m
       JOIN users u ON u.id = m."userId"
       LEFT JOIN roles r ON r.id = m."roleId"
       WHERE m."tenantId" = $1 AND m.status = 'PENDING_APPROVAL'
       ORDER BY m."joinedAt" ASC`,
      [auth.tenantId]
    )

    const pendingGrants = await queryPg<{
      id: string
      userId: string
      role: string
      roleScope: string
      status: string
      joinedAt: string
      name: string
      email: string
      avatarUrl: string | null
      source: string
    }>(
      `SELECT 
        g.id, 
        g."userId", 
        COALESCE(r.name, 'Multi-Tenant Staff') as role, 
        'MULTI_TENANT' as "roleScope",
        g.status, 
        g."createdAt" as "joinedAt",
        u.name, 
        u.email, 
        u."avatarUrl",
        'ACCESS_GRANT' as source
       FROM tenant_access_grants g
       JOIN users u ON u.id = g."userId"
       LEFT JOIN roles r ON r.id = g."roleId"
       WHERE g."tenantId" = $1 AND g.status = 'PENDING_APPROVAL'
       ORDER BY g."createdAt" ASC`,
      [auth.tenantId]
    )

    const allPendingStaff = [
      ...(pendingMemberships.rows || []),
      ...(pendingGrants.rows || []),
    ]

    return NextResponse.json({
      staff: allActiveStaff,
      pendingStaff: allPendingStaff,
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

    if (rawRole === "ADMIN" && auth.userRole !== "OWNER" && auth.userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat memberikan role Admin." },
        { status: 403 }
      )
    }

    // Check staff count limit based on subscription tier
    const { getSubscriptionInfo } = await import("@/lib/subscriptionServer")
    const { TIER_CONFIG } = await import("@/lib/subscription")
    const sub = await getSubscriptionInfo(auth.tenantId)
    const tierConfig = TIER_CONFIG[sub.tier] || TIER_CONFIG.trial
    const maxUsers = tierConfig.maxUsers || 2

    const staffCountRes = await queryPg<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_accounts WHERE "tenantId" = $1`,
      [auth.tenantId]
    )
    const currentStaffCount = parseInt(staffCountRes.rows?.[0]?.count || "0", 10)

    if (currentStaffCount >= maxUsers) {
      return NextResponse.json(
        {
          error: `Batas maksimal staf (${maxUsers} pengguna) untuk paket ${tierConfig.name} telah tercapai. Silakan upgrade paket Anda untuk menambah lebih banyak anggota tim.`,
          upgradeRequired: true,
        },
        { status: 403 }
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
    const findRes = await queryPg<{ id: string; username: string; role: string; tenantId: string; email: string | null; clerkId: string | null }>(
      targetId
        ? `SELECT id, username, role, "tenantId", email, "clerkId" FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`
        : `SELECT id, username, role, "tenantId", email, "clerkId" FROM admin_accounts WHERE LOWER(username) = $1 AND "tenantId" = $2`,
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

    // Only OWNER (or SUPERADMIN) can delete an ADMIN account
    if (targetAccount.role.toUpperCase() === "ADMIN" && auth.userRole !== "OWNER" && auth.userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat menghapus akun Admin." },
        { status: 403 }
      )
    }

    // Find owner user ID from users table (if available) for audit trail
    let ownerUserId: string | null = null
    try {
      const ownerRes = await queryPg<{ id: string }>(
        `SELECT id FROM users WHERE "clerkId" = $1 OR email = $2 LIMIT 1`,
        [auth.username, auth.username]
      )
      ownerUserId = ownerRes.rows?.[0]?.id || null
    } catch {}

    // Execute Archival & Deletion in an atomic transaction (Bab 4.D & Spec 4)
    const deletionResult = await withTransactionPg(async (client) => {
      // Check if targetId directly belongs to memberships
      if (targetId) {
        const directMem = await client.query(
          `SELECT m.id, m."tenantId", m."userId", m.role, m."roleId", m."joinedAt", u.name as username
           FROM memberships m
           JOIN users u ON u.id = m."userId"
           WHERE m.id = $1 AND m."tenantId" = $2`,
          [targetId, auth.tenantId]
        )
        if (directMem.rows?.[0]) {
          const m = directMem.rows[0] as {
            id: string
            tenantId: string
            userId: string
            role: string
            roleId: string | null
            joinedAt: string
            username?: string
          }
          await client.query(
            `INSERT INTO membership_history (
              "tenantId", "userId", role, "roleId", "sourceTable", "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
            )
            VALUES ($1, $2, $3, $4, 'MEMBERSHIP', $5, NOW(), 'REMOVED_BY_OWNER', $6, NOW())`,
            [m.tenantId, m.userId, m.role, m.roleId, m.joinedAt, ownerUserId]
          )
          await client.query(`DELETE FROM memberships WHERE id = $1`, [m.id])
          return { deleted: true, name: m.username || "Staf" }
        }

        // Check if targetId belongs to tenant_access_grants
        const directGrant = await client.query(
          `SELECT g.id, g."tenantId", g."userId", g."roleId", r.name as "roleName", g."createdAt", u.name as username
           FROM tenant_access_grants g
           JOIN users u ON u.id = g."userId"
           LEFT JOIN roles r ON r.id = g."roleId"
           WHERE g.id = $1 AND g."tenantId" = $2`,
          [targetId, auth.tenantId]
        )
        if (directGrant.rows?.[0]) {
          const g = directGrant.rows[0] as {
            id: string
            tenantId: string
            userId: string
            roleId: string
            roleName: string
            createdAt: string
            username?: string
          }
          await client.query(
            `INSERT INTO membership_history (
              "tenantId", "userId", role, "roleId", "sourceTable", "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
            )
            VALUES ($1, $2, $3, $4, 'ACCESS_GRANT', $5, NOW(), 'REMOVED_BY_OWNER', $6, NOW())`,
            [g.tenantId, g.userId, g.roleName || "Multi-Tenant Staff", g.roleId, g.createdAt, ownerUserId]
          )
          await client.query(`DELETE FROM tenant_access_grants WHERE id = $1`, [g.id])
          return { deleted: true, name: g.username || "Staf Multi-Tenant" }
        }
      }

      // Fallback: Check admin_accounts
      const findRes = await client.query(
        targetId
          ? `SELECT id, username, role, email, "clerkId" FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`
          : `SELECT id, username, role, email, "clerkId" FROM admin_accounts WHERE LOWER(username) = $1 AND "tenantId" = $2`,
        targetId ? [targetId, auth.tenantId] : [targetUsername!.toLowerCase(), auth.tenantId]
      )

      const targetAccount = findRes.rows?.[0] as { id: string; username: string; role: string; email: string | null; clerkId: string | null } | undefined
      if (targetAccount) {
        if (["OWNER", "SUPERADMIN"].includes(targetAccount.role.toUpperCase())) {
          throw new Error(`Akun dengan role '${targetAccount.role}' tidak dapat dihapus melalui antarmuka staf.`)
        }

        // Archive matching membership if present
        if (targetAccount.email || targetAccount.clerkId) {
          const memRes = await client.query(
            `SELECT m.id, m."tenantId", m."userId", m.role, m."joinedAt"
             FROM memberships m
             WHERE m."tenantId" = $1 
             AND m."userId" IN (
               SELECT id FROM users 
               WHERE (email = $2 AND $2 IS NOT NULL) 
                  OR ("clerkId" = $3 AND $3 IS NOT NULL)
             )
             LIMIT 1`,
            [auth.tenantId, targetAccount.email, targetAccount.clerkId]
          )
          const activeMembership = memRes.rows?.[0] as { id: string; tenantId: string; userId: string; role: string; joinedAt: string } | undefined
          if (activeMembership) {
            await client.query(
              `INSERT INTO membership_history (
                "tenantId", "userId", role, "sourceTable", "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
              )
              VALUES ($1, $2, $3, 'MEMBERSHIP', $4, NOW(), 'REMOVED_BY_OWNER', $5, NOW())`,
              [activeMembership.tenantId, activeMembership.userId, activeMembership.role, activeMembership.joinedAt, ownerUserId]
            )
            await client.query(`DELETE FROM memberships WHERE id = $1`, [activeMembership.id])
          }
        }

        await client.query(
          `DELETE FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`,
          [targetAccount.id, auth.tenantId]
        )
        return { deleted: true, name: targetAccount.username }
      }

      return { deleted: false, name: null }
    })

    if (!deletionResult.deleted) {
      return NextResponse.json(
        { error: "Akun staf tidak ditemukan di tenant Anda." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `Akun staf '${deletionResult.name}' berhasil dihapus dan diarsipkan ke riwayat kepegawaian.`,
      deletedId: targetId,
    })
  } catch (error: any) {
    console.error("DELETE /api/settings/staff Error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal menghapus akun staf" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const targetId = body.id ? String(body.id).trim() : null
    const targetUsername = body.username ? String(body.username).trim() : null
    const rawNewRole = body.newRole || body.role

    if (!targetId && !targetUsername) {
      return NextResponse.json(
        { error: "ID atau Username staf yang akan diubah wajib disertakan." },
        { status: 400 }
      )
    }

    if (!rawNewRole || typeof rawNewRole !== "string") {
      return NextResponse.json(
        { error: "Role baru (newRole) wajib disertakan." },
        { status: 400 }
      )
    }

    const newRole = rawNewRole.trim().toUpperCase()

    if (!ALLOWED_STAFF_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Role tidak valid. Role yang diizinkan untuk staf: ${ALLOWED_STAFF_ROLES.join(", ")}.` },
        { status: 400 }
      )
    }

    // Prevent self-role change if username is directly supplied
    if (targetUsername && targetUsername.toLowerCase() === auth.username.toLowerCase()) {
      return NextResponse.json(
        { error: "Aksi ditolak: Anda tidak dapat mengubah role akun Anda sendiri saat sedang login." },
        { status: 400 }
      )
    }

    // Find target account
    const findRes = await queryPg<{ id: string; username: string; role: string; tenantId: string; email: string | null; clerkId: string | null }>(
      targetId
        ? `SELECT id, username, role, "tenantId", email, "clerkId" FROM admin_accounts WHERE id = $1 AND "tenantId" = $2`
        : `SELECT id, username, role, "tenantId", email, "clerkId" FROM admin_accounts WHERE LOWER(username) = $1 AND "tenantId" = $2`,
      targetId ? [targetId, auth.tenantId] : [targetUsername!.toLowerCase(), auth.tenantId]
    )

    const targetAccount = findRes.rows?.[0]
    if (!targetAccount) {
      return NextResponse.json(
        { error: "Akun staf tidak ditemukan di tenant Anda." },
        { status: 404 }
      )
    }

    // Prevent self-role change by id
    if (targetAccount.username.toLowerCase() === auth.username.toLowerCase()) {
      return NextResponse.json(
        { error: "Aksi ditolak: Anda tidak dapat mengubah role akun Anda sendiri saat sedang login." },
        { status: 400 }
      )
    }

    const currentRole = targetAccount.role.toUpperCase()

    // Prevent modifying role of OWNER or SUPERADMIN
    if (["OWNER", "SUPERADMIN"].includes(currentRole)) {
      return NextResponse.json(
        { error: `Aksi ditolak: Role akun '${targetAccount.role}' tidak dapat diubah melalui antarmuka staf.` },
        { status: 403 }
      )
    }

    // Only OWNER (or SUPERADMIN) can promote to ADMIN
    if (newRole === "ADMIN" && auth.userRole !== "OWNER" && auth.userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat memberikan role Admin." },
        { status: 403 }
      )
    }

    // Only OWNER (or SUPERADMIN) can demote an ADMIN
    if (currentRole === "ADMIN" && newRole !== "ADMIN" && auth.userRole !== "OWNER" && auth.userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat mencabut role Admin." },
        { status: 403 }
      )
    }

    // 1. Update in admin_accounts
    const updateRes = await queryPg<{
      id: string
      username: string
      role: string
      fullName: string | null
      phone: string | null
      email: string | null
      status: string | null
      createdAt: string
      updatedAt: string
    }>(
      `UPDATE admin_accounts 
       SET role = $1, "updatedAt" = NOW() 
       WHERE id = $2 AND "tenantId" = $3 
       RETURNING id, username, role, "fullName", phone, email, status, "createdAt", "updatedAt"`,
      [newRole, targetAccount.id, auth.tenantId]
    )

    // 2. Also update in memberships table
    if (targetAccount.email || targetAccount.clerkId) {
      await queryPg(
        `UPDATE memberships 
         SET role = $1, "updatedAt" = NOW()
         WHERE "tenantId" = $2 
         AND "userId" IN (
           SELECT id FROM users 
           WHERE (email = $3 AND $3 IS NOT NULL) 
              OR ("clerkId" = $4 AND $4 IS NOT NULL)
         )`,
        [newRole, auth.tenantId, targetAccount.email, targetAccount.clerkId]
      )
    }

    return NextResponse.json({
      message: `Role akun '${targetAccount.username}' berhasil diubah menjadi '${newRole}'.`,
      account: updateRes.rows[0],
    })
  } catch (error: any) {
    console.error("PATCH /api/settings/staff Error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui role staf" },
      { status: 500 }
    )
  }
}


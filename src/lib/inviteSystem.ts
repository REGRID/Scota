import crypto from "crypto"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export interface InviteLinkRecord {
  id: string
  tenantId: string
  role: string
  token: string
  createdBy: string | null
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  status: "ACTIVE" | "DISABLED" | "EXPIRED"
  createdAt: string
  updatedAt: string
}

export const ALLOWED_INVITE_ROLES = ["KARYAWAN", "MANAGER", "ADMIN"]

/**
 * Generate a new invite link for a tenant with predetermined role and usage constraints.
 */
export async function createInviteLink(params: {
  tenantId: string
  role: string
  createdByUserId?: string | null
  maxUses?: number | null
  expiresInDays?: number | null
}): Promise<{ success: boolean; invite?: InviteLinkRecord; url?: string; error?: string }> {
  try {
    if (!isDatabaseConfigured) {
      return { success: false, error: "Database belum terkonfigurasi." }
    }

    const cleanRole = (params.role || "KARYAWAN").trim().toUpperCase()
    if (!ALLOWED_INVITE_ROLES.includes(cleanRole)) {
      return { success: false, error: `Role tidak valid. Role yang diizinkan: ${ALLOWED_INVITE_ROLES.join(", ")}.` }
    }

    const token = crypto.randomBytes(16).toString("hex")
    const maxUses = typeof params.maxUses === "number" && params.maxUses > 0 ? params.maxUses : null

    let expiresAt: Date | null = null
    if (typeof params.expiresInDays === "number" && params.expiresInDays > 0) {
      expiresAt = new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    }

    const res = await queryPg<InviteLinkRecord>(
      `INSERT INTO invite_links (
        "tenantId", role, token, "createdBy", "maxUses", "usedCount", "expiresAt", status, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, 0, $6, 'ACTIVE', NOW(), NOW())
      RETURNING id, "tenantId", role, token, "createdBy", "maxUses", "usedCount", "expiresAt", status, "createdAt", "updatedAt"`,
      [params.tenantId, cleanRole, token, params.createdByUserId || null, maxUses, expiresAt]
    )

    const invite = res.rows[0]
    return {
      success: true,
      invite,
      url: `/join/${token}`,
    }
  } catch (err: any) {
    console.error("[InviteSystem] createInviteLink error:", err)
    return { success: false, error: err.message || "Gagal membuat tautan undangan." }
  }
}

/**
 * List all active/recent invite links for a specific tenant.
 */
export async function getTenantInvites(tenantId: string): Promise<InviteLinkRecord[]> {
  try {
    if (!isDatabaseConfigured) return []
    const res = await queryPg<InviteLinkRecord>(
      `SELECT id, "tenantId", role, token, "createdBy", "maxUses", "usedCount", "expiresAt", status, "createdAt", "updatedAt"
       FROM invite_links
       WHERE "tenantId" = $1
       ORDER BY "createdAt" DESC`,
      [tenantId]
    )
    return res.rows || []
  } catch (err) {
    console.error("[InviteSystem] getTenantInvites error:", err)
    return []
  }
}

/**
 * Revoke or disable an invite link.
 */
export async function revokeInviteLink(inviteId: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isDatabaseConfigured) return { success: false, error: "Database belum terkonfigurasi." }
    const res = await queryPg(
      `UPDATE invite_links
       SET status = 'DISABLED', "updatedAt" = NOW()
       WHERE id = $1 AND "tenantId" = $2
       RETURNING id`,
      [inviteId, tenantId]
    )
    if (!res.rows || res.rows.length === 0) {
      return { success: false, error: "Tautan undangan tidak ditemukan atau bukan milik tenant Anda." }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menonaktifkan tautan undangan." }
  }
}

/**
 * Validate an invite token prior to display or acceptance.
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean
  reason?: string
  invite?: {
    id: string
    role: string
    maxUses: number | null
    usedCount: number
    expiresAt: string | null
    status: string
  }
  tenant?: {
    id: string
    businessName: string
    tagline: string | null
    logoUrl: string | null
  }
}> {
  try {
    if (!isDatabaseConfigured) return { valid: false, reason: "Database belum terkonfigurasi." }

    const cleanToken = (token || "").trim()
    if (!cleanToken) return { valid: false, reason: "Token undangan tidak valid." }

    const res = await queryPg<{
      inviteId: string
      role: string
      maxUses: number | null
      usedCount: number
      expiresAt: string | null
      status: string
      tenantId: string
      businessName: string
      tagline: string | null
      logoUrl: string | null
    }>(
      `SELECT 
        i.id AS "inviteId", i.role, i."maxUses", i."usedCount", i."expiresAt", i.status,
        t.id AS "tenantId", t."businessName", t.tagline, t."logoUrl"
       FROM invite_links i
       JOIN tenants t ON t.id = i."tenantId"
       WHERE i.token = $1
       LIMIT 1`,
      [cleanToken]
    )

    const row = res.rows?.[0]
    if (!row) {
      return { valid: false, reason: "Tautan undangan tidak ditemukan." }
    }

    if (row.status === "DISABLED") {
      return { valid: false, reason: "Tautan undangan ini telah dinonaktifkan oleh pemilik toko." }
    }

    // Check expiration
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      await queryPg(`UPDATE invite_links SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`, [row.inviteId])
      return { valid: false, reason: "Tautan undangan ini telah kedaluwarsa." }
    }

    // Check usage limit
    if (row.maxUses !== null && row.usedCount >= row.maxUses) {
      await queryPg(`UPDATE invite_links SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`, [row.inviteId])
      return { valid: false, reason: "Tautan undangan ini telah mencapai batas maksimum penggunaan." }
    }

    return {
      valid: true,
      invite: {
        id: row.inviteId,
        role: row.role,
        maxUses: row.maxUses,
        usedCount: row.usedCount,
        expiresAt: row.expiresAt,
        status: row.status,
      },
      tenant: {
        id: row.tenantId,
        businessName: row.businessName,
        tagline: row.tagline,
        logoUrl: row.logoUrl,
      },
    }
  } catch (err: any) {
    console.error("[InviteSystem] validateInviteToken error:", err)
    return { valid: false, reason: "Terjadi kesalahan sistem saat memeriksa tautan undangan." }
  }
}

/**
 * Accept invite and bind user to tenant membership with strict anti-overlap enforcement.
 */
export async function acceptInvite(params: {
  token: string
  clerkUser: {
    clerkId: string
    email: string
    name: string
    avatarUrl?: string
  }
}): Promise<{
  success: boolean
  error?: string
  code?: string
  tenantId?: string
  role?: string
  businessName?: string
}> {
  try {
    if (!isDatabaseConfigured) {
      return { success: false, error: "Database belum terkonfigurasi." }
    }

    const { token, clerkUser } = params
    const cleanToken = token.trim()
    const cleanEmail = clerkUser.email.trim().toLowerCase()
    const cleanName = clerkUser.name.trim() || cleanEmail

    return await withTransactionPg(async (client) => {
      // 1. Lock and validate invite row
      const invRes = await client.query(
        `SELECT 
          i.id, i."tenantId", i.role, i."maxUses", i."usedCount", i."expiresAt", i.status,
          t."businessName"
         FROM invite_links i
         JOIN tenants t ON t.id = i."tenantId"
         WHERE i.token = $1
         FOR UPDATE`,
        [cleanToken]
      )

      const invite = invRes.rows?.[0]
      if (!invite) {
        return { success: false, error: "Tautan undangan tidak ditemukan." }
      }

      if (invite.status !== "ACTIVE") {
        return { success: false, error: "Tautan undangan sudah tidak aktif atau kedaluwarsa." }
      }

      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        await client.query(`UPDATE invite_links SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`, [invite.id])
        return { success: false, error: "Tautan undangan telah kedaluwarsa." }
      }

      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
        await client.query(`UPDATE invite_links SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`, [invite.id])
        return { success: false, error: "Tautan undangan telah mencapai batas maksimum penggunaan." }
      }

      // 2. Upsert user in users table
      const userRes = await client.query(
        `INSERT INTO users ("clerkId", email, name, "avatarUrl", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE 
         SET "clerkId" = COALESCE(EXCLUDED."clerkId", users."clerkId"),
             name = COALESCE(EXCLUDED.name, users.name),
             "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", users."avatarUrl"),
             "updatedAt" = NOW()
         RETURNING id, name`,
        [clerkUser.clerkId, cleanEmail, cleanName, clerkUser.avatarUrl || null]
      )
      const userId = userRes.rows[0].id

      // 3. Mutual Exclusivity Check (Prinsip #6):
      // Check A: Is this user already a staff member in ANY tenant?
      const existingMemberRes = await client.query(
        `SELECT m.role, t."businessName"
         FROM memberships m
         JOIN tenants t ON t.id = m."tenantId"
         WHERE m."userId" = $1
         LIMIT 1`,
        [userId]
      )
      if (existingMemberRes.rows?.[0]) {
        const m = existingMemberRes.rows[0]
        return {
          success: false,
          code: "ALREADY_STAFF",
          error: `Akun ini (${cleanEmail}) sudah terdaftar sebagai ${m.role} di toko "${m.businessName}". Satu akun staf hanya bisa terhubung ke satu toko. Hubungi pemilik toko lama jika Anda ingin berpindah.`,
        }
      }

      // Check B: Is this user an OWNER of ANY tenant?
      const existingOwnerRes = await client.query(
        `SELECT "businessName"
         FROM tenants
         WHERE "ownerId" = $1
         LIMIT 1`,
        [userId]
      )
      if (existingOwnerRes.rows?.[0]) {
        const o = existingOwnerRes.rows[0]
        return {
          success: false,
          code: "IS_OWNER",
          error: `Akun ini (${cleanEmail}) terdaftar sebagai pemilik toko "${o.businessName}". Akun pemilik bisnis tidak dapat didaftarkan sebagai staf di toko lain.`,
        }
      }

      // 4. Create membership record
      await client.query(
        `INSERT INTO memberships ("tenantId", "userId", role, status, "joinedAt", "updatedAt")
         VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())`,
        [invite.tenantId, userId, invite.role]
      )

      // 5. Dual-sync with admin_accounts for full backward-compatibility with receipts/logs
      const legacyUsername = `staff_${clerkUser.clerkId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`
      await client.query(
        `INSERT INTO admin_accounts (
          username, "clerkId", email, "fullName", role, "tenantId", status, password, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active', 'oauth_managed', NOW(), NOW())
        ON CONFLICT ("clerkId") DO UPDATE 
        SET role = EXCLUDED.role,
            "tenantId" = EXCLUDED."tenantId",
            "updatedAt" = NOW()`,
        [legacyUsername, clerkUser.clerkId, cleanEmail, cleanName, invite.role, invite.tenantId]
      )

      // 6. Increment invite link used count & check expiry
      const newUsedCount = invite.usedCount + 1
      const isNowExpired = invite.maxUses !== null && newUsedCount >= invite.maxUses
      await client.query(
        `UPDATE invite_links 
         SET "usedCount" = $1, 
             status = CASE WHEN $2 THEN 'EXPIRED' ELSE status END,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [newUsedCount, isNowExpired, invite.id]
      )

      // 7. Audit log in invite_usages
      await client.query(
        `INSERT INTO invite_usages ("inviteLinkId", "userId", "usedAt")
         VALUES ($1, $2, NOW())`,
        [invite.id, userId]
      )

      return {
        success: true,
        tenantId: invite.tenantId,
        role: invite.role,
        businessName: invite.businessName,
      }
    })
  } catch (err: any) {
    console.error("[InviteSystem] acceptInvite error:", err)
    return { success: false, error: err.message || "Terjadi kesalahan saat menerima undangan." }
  }
}

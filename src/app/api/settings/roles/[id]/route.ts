import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getEffectiveTenantFeatures } from "@/lib/dynamicRoles"

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID peran wajib disertakan" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const newName = body.name ? String(body.name).trim() : undefined
    const requiresApproval = typeof body.requiresApproval === "boolean" ? body.requiresApproval : undefined
    const permissionCodes: string[] | undefined = Array.isArray(body.permissions) ? body.permissions : undefined

    // 1. Verify role belongs to this tenant
    const roleRes = await queryPg<{
      id: string
      tenantId: string
      name: string
      scope: string
      requiresApproval: boolean
      isSystemDefault: boolean
    }>(
      `SELECT id, "tenantId", name, scope, "requiresApproval", "isSystemDefault" 
       FROM roles 
       WHERE id = $1 AND "tenantId" = $2`,
      [id, auth.tenantId]
    )

    const existingRole = roleRes.rows?.[0]
    if (!existingRole) {
      return NextResponse.json({ error: "Peran tidak ditemukan pada cabang ini." }, { status: 404 })
    }

    // 2. Validate role name constraints
    if (newName !== undefined) {
      if (newName.length < 2) {
        return NextResponse.json({ error: "Nama peran minimal 2 karakter." }, { status: 400 })
      }
      const upper = newName.toUpperCase()
      if (upper === "SUPERADMIN" || upper === "DEVELOPER") {
        return NextResponse.json({ error: "Nama peran 'SUPERADMIN' hanya untuk akses developer platform." }, { status: 400 })
      }
      if (upper === "OWNER" || upper === "PEMILIK") {
        return NextResponse.json({ error: "Nama peran 'OWNER' tidak dapat digunakan." }, { status: 400 })
      }
    }

    // 3. Bab 11.6: Validate permissionCodes against owner-only forbidden permissions
    if (permissionCodes && permissionCodes.length > 0) {
      const ownerOnlyCheck = await queryPg<{ code: string }>(
        `SELECT code FROM permissions WHERE code = ANY($1::text[]) AND "isOwnerOnly" = TRUE`,
        [permissionCodes]
      )
      if ((ownerOnlyCheck.rows || []).length > 0) {
        const forbidden = ownerOnlyCheck.rows.map((r) => r.code).join(", ")
        return NextResponse.json(
          { error: `Izin berikut hanya untuk Pemilik Toko (Owner) dan tidak boleh diberikan ke peran staf: ${forbidden}.` },
          { status: 400 }
        )
      }
    }

    // 4. Check feature flags
    const effectiveFeatures = await getEffectiveTenantFeatures(auth.tenantId)
    if (permissionCodes !== undefined && !effectiveFeatures.custom_permissions) {
      return NextResponse.json(
        { error: "Fitur penyesuaian izin peran (custom_permissions) memerlukan paket Enterprise." },
        { status: 403 }
      )
    }

    // 5. Atomic Update
    return await withTransactionPg(async (client) => {
      // Update role record
      if (newName !== undefined || requiresApproval !== undefined) {
        await client.query(
          `UPDATE roles
           SET name = COALESCE($1, name),
               "requiresApproval" = COALESCE($2, "requiresApproval"),
               "updatedAt" = NOW()
           WHERE id = $3`,
          [newName || null, requiresApproval !== undefined ? requiresApproval : null, id]
        )
      }

      // Update permissions if provided
      if (permissionCodes !== undefined) {
        await client.query(`DELETE FROM role_permissions WHERE "roleId" = $1`, [id])
        for (const code of permissionCodes) {
          await client.query(
            `INSERT INTO role_permissions ("roleId", "permissionCode")
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [id, code]
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: `Peran '${newName || existingRole.name}' berhasil diperbarui.`,
        roleId: id,
      })
    })
  } catch (error: any) {
    console.error("PATCH /api/settings/roles/[id] error:", error)
    return NextResponse.json({ error: error.message || "Gagal memperbarui peran" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID peran wajib disertakan" }, { status: 400 })
    }

    // 1. Verify role belongs to tenant
    const roleRes = await queryPg<{
      id: string
      tenantId: string
      name: string
      isSystemDefault: boolean
    }>(
      `SELECT id, "tenantId", name, "isSystemDefault" 
       FROM roles 
       WHERE id = $1 AND "tenantId" = $2`,
      [id, auth.tenantId]
    )

    const role = roleRes.rows?.[0]
    if (!role) {
      return NextResponse.json({ error: "Peran tidak ditemukan pada cabang ini." }, { status: 404 })
    }

    if (role.isSystemDefault) {
      return NextResponse.json(
        { error: `Peran bawaan sistem '${role.name}' tidak dapat dihapus.` },
        { status: 400 }
      )
    }

    // 2. Check if active staff are currently using this role
    const memCheck = await queryPg<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM memberships WHERE "roleId" = $1 AND status = 'ACTIVE'`,
      [id]
    )
    const grantCheck = await queryPg<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM tenant_access_grants WHERE "roleId" = $1 AND status = 'ACTIVE'`,
      [id]
    )

    const activeCount = parseInt(memCheck.rows?.[0]?.count || "0", 10) + parseInt(grantCheck.rows?.[0]?.count || "0", 10)
    if (activeCount > 0) {
      return NextResponse.json(
        {
          error: `Peran '${role.name}' sedang digunakan oleh ${activeCount} staf aktif. Pindahkan staf tersebut ke peran lain sebelum menghapus peran ini.`,
        },
        { status: 400 }
      )
    }

    // 3. Delete role in transaction
    return await withTransactionPg(async (client) => {
      // Deactivate any active invite links with this role
      await client.query(
        `UPDATE invite_links SET status = 'DISABLED', "updatedAt" = NOW() WHERE "roleId" = $1`,
        [id]
      )

      // Delete role (cascades to role_permissions)
      await client.query(`DELETE FROM roles WHERE id = $1`, [id])

      return NextResponse.json({
        success: true,
        message: `Peran '${role.name}' berhasil dihapus.`,
      })
    })
  } catch (error: any) {
    console.error("DELETE /api/settings/roles/[id] error:", error)
    return NextResponse.json({ error: error.message || "Gagal menghapus peran" }, { status: 500 })
  }
}

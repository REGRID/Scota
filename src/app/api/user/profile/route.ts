import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getSession } from "@/lib/authHelper"

export async function GET(req: NextRequest) {
  try {
    let clerkId: string | null = null
    try {
      const authObj = await auth()
      clerkId = authObj?.userId || null
    } catch {}

    const session = await getSession(req)
    const sessionEmail = session?.email || ""
    const sessionUsername = session?.username || ""

    if (!clerkId && (!session || !session.username)) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 401 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({
        user: {
          name: session?.fullName || session?.staffName || sessionUsername,
          email: sessionEmail,
          phone: "",
          secondaryEmail: "",
          jobTitle: session?.role || "OWNER",
          city: "",
          promoOptIn: true,
        },
      })
    }

    // Query from users table
    const result = await queryPg<any>(
      `SELECT id, "clerkId", email, name, "avatarUrl", phone, "secondaryEmail", "jobTitle", city, "promoOptIn"
       FROM users
       WHERE ($1::text IS NOT NULL AND "clerkId" = $1)
          OR ($2::text != '' AND LOWER(email) = LOWER($2))
       LIMIT 1`,
      [clerkId, sessionEmail]
    )

    if (result?.rows && result.rows.length > 0) {
      const u = result.rows[0]
      return NextResponse.json({
        user: {
          id: u.id,
          name: u.name || session?.fullName || sessionUsername,
          email: u.email || sessionEmail,
          phone: u.phone || "",
          secondaryEmail: u.secondaryEmail || "",
          jobTitle: u.jobTitle || session?.role || "OWNER",
          city: u.city || "",
          promoOptIn: u.promoOptIn ?? true,
          avatarUrl: u.avatarUrl || null,
        },
      })
    }

    // Fallback if not yet in users table
    return NextResponse.json({
      user: {
        name: session?.fullName || session?.staffName || sessionUsername,
        email: sessionEmail,
        phone: "",
        secondaryEmail: "",
        jobTitle: session?.role || "OWNER",
        city: "",
        promoOptIn: true,
        avatarUrl: null,
      },
    })
  } catch (error: any) {
    console.error("GET /api/user/profile error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat profil akun" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let clerkId: string | null = null
    try {
      const authObj = await auth()
      clerkId = authObj?.userId || null
    } catch {}

    const session = await getSession(req)
    const sessionEmail = session?.email || ""
    const sessionUsername = session?.username || ""

    if (!clerkId && (!session || !session.username)) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone, secondaryEmail, jobTitle, city, promoOptIn } = body

    const cleanName = typeof name === "string" ? name.trim() : ""
    const cleanPhone = typeof phone === "string" ? phone.trim() : ""
    const cleanSecondaryEmail = typeof secondaryEmail === "string" ? secondaryEmail.trim().toLowerCase() : ""
    const cleanJobTitle = typeof jobTitle === "string" ? jobTitle.trim() : ""
    const cleanCity = typeof city === "string" ? city.trim() : ""
    const cleanPromoOptIn = typeof promoOptIn === "boolean" ? promoOptIn : true

    if (!cleanName) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi" }, { status: 400 })
    }

    if (cleanSecondaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanSecondaryEmail)) {
      return NextResponse.json({ error: "Format email sekunder tidak valid" }, { status: 400 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({
        success: true,
        message: "Profil akun berhasil disimpan!",
        user: {
          name: cleanName,
          phone: cleanPhone,
          secondaryEmail: cleanSecondaryEmail,
          jobTitle: cleanJobTitle,
          city: cleanCity,
          promoOptIn: cleanPromoOptIn,
        },
      })
    }

    // Upsert into users table
    const targetEmail = sessionEmail || (clerkId ? `${clerkId}@clerk.local` : `${sessionUsername}@scota.local`)

    await queryPg(
      `INSERT INTO users ("clerkId", email, name, phone, "secondaryEmail", "jobTitle", city, "promoOptIn", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         "secondaryEmail" = EXCLUDED."secondaryEmail",
         "jobTitle" = EXCLUDED."jobTitle",
         city = EXCLUDED.city,
         "promoOptIn" = EXCLUDED."promoOptIn",
         "clerkId" = COALESCE(EXCLUDED."clerkId", users."clerkId"),
         "updatedAt" = NOW()`,
      [
        clerkId,
        targetEmail,
        cleanName,
        cleanPhone,
        cleanSecondaryEmail || null,
        cleanJobTitle || null,
        cleanCity || null,
        cleanPromoOptIn,
      ]
    )

    // Also update admin_accounts if local admin
    if (sessionUsername) {
      await queryPg(
        `UPDATE admin_accounts
         SET name = $1, email = COALESCE(NULLIF($2, ''), email)
         WHERE username = $3`,
        [cleanName, cleanSecondaryEmail, sessionUsername]
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: "Profil identitas akun berhasil diperbarui!",
      user: {
        name: cleanName,
        phone: cleanPhone,
        secondaryEmail: cleanSecondaryEmail,
        jobTitle: cleanJobTitle,
        city: cleanCity,
        promoOptIn: cleanPromoOptIn,
      },
    })
  } catch (error: any) {
    console.error("POST /api/user/profile error:", error)
    return NextResponse.json({ error: error.message || "Gagal memperbarui profil akun" }, { status: 500 })
  }
}

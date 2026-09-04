import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)

    if (!session || !session.username) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        username: session.username,
        role: session.role || "ADMIN",
        staffName: session.staffName || "",
      },
    })
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

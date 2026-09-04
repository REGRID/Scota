import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://scota.id"

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login", "/register", "/privacy", "/terms"],
        disallow: ["/api/", "/superadmin/", "/dashboard/", "/scan/", "/history/", "/settings/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

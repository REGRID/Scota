/**
 * Regression guard -- kejadian ke-3 blok proteksi halaman /superadmin hilang dari middleware.
 * Test ini WAJIB tetap ada dan dijalankan di setiap deploy. Kalau gagal, JANGAN di-skip --
 * artinya proteksi halaman superadmin benar-benar hilang lagi.
 */
const BASE_URL = (process.env.TEST_BASE_URL || process.argv[2] || "https://scota.web.id").replace(/\/$/, "")

async function testSuperadminPageProtected() {
  const paths = ["/superadmin", "/superadmin/tenants", "/superadmin/billing", "/superadmin/audit-log"]

  console.log(`🔍 Menguji proteksi superadmin pada target: ${BASE_URL}\n`)

  for (const path of paths) {
    const targetUrl = `${BASE_URL}${path}`
    const res = await fetch(targetUrl, { redirect: "manual" })

    const isRedirect = res.status === 307 || res.status === 302 || res.status === 303
    if (!isRedirect) {
      console.error(
        `❌ REGRESI TERDETEKSI: ${path} mengembalikan status ${res.status} untuk pengunjung tanpa sesi (seharusnya redirect).`
      )
      process.exit(1)
    }

    const location = res.headers.get("location") || ""
    if (!location.includes("/superadmin/login")) {
      console.error(
        `❌ REGRESI TERDETEKSI: ${path} redirect ke "${location}", seharusnya ke /superadmin/login.`
      )
      process.exit(1)
    }

    console.log(`✅ ${path} -> redirect ke /superadmin/login (aman, status ${res.status})`)
  }

  // Pastikan halaman login itu sendiri TIDAK ikut ter-redirect (tidak infinite loop)
  const loginRes = await fetch(`${BASE_URL}/superadmin/login`, { redirect: "manual" })
  if (loginRes.status >= 300 && loginRes.status < 400) {
    console.error(`❌ REGRESI TERDETEKSI: /superadmin/login sendiri ikut ter-redirect (kemungkinan infinite redirect).`)
    process.exit(1)
  }
  console.log(`✅ /superadmin/login dapat diakses langsung (status ${loginRes.status}, tidak infinite redirect)`)

  console.log("\n✅ Semua test proteksi halaman superadmin lolos.")
}

testSuperadminPageProtected().catch((err) => {
  console.error("Test error:", err)
  process.exit(1)
})

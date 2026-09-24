import fs from "fs";
import path from "path";

const envConfig = fs.readFileSync(".env.local", "utf-8");
envConfig.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
    const idx = trimmed.indexOf("=");
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
});

import { getAllTenants } from "./src/lib/superadmin";

async function main() {
  const tenants = await getAllTenants();
  console.log("Count:", tenants.length);
  for (const t of tenants) {
    console.log(`[${t.tenantId}] ${t.username} | ${t.businessName} | role: ${t.role} | tier: ${t.tier} | status: ${t.status}`);
  }
}

main().catch(console.error);

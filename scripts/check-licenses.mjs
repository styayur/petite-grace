import fs from "node:fs";
import path from "node:path";

const lock = JSON.parse(fs.readFileSync(path.resolve("package-lock.json"), "utf8"));
const forbidden = /(^|[^A-Z])(A?GPL|SSPL|BUSL|Commons-Clause)/i;
const rows = [];

for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
  if (!pkgPath.startsWith("node_modules/") || meta.dev) continue;
  const license =
    typeof meta.license === "string" ? meta.license : JSON.stringify(meta.license ?? "UNKNOWN");
  rows.push({ package: pkgPath.replace(/^node_modules\//, ""), version: meta.version, license });
}

const missing = rows.filter((row) => row.license === "UNKNOWN");
const blocked = rows.filter((row) => forbidden.test(row.license));
for (const row of rows.sort((a, b) => a.package.localeCompare(b.package))) {
  console.log(`${row.package}@${row.version}: ${row.license}`);
}

if (missing.length) {
  console.error(`Missing license metadata: ${missing.map((row) => row.package).join(", ")}`);
  process.exitCode = 1;
}
if (blocked.length) {
  console.error(`Forbidden production licenses: ${blocked.map((row) => row.package).join(", ")}`);
  process.exitCode = 1;
}

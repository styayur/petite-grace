import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const steps = [
  { key: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { key: "unitIntegration", command: "npm", args: ["run", "test"] },
  { key: "e2e", command: "npm", args: ["run", "test:e2e"] },
  { key: "security", command: "npm", args: ["audit", "--audit-level=high"] },
  { key: "licenses", command: "npm", args: ["run", "licenses"] },
  { key: "build", command: "npm", args: ["run", "build"] },
];

const results = {};
for (const step of steps) {
  console.log(`\n=== ${step.key}: ${step.command} ${step.args.join(" ")} ===`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  results[step.key] = result.status === 0 ? "passed" : "failed";
}

const realPlatform = process.env.PG_REAL_PLATFORM ?? "not_verified";
const automatedPassed = Object.values(results).every((value) => value === "passed");
const releaseGate = automatedPassed && realPlatform === "verified" ? "ready" : "blocked";
const blockers = [];
if (!automatedPassed) blockers.push("automated-verification");
if (realPlatform !== "verified") blockers.push("real-platform-acceptance");

const acceptance = {
  version: pkg.version,
  typecheck: results.typecheck,
  unit: results.unitIntegration,
  integration: results.unitIntegration,
  e2e: results.e2e,
  security: results.security,
  licenses: results.licenses,
  build: results.build,
  realPlatform,
  releaseGate,
  blockers,
  generatedAt: new Date().toISOString(),
};

const artifactDir = path.resolve("artifacts");
fs.mkdirSync(artifactDir, { recursive: true });
const artifactPath = path.join(artifactDir, `acceptance-${pkg.version}.json`);
fs.writeFileSync(artifactPath, `${JSON.stringify(acceptance, null, 2)}\n`);
console.log(`\nAcceptance written to ${artifactPath}`);
if (!automatedPassed) process.exitCode = 1;

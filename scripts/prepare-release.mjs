import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkg.version;
const artifactDir = path.resolve("artifacts");
fs.mkdirSync(artifactDir, { recursive: true });

const builtUserscript = path.resolve("dist/petite-grace.user.js");
if (!fs.existsSync(builtUserscript)) {
  throw new Error("dist/petite-grace.user.js is missing; run npm run build first");
}

const userscript = fs.readFileSync(builtUserscript);
const headerEnd = userscript.indexOf(Buffer.from("// ==/UserScript=="));
const header =
  headerEnd >= 0
    ? userscript.subarray(0, headerEnd + "// ==/UserScript==".length + 1)
    : Buffer.alloc(0);

const userAsset = path.join(artifactDir, "petite-grace.user.js");
const metaAsset = path.join(artifactDir, "petite-grace.meta.js");
fs.writeFileSync(userAsset, userscript);
fs.writeFileSync(metaAsset, header);

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter(
    (file) => fs.existsSync(file) && !file.startsWith("artifacts/") && !file.startsWith("dist/"),
  );

const zipEntries = {};
for (const file of trackedFiles) {
  zipEntries[file] = new Uint8Array(fs.readFileSync(file));
}
zipEntries["petite-grace.user.js"] = new Uint8Array(userscript);
const sourceZip = zipSync(zipEntries, { level: 9 });
const sourceAsset = path.join(artifactDir, `petite-grace-v${version}-source.zip`);
fs.writeFileSync(sourceAsset, sourceZip);

const acceptancePath = path.resolve(`artifacts/acceptance-${version}.json`);
const documentedAcceptancePath = path.resolve(`docs/acceptance/v${version}.json`);
const acceptanceSource = fs.existsSync(acceptancePath)
  ? acceptancePath
  : fs.existsSync(documentedAcceptancePath)
    ? documentedAcceptancePath
    : null;
if (!acceptanceSource) {
  throw new Error(`Acceptance record missing for ${version}; run npm run acceptance first`);
}
const acceptance = JSON.parse(fs.readFileSync(acceptanceSource, "utf8"));
if (acceptance.version !== version) {
  throw new Error(
    `Acceptance version mismatch: expected ${version}, received ${acceptance.version}`,
  );
}
const acceptanceAsset = path.resolve(`artifacts/acceptance-${version}.json`);
fs.writeFileSync(acceptanceAsset, `${JSON.stringify(acceptance, null, 2)}\n`);

const hashTargets = [userAsset, metaAsset, sourceAsset, acceptanceAsset];
const sums = hashTargets.map((file) => {
  const digest = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  return `${digest}  ${path.basename(file)}`;
});
fs.writeFileSync(path.join(artifactDir, "SHA256SUMS.txt"), `${sums.join("\n")}\n`);
console.log(sums.join("\n"));

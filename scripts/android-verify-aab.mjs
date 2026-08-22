#!/usr/bin/env node
/**
 * Pre-upload gate for AXEN Android App Bundles.
 *
 * Scans EVERY .aab produced under android/app/build/outputs (all variants,
 * flavors and split configurations) and requires that each one:
 *   - has manifest package === expected package (com.hasin.axen)
 *   - has a valid versionCode (matching AXEN_VERSION_CODE when supplied)
 *   - is cryptographically signed
 *   - is signed by the certificate configured in android/keystore.properties
 *   - shares the SAME package ID, versionCode and signing identity as every
 *     other produced bundle
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, "android/app/build/outputs");
const PRIMARY_AAB = path.join(OUTPUTS_DIR, "bundle/release/app-release.aab");
const EXPECTED_PACKAGE = process.argv.includes("--package")
  ? process.argv[process.argv.indexOf("--package") + 1]
  : "com.hasin.axen";
const BUNDLETOOL_VERSION = "1.18.1";
const BUNDLETOOL_SHA256 = "675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c";

const die = (msg) => {
  console.error(`\n[aab] ${msg}\n`);
  process.exit(1);
};

if (!EXPECTED_PACKAGE) die("Missing value after --package.");

// ---------------------------------------------------------------------------
// 1. Discover every bundle output (all variants / flavors / splits).
// ---------------------------------------------------------------------------
const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".aab") ? [full] : [];
  });
};

const bundles = walk(OUTPUTS_DIR).sort();
if (bundles.length === 0) {
  die(`No .aab found under:\n  ${OUTPUTS_DIR}\n\nRun the build first:\n  npm run android:aab`);
}
console.log(`[aab] Found ${bundles.length} bundle output(s) to verify:`);
for (const b of bundles) {
  console.log(`      - ${path.relative(ROOT, b)} (${(statSync(b).size / (1024 * 1024)).toFixed(2)} MB)`);
}

const bin = (name) =>
  process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", name) : name;

// ---------------------------------------------------------------------------
// 2. Upload key fingerprint (the identity everything must match).
// ---------------------------------------------------------------------------
const propsPath = path.join(ROOT, "android/keystore.properties");
if (!existsSync(propsPath)) {
  die("android/keystore.properties is missing; cannot compare AAB certificates with the upload key.");
}
const properties = Object.fromEntries(
  readFileSync(propsPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);
const keystore = path.resolve(ROOT, "android", properties.storeFile || "");
if (!properties.storeFile || !properties.storePassword || !properties.keyAlias || !existsSync(keystore)) {
  die("The configured upload keystore is missing or incomplete.");
}

const fingerprint = (text) =>
  text.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1]?.replaceAll(":", "").toUpperCase();

const uploadCert = spawnSync(
  bin("keytool"),
  ["-list", "-v", "-keystore", keystore, "-alias", properties.keyAlias, "-storepass", properties.storePassword],
  { encoding: "utf8" },
);
const uploadFingerprint = fingerprint(`${uploadCert.stdout}\n${uploadCert.stderr}`);
if (!uploadFingerprint) {
  die("Could not read the signing certificate fingerprint from the configured upload keystore.");
}
console.log(`[aab] Upload key certificate SHA-256: ${uploadFingerprint}`);

// ---------------------------------------------------------------------------
// 3. bundletool (pinned) for manifest inspection.
// ---------------------------------------------------------------------------
const cacheDir = path.join(os.homedir(), ".cache", "axen");
const bundletoolJar = process.env.BUNDLETOOL_JAR || path.join(cacheDir, `bundletool-${BUNDLETOOL_VERSION}.jar`);
if (!existsSync(bundletoolJar)) {
  mkdirSync(cacheDir, { recursive: true });
  const url = `https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar`;
  console.log(`[aab] Downloading pinned bundletool ${BUNDLETOOL_VERSION} for manifest inspection...`);
  const download = spawnSync("curl", ["-fL", "--retry", "2", "-o", bundletoolJar, url], { stdio: "inherit" });
  if (download.status !== 0) die("Could not download bundletool. Set BUNDLETOOL_JAR to a local bundletool JAR.");
}
const bundletoolHash = createHash("sha256").update(readFileSync(bundletoolJar)).digest("hex");
if (!process.env.BUNDLETOOL_JAR && bundletoolHash !== BUNDLETOOL_SHA256) {
  writeFileSync(bundletoolJar, "");
  die("Downloaded bundletool failed its integrity check. Delete the cached file and retry.");
}

// ---------------------------------------------------------------------------
// 4. Verify each bundle, then cross-check consistency between them.
// ---------------------------------------------------------------------------
const expectedVersionCode = process.env.AXEN_VERSION_CODE;
const failures = [];
const results = [];

for (const aab of bundles) {
  const rel = path.relative(ROOT, aab);
  const fail = (msg) => failures.push(`${rel}: ${msg}`);

  const jar = spawnSync(bin("jarsigner"), ["-verify", "-strict", aab], { encoding: "utf8" });
  if (jar.error) {
    die("jarsigner was not found. Install JDK 17 or 21; verification cannot be skipped.");
  }
  const signed = (jar.status === 0 || jar.status === 4) && /jar verified/i.test(jar.stdout);
  if (!signed) fail("missing or invalid cryptographic signature.");

  const bundleCert = spawnSync(bin("keytool"), ["-printcert", "-jarfile", aab], { encoding: "utf8" });
  const bundleFingerprint = fingerprint(`${bundleCert.stdout}\n${bundleCert.stderr}`);
  if (!bundleFingerprint) {
    fail("could not read its signing certificate fingerprint.");
  } else if (bundleFingerprint !== uploadFingerprint) {
    fail(`SIGNING CERTIFICATE MISMATCH (${bundleFingerprint}) — not signed by the configured Play upload key.`);
  }

  const manifest = spawnSync(
    bin("java"),
    ["-jar", bundletoolJar, "dump", "manifest", `--bundle=${aab}`, "--module=base"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (manifest.status !== 0) {
    fail(`manifest could not be read: ${manifest.stderr.trim()}`);
    results.push({ rel, aab, pkg: null, versionCode: null, versionName: null, fp: bundleFingerprint });
    continue;
  }
  const pick = (attribute) => manifest.stdout.match(new RegExp(`${attribute}="([^"]+)"`))?.[1];
  const actualPackage = pick("package");
  const versionCode = pick("android:versionCode");
  const versionName = pick("android:versionName");

  if (actualPackage !== EXPECTED_PACKAGE) {
    fail(`WRONG PACKAGE: expected ${EXPECTED_PACKAGE}, found ${actualPackage || "no package"}.`);
  }
  if (!versionCode || !/^\d+$/.test(versionCode) || Number(versionCode) < 1) {
    fail(`invalid or missing versionCode: ${versionCode || "not found"}.`);
  }
  if (expectedVersionCode && versionCode !== expectedVersionCode) {
    fail(`WRONG VERSION: expected versionCode ${expectedVersionCode}, found ${versionCode}.`);
  }

  results.push({ rel, aab, pkg: actualPackage, versionCode, versionName, fp: bundleFingerprint });
  console.log(
    `[aab] ${rel}\n      package=${actualPackage} versionCode=${versionCode} versionName=${versionName || "not set"} signed=${signed ? "yes" : "NO"}`,
  );
}

// Cross-variant consistency.
const distinct = (key) => [...new Set(results.map((r) => r[key]).filter(Boolean))];
const packages = distinct("pkg");
const fingerprints = distinct("fp");
const versionCodes = distinct("versionCode");
if (packages.length > 1) failures.push(`Variants disagree on package ID: ${packages.join(", ")}`);
if (fingerprints.length > 1) failures.push(`Variants disagree on signing identity: ${fingerprints.join(", ")}`);
if (versionCodes.length > 1) failures.push(`Variants disagree on versionCode: ${versionCodes.join(", ")}`);

if (failures.length > 0) {
  console.error("\n[aab] FAIL — pre-upload checks did not pass:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(
  `\n[aab] PASS — ${results.length} bundle(s) verified: package=${packages[0]} versionCode=${versionCodes[0]} certificate=${uploadFingerprint}`,
);
const uploadTarget = existsSync(PRIMARY_AAB) ? PRIMARY_AAB : results[0].aab;
console.log(`[aab] Upload: ${uploadTarget}`);

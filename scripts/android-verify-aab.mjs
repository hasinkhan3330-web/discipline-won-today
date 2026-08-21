#!/usr/bin/env node
/** Pre-upload gate for AXEN Android App Bundles. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const AAB = path.join(ROOT, "android/app/build/outputs/bundle/release/app-release.aab");
const EXPECTED_PACKAGE = process.argv.includes("--package")
  ? process.argv[process.argv.indexOf("--package") + 1]
  : "com.hasin.axen";
const BUNDLETOOL_VERSION = "1.18.1";
const BUNDLETOOL_SHA256 = "675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c";

const die = (msg) => {
  console.error(`\n[aab] ${msg}\n`);
  process.exit(1);
};

if (!EXPECTED_PACKAGE) fail("Missing value after --package.");
if (!existsSync(AAB)) {
  die(
    `No bundle found at:\n  ${AAB}\n\nRun the build first:\n  npm run android:aab`,
  );
}

const sizeMb = (statSync(AAB).size / (1024 * 1024)).toFixed(2);
console.log(`[aab] Found app-release.aab (${sizeMb} MB)`);

const bin = (name) =>
  process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", name) : name;

const jar = spawnSync(bin("jarsigner"), ["-verify", "-strict", AAB], { encoding: "utf8" });
if (jar.error) {
  die("jarsigner was not found. Install JDK 17 or 21; verification cannot be skipped.");
} else if ((jar.status === 0 || jar.status === 4) && /jar verified/i.test(jar.stdout)) {
  console.log("[aab] Cryptographic signature: VERIFIED");
} else {
  die("The bundle is missing or has an invalid cryptographic signature.");
}

const propsPath = path.join(ROOT, "android/keystore.properties");
if (!existsSync(propsPath)) {
  die("android/keystore.properties is missing; cannot compare the AAB certificate with the upload key.");
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
const bundleCert = spawnSync(bin("keytool"), ["-printcert", "-jarfile", AAB], { encoding: "utf8" });
const uploadCert = spawnSync(
  bin("keytool"),
  ["-list", "-v", "-keystore", keystore, "-alias", properties.keyAlias, "-storepass", properties.storePassword],
  { encoding: "utf8" },
);
const bundleFingerprint = fingerprint(`${bundleCert.stdout}\n${bundleCert.stderr}`);
const uploadFingerprint = fingerprint(`${uploadCert.stdout}\n${uploadCert.stderr}`);
if (!bundleFingerprint || !uploadFingerprint) {
  die("Could not read the signing certificate fingerprint from the AAB or configured upload key.");
}
if (bundleFingerprint !== uploadFingerprint) {
  die("SIGNING CERTIFICATE MISMATCH: this AAB was not signed by the configured Play upload key.");
}
console.log(`[aab] Upload certificate SHA-256: ${bundleFingerprint}`);

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
const manifest = spawnSync(
  bin("java"),
  ["-jar", bundletoolJar, "dump", "manifest", `--bundle=${AAB}`, "--module=base"],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (manifest.status !== 0) die(`Bundle manifest could not be read: ${manifest.stderr.trim()}`);
const pick = (attribute) => manifest.stdout.match(new RegExp(`${attribute}="([^"]+)"`))?.[1];
const actualPackage = pick("package");
const versionCode = pick("android:versionCode");
const versionName = pick("android:versionName");
if (actualPackage !== EXPECTED_PACKAGE) {
  die(`WRONG PACKAGE: expected ${EXPECTED_PACKAGE}, but the AAB contains ${actualPackage || "no package"}.`);
}
if (!versionCode || !/^\d+$/.test(versionCode) || Number(versionCode) < 1) {
  die(`Invalid or missing versionCode: ${versionCode || "not found"}.`);
}
const expectedVersionCode = process.env.AXEN_VERSION_CODE;
if (expectedVersionCode && versionCode !== expectedVersionCode) {
  die(`WRONG VERSION: expected versionCode ${expectedVersionCode}, but the AAB contains ${versionCode}.`);
}
console.log(`[aab] Manifest: package=${actualPackage} versionCode=${versionCode} versionName=${versionName || "not set"}`);

console.log(`[aab] PASS — Play upload checks completed.\n[aab] Upload: ${AAB}`);

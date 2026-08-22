#!/usr/bin/env node
/**
 * Android config identity gate.
 *
 * Fails the build if the Android package ID drifts from the expected value in
 * ANY of the places that influence the produced APK/AAB:
 *   - capacitor.config.ts   (appId)
 *   - android/app/build.gradle (namespace + applicationId)
 *   - android/app/src/main/res/values/strings.xml (package_name, custom_url_scheme)
 *   - the MainActivity java package + its source directory path
 *   - src/lib/play-billing.ts (Play billing package)
 *   - package.json android:aab:verify script
 *
 * Usage: node scripts/android-verify-config.mjs [--package com.hasin.axen]
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const pkgFlag = argv.indexOf("--package");
const EXPECTED =
  pkgFlag !== -1 && argv[pkgFlag + 1] ? argv[pkgFlag + 1] : "com.hasin.axen";

const problems = [];
const checks = [];

function read(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    problems.push(`${rel}: file is missing`);
    return null;
  }
  return readFileSync(p, "utf8");
}

function expect(label, actual, file) {
  if (actual === EXPECTED) {
    checks.push(`${label} = ${actual}`);
  } else {
    problems.push(`${file}: ${label} is "${actual ?? "<not found>"}" (expected "${EXPECTED}")`);
  }
}

function match(src, re) {
  if (!src) return null;
  const m = src.match(re);
  return m ? m[1] : null;
}

// 1. Capacitor
const cap = read("capacitor.config.ts");
expect("capacitor appId", match(cap, /appId:\s*["']([^"']+)["']/), "capacitor.config.ts");

// 2. Gradle
const gradle = read("android/app/build.gradle");
expect("gradle namespace", match(gradle, /namespace\s+["']([^"']+)["']/), "android/app/build.gradle");
expect(
  "gradle applicationId",
  match(gradle, /applicationId\s+["']([^"']+)["']/),
  "android/app/build.gradle",
);

// 3. strings.xml
const strings = read("android/app/src/main/res/values/strings.xml");
expect(
  "strings package_name",
  match(strings, /name="package_name">([^<]+)</),
  "strings.xml",
);
expect(
  "strings custom_url_scheme",
  match(strings, /name="custom_url_scheme">([^<]+)</),
  "strings.xml",
);

// 4. MainActivity java package + path
const javaPath = `android/app/src/main/java/${EXPECTED.split(".").join("/")}/MainActivity.java`;
if (!existsSync(join(root, javaPath))) {
  problems.push(`MainActivity.java not found at ${javaPath}`);
} else {
  const java = read(javaPath);
  expect("MainActivity java package", match(java, /package\s+([\w.]+)\s*;/), javaPath);
}

// 5. Play billing helper
const billing = read("src/lib/play-billing.ts");
if (billing) {
  const found = match(billing, /const\s+pkg\s*=\s*["']([^"']+)["']/);
  expect("play-billing package", found, "src/lib/play-billing.ts");
}

// 6. package.json verify script
const pkgJson = read("package.json");
if (pkgJson && !pkgJson.includes(`--package ${EXPECTED}`)) {
  problems.push(`package.json: android:aab:verify does not pin --package ${EXPECTED}`);
} else if (pkgJson) {
  checks.push(`package.json verify script pins ${EXPECTED}`);
}

// 7. WebView hardening sanity (non-fatal warnings)
const warnings = [];
if (cap && !/androidScheme:\s*["']https["']/.test(cap)) {
  warnings.push("capacitor.config.ts: androidScheme should be 'https'");
}
if (cap && !/allowMixedContent:\s*false/.test(cap)) {
  warnings.push("capacitor.config.ts: allowMixedContent should be false");
}
const manifest = read("android/app/src/main/AndroidManifest.xml");
if (manifest && !manifest.includes("android.permission.INTERNET")) {
  warnings.push("AndroidManifest.xml: INTERNET permission missing (WebView shell needs it)");
}

for (const c of checks) console.log(`[config] ok  ${c}`);
for (const w of warnings) console.warn(`[config] warn ${w}`);

if (problems.length) {
  console.error("\n[config] FAIL — Android identity mismatch:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `\nEvery reference above must be exactly "${EXPECTED}" or Google Play will reject the bundle.\n`,
  );
  process.exit(1);
}

console.log(`\n[config] PASS — Android package ID locked to ${EXPECTED}`);

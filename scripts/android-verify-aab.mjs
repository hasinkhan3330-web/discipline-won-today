#!/usr/bin/env node
/**
 * Verifies the release .aab produced by `npm run android:aab`:
 *  - the file exists and has a sane size
 *  - it is signed (jarsigner -verify)
 *  - prints applicationId / versionCode / versionName from the bundle manifest
 *  - prints the absolute path to upload to Google Play Console
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AAB = path.join(ROOT, "android/app/build/outputs/bundle/release/app-release.aab");

const die = (msg) => {
  console.error(`\n[aab] ${msg}\n`);
  process.exit(1);
};

if (!existsSync(AAB)) {
  die(
    `No bundle found at:\n  ${AAB}\n\nRun the build first:\n  npm run android:aab`,
  );
}

const sizeMb = (statSync(AAB).size / (1024 * 1024)).toFixed(2);
console.log(`[aab] Found app-release.aab (${sizeMb} MB)`);
console.log(`[aab] Location: ${AAB}`);

const bin = (name) =>
  process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", name) : name;

const jar = spawnSync(bin("jarsigner"), ["-verify", AAB], { encoding: "utf8" });
if (jar.error) {
  console.warn("[aab] jarsigner not found — install JDK 17/21 to verify the signature.");
} else if (jar.status === 0 && /jar verified/i.test(jar.stdout)) {
  console.log("[aab] Signature: VERIFIED ✔ (ready for Google Play Console)");
} else {
  console.error(jar.stdout || jar.stderr);
  die(
    "The bundle is NOT signed. Create a keystore and rebuild:\n" +
      "  DWT_KEYSTORE_PASSWORD='...' DWT_KEY_PASSWORD='...' npm run android:keystore\n" +
      "  npm run android:aab",
  );
}

// Optional manifest dump (needs bundletool on PATH).
const bt = spawnSync("bundletool", ["dump", "manifest", "--bundle", AAB], {
  encoding: "utf8",
});
if (bt.status === 0) {
  const pick = (attr) => (bt.stdout.match(new RegExp(`${attr}="([^"]+)"`)) ?? [])[1];
  console.log(
    `[aab] package=${pick("package")} versionCode=${pick("android:versionCode")} versionName=${pick("android:versionName")}`,
  );
}

console.log("[aab] Upload this file in Play Console > Release > Create new release.");

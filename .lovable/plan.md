# Lock Android packaging to com.hasin.axen

## Current state (verified)

The package ID is already `com.hasin.axen` in every place that affects the built bundle:

- `capacitor.config.ts` → `appId: "com.hasin.axen"`
- `android/app/build.gradle` → `namespace` and `applicationId`
- `android/app/src/main/res/values/strings.xml` → `package_name`, `custom_url_scheme`
- `android/app/src/main/java/com/hasin/axen/MainActivity.java`
- `src/lib/play-billing.ts` and the AAB verifier default

The website URL (`https://discipline-won-today.lovable.app`) and all app features stay untouched.

## What this change adds

1. **Config consistency gate.** A new check (run as part of `npm run android:aab` and available standalone) that reads the package ID out of Capacitor config, Gradle, `strings.xml`, the Java source path, and the billing helper, and fails if any of them is not exactly `com.hasin.axen`. This catches drift before a build instead of after a rejected Play upload.
2. **Legacy naming cleanup.** Rename the leftover `DWT_*` signing env vars and `dwtVersionCode` / `dwtVersionName` Gradle properties to `AXEN_*` equivalents, keeping the old names working as a fallback so existing keystore setups don't break. Documentation in `ANDROID_BUILD.md` updated to match.
3. **WebView packaging hardening (no feature change).** Keep `allowMixedContent: false` and `androidScheme: https`, and confirm the manifest carries only the permissions the shell needs (`INTERNET`, `BILLING`).
4. **Verification run.** Execute the config gate plus the existing multi-variant AAB verifier so the final report states the confirmed package ID, versionCode, and signing identity.

## Technical notes

- New script: `scripts/android-verify-config.mjs`; wired into the `android:aab` npm script before the Gradle build.
- No changes to routes, UI, database, backend config, or the served web URL.

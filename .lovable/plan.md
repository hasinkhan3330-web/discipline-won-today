# Signed Android Release Build Setup

## Goal
Add npm/Capacitor commands and configuration so the project can produce a signed Android release build (APK and AAB) with clear, repeatable steps.

## What will change

1. **Add Android platform**
   - Run `npx cap add android` to generate the native Android project under `android/`.

2. **Add npm scripts to `package.json`**
   - `build:android`: Production web build + sync to Android.
   - `android:open`: Open Android Studio.
   - `android:release:apk`: Build signed release APK via Gradle.
   - `android:release:aab`: Build signed release AAB via Gradle.
   - `android:bundle:install`: Convenience script to build APK and install on a connected device.

3. **Create signing configuration**
   - Add `android/build.gradle` keystore properties support (reads from `android/keystore.properties` or environment variables).
   - Provide a template `android/keystore.properties.example` with safe placeholder values.
   - Do NOT commit real keystore files or passwords.

4. **Create build documentation**
   - Add `ANDROID_BUILD.md` with step-by-step instructions:
     - Generate a keystore.
     - Configure `keystore.properties`.
     - Build APK/AAB.
     - Verify signatures.

## Files to create/edit
- `package.json` — add Android build scripts.
- `android/app/build.gradle` — add signing config (generated after `cap add android`, then edited).
- `android/keystore.properties.example` — template for signing secrets.
- `ANDROID_BUILD.md` — human-readable build guide.

## Out of scope
- Publishing to Google Play Console.
- Generating actual keystore files or knowing real passwords (user must create these locally and keep them secret).

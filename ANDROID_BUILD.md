# Android Release Build — AXEN Habit & Discipline

## Quick start (fixes "Gradle project sync failed" / "Could not read script")

The `android/` folder is a **generated native project**. It must be prepared from the
project root before Android Studio can sync it — and it must be opened as a folder,
never from inside a ZIP.

```bash
# 1. Unzip the project somewhere real (Desktop/axen), NOT a temp/ZIP viewer path
# 2. From the project root (folder containing package.json):
npm install
npx cap sync android        # or: npm run android:prepare
```

Then in Android Studio: **File > Open** and select the `android` folder itself
(not the project root, not the ZIP). Let Gradle sync finish, then **Build > Build
Bundle(s)/APK(s)**.

If Gradle can't find the SDK, copy `android/local.properties.example` to
`android/local.properties` and set `sdk.dir`.

Requirements: **JDK 17 or 21**, Android Studio Ladybug+ (AGP 8.7.2, Gradle 8.11.1,
compileSdk 35). In Android Studio: Settings > Build Tools > Gradle > Gradle JDK = 17 or 21.

Common causes of a failed sync and their fix:

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Could not read script .../cordova.variables.gradle` | project opened from a ZIP, or `cap sync` never ran | unzip properly, then `npx cap sync android` |
| `[AXEN] node_modules not found` | opened `android/` without installing deps | `npm install` at the project root |
| `[AXEN] android/capacitor-cordova-android-plugins is missing` | sync not run | `npx cap sync android` |
| `Unsupported class file major version` | wrong JDK | set Gradle JDK to 17 or 21 |
| SDK location not found | missing `local.properties` | copy the example file and set `sdk.dir` |

---

## 0. Prerequisites (one time)

Install on your local machine:

- **Node.js 20+** and npm
- **JDK 17** (`java -version` should print 17.x)
- **Android Studio** with the Android SDK + Build Tools (Android Studio installs `keytool` and `sdkmanager` for you)

Then, from the project root:

```bash
npm install
```

If Gradle can't find your SDK, create `android/local.properties`:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk        # macOS
# sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk   # Windows
```

---

## 1. Create your upload keystore (one time — keep it forever)

```bash
keytool -genkeypair -v \
  -keystore android/dwt-release.jks \
  -alias dwt \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be asked for a keystore password, a key password and your name/org details.

> **Critical:** back up `dwt-release.jks` and both passwords somewhere safe.
> If you lose this file you can never publish an update to the same Play listing
> (unless you enrolled in Play App Signing key rotation).

---

## 2. Configure signing credentials

Copy the template and fill in your real values:

```bash
cp android/keystore.properties.example android/keystore.properties
```

```properties
# android/keystore.properties
storeFile=dwt-release.jks
storePassword=<your keystore password>
keyAlias=dwt
keyPassword=<your key password>
```

`android/keystore.properties` and `*.jks` are already git-ignored — they will
**not** be committed.

**CI alternative:** instead of the file, export these environment variables:

| Variable                 | Meaning                                |
| ------------------------ | -------------------------------------- |
| `AXEN_KEYSTORE_FILE`      | path to the `.jks`, relative to `android/` |
| `AXEN_KEYSTORE_PASSWORD`  | keystore password                      |
| `AXEN_KEY_ALIAS`          | key alias (`dwt`)                      |
| `AXEN_KEY_PASSWORD`       | key password                           |

---

## 3. Build the Play-ready AAB

```bash
npm run android:keystore     # one time (see section 1–2)
npm run android:aab          # build + mandatory package/version/certificate verification
npm run android:aab:verify   # rerun the same strict pre-upload checks
```

**The generated bundle is here:**

```
<project root>/android/app/build/outputs/bundle/release/app-release.aab
```

That is the exact file you upload in **Play Console → Release → Production →
Create new release**.

| Command                  | Output                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `npm run android:apk`    | `android/app/build/outputs/apk/release/app-release.apk`        |
| `npm run android:aab`    | `android/app/build/outputs/bundle/release/app-release.aab`     |
| `npm run android:aab:verify` | verifies signature + prints the .aab path                 |
| `npm run android:release`| APK + AAB + verification                                       |
| `npm run android:sync`   | copy web shell + plugins into the native project               |
| `npm run android:open`   | open the project in Android Studio                             |
| `npm run android:run`    | build + install on a connected device/emulator                 |
| `npm run android:clean`  | `gradlew clean`                                                |
| `npm run android:verify` | print the Gradle signing report                                |

If signing is not configured, the release build now **fails fast** with a clear
message instead of quietly producing an unsigned artifact that Play would
reject. (`-PallowUnsignedRelease` bypasses this for local smoke tests only.)

Release identity, already verified:

| Field | Value |
| --- | --- |
| applicationId | `com.hasin.axen` |
| app label | AXEN Habit & Discipline |
| compileSdk / targetSdk | 35 |
| minSdk | 23 |
| default versionCode / versionName | `3` / `1.0.2` |



### Setting the version

Play rejects an upload whose `versionCode` was already used. Bump it per release:

```bash
cd android
./gradlew bundleRelease -PaxenVersionCode=2 -PaxenVersionName=1.0.1
```

Or, via the npm script:

```bash
npm run android:sync && cd android && ./gradlew bundleRelease -PaxenVersionCode=2 -PaxenVersionName=1.0.1
```

`npm run android:aab` scans **every** `.aab` under `android/app/build/outputs`
(all variants, flavors and split configurations) and fails before upload unless
each one passes:

- manifest package is exactly `com.hasin.axen`
- `versionCode` is present (and matches `AXEN_VERSION_CODE` when supplied)
- the bundle is cryptographically signed
- the AAB signing certificate matches `android/keystore.properties`
- all produced bundles share the same package ID, versionCode and signing certificate

Never upload an AAB copied from an older project or build. Upload only the exact
path printed after `[aab] PASS`.

---

## 4. Verify the build is properly signed

```bash
# APK — should print "Verified using v2 scheme: true"
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose \
  android/app/build/outputs/apk/release/app-release.apk

# AAB
jarsigner -verify -verbose -certs \
  android/app/build/outputs/bundle/release/app-release.aab
```

You can also run `npm run android:verify` and confirm the `release` variant
shows your key's SHA-1/SHA-256 rather than the debug key.

If you see the log line
`[DWT] No release signing config found — producing an UNSIGNED release build`,
your `keystore.properties` is missing, incomplete, or points at a `.jks` that
doesn't exist.

---

## 5. Google Play Billing / RevenueCat notes

The app uses `@revenuecat/purchases-capacitor` for in-app subscriptions. For
purchases to work on a real build:

1. The `applicationId` must match the Play Console app: `com.hasin.axen`
2. Upload a signed AAB to at least the **internal testing** track once — billing
   does not work on unsigned/debug builds.
3. Create the Monthly and Yearly subscription products in Play Console and map
   their product IDs in RevenueCat.
4. Test with a **licensed tester** account, not your dev account.

ProGuard keep rules for Capacitor, Cordova bridges and RevenueCat/Billing are
already in `android/app/proguard-rules.pro`, so R8 minification is safe to leave on.

---

## 6. How the web app is loaded

This is a server-rendered (TanStack Start) app, so the Android shell loads the
deployed site rather than a static export. `capacitor.config.ts` sets:

```ts
server: { url: "https://discipline-won-today.lovable.app", androidScheme: "https" }
```

`android-shell/index.html` is bundled into the APK as an offline/splash fallback.

To build against a different environment:

```bash
CAP_SERVER_URL=https://id-preview--<id>.lovable.app npm run android:apk
```

Publish your latest web changes **before** cutting a release build — the app
picks them up automatically, no new APK required for web-only updates.

## Pre-build config gate

`npm run android:config:verify` (also run automatically by `npm run android:apk`
and `npm run android:aab`) fails the build unless the package ID is exactly
`com.hasin.axen` in every place that shapes the bundle:

- `capacitor.config.ts` -> `appId`
- `android/app/build.gradle` -> `namespace` + `applicationId`
- `android/app/src/main/res/values/strings.xml` -> `package_name`, `custom_url_scheme`
- `android/app/src/main/java/com/hasin/axen/MainActivity.java` package + path
- `src/lib/play-billing.ts`
- the pinned `--package` argument of `android:aab:verify`

It also warns if the WebView shell loses `androidScheme: 'https'`,
`allowMixedContent: false`, or the `INTERNET` permission.

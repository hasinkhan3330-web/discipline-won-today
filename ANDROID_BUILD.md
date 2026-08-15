# Android Release Build — AXEN Habit & Discipline

How to produce a **signed** Android release (APK for direct install, AAB for Google Play).

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
| `DWT_KEYSTORE_FILE`      | path to the `.jks`, relative to `android/` |
| `DWT_KEYSTORE_PASSWORD`  | keystore password                      |
| `DWT_KEY_ALIAS`          | key alias (`dwt`)                      |
| `DWT_KEY_PASSWORD`       | key password                           |

---

## 3. Build

| Command                  | Output                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `npm run android:apk`    | `android/app/build/outputs/apk/release/app-release.apk`        |
| `npm run android:aab`    | `android/app/build/outputs/bundle/release/app-release.aab`     |
| `npm run android:release`| both of the above                                              |
| `npm run android:sync`   | copy web shell + plugins into the native project               |
| `npm run android:open`   | open the project in Android Studio                             |
| `npm run android:run`    | build + install on a connected device/emulator                 |
| `npm run android:clean`  | `gradlew clean`                                                |
| `npm run android:verify` | print the Gradle signing report                                |

**Upload the `.aab` to Google Play.** The `.apk` is for sideloading and testing.

Typical release run:

```bash
npm run android:release
```

### Setting the version

Play rejects an upload whose `versionCode` was already used. Bump it per release:

```bash
cd android
./gradlew bundleRelease -PdwtVersionCode=2 -PdwtVersionName=1.0.1
```

Or, via the npm script:

```bash
npm run android:sync && cd android && ./gradlew bundleRelease -PdwtVersionCode=2 -PdwtVersionName=1.0.1
```

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

1. The `applicationId` must match the Play Console app: `app.lovable.disciplinewontoday`
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

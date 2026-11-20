# Native Google sign-in for the Android app

## Why it's stuck and why "Lovable" shows
- The Android app loads axonhabit.app in a webview. Tapping Google opens Chrome, Google sends you back to oauth.lovable.app inside Chrome, and Chrome has no way to hand the session back to the app.
- "Choose an account to continue to Lovable" appears because the app uses Lovable's shared Google login. The only way to show "AXEN" there instead is to use your own Google login keys.

## Fix (Android app only; website login stays exactly as it is)
1. On Android, the Google button opens the phone's own Google account picker (no Chrome). The picker returns a Google token, which signs you in to AXEN directly. You never leave the app.
2. The website and the preview keep using the current Google sign-in unchanged. Email login and everything else stay untouched.
3. The account picker shows your app name "AXEN", not Lovable.

## What you need to do (I'll give step-by-step help)
1. In Google Cloud console, create two OAuth client IDs: one "Web application" and one "Android" (package `com.hasin.axen` + your signing key's SHA-1 fingerprint, plus Play Console's App signing SHA-1).
2. Set the OAuth consent screen app name to "AXEN" and add your logo.
3. Paste the Web client ID + secret into Cloud → Users → Auth settings → Google, so the website also shows "AXEN" instead of Lovable.
4. Rebuild the Android app (`npx cap sync android`, new build).

## Technical details
- Add `@capgo/capacitor-social-login` (Capacitor 7 compatible). In `src/routes/index.tsx`, branch on `Capacitor.getPlatform() === "android"`: call `SocialLogin.login({ provider: "google", options: { scopes: ["email","profile"] } })`, then `supabase.auth.signInWithIdToken({ provider: "google", token: idToken })`. Use a nonce (raw to Supabase, SHA-256 to Google).
- Web client ID stored as public `VITE_GOOGLE_WEB_CLIENT_ID` (not a secret); initialize plugin once in a small `src/lib/native-google-auth.ts`.
- Web path keeps `lovable.auth.signInWithOAuth`; `src/integrations/lovable` untouched.
- Update `ANDROID_BUILD.md` with SHA-1 and rebuild steps; AGENTS.md rule.
- Not testable here: real phone login needs your client IDs and a rebuilt APK.

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Discipline Won Today — Capacitor config.
 *
 * This app is a TanStack Start (SSR) app, so the Android shell loads the
 * deployed web app instead of a fully static export. `android-shell/` holds a
 * local splash/offline fallback that is bundled into the APK.
 *
 * To point the app at a different backend (e.g. the preview build), set
 * CAP_SERVER_URL before running the build/sync scripts.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://discipline-won-today.lovable.app";

const config: CapacitorConfig = {
  appId: "app.lovable.disciplinewontoday",
  appName: "Discipline Won Today",
  webDir: "android-shell",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

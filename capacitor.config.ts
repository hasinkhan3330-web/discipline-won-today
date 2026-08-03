import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.disciplinewontoday",
  appName: "Discipline Won Today",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;

export const THEMES = {
  space: { name: "COSMOS", accent: "#00d4ff", accent2: "#7b5cff", glow: "0 0 20px #00d4ff" },
  blood: { name: "BLOOD", accent: "#ff2e4d", accent2: "#ff6a00", glow: "0 0 20px #ff2e4d" },
  matrix: { name: "MATRIX", accent: "#00ff88", accent2: "#00d46a", glow: "0 0 20px #00ff88" },
  gold: { name: "GOLD", accent: "#ffcc33", accent2: "#ff8800", glow: "0 0 20px #ffcc33" },
} as const;

export type ThemeKey = keyof typeof THEMES;

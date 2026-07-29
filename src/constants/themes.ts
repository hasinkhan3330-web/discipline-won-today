export const THEMES = {
  space:  { name: "COSMOS",   accent: "#00d4ff", accent2: "#7b5cff", glow: "0 0 20px #00d4ff", unlock: 0 },
  blood:  { name: "BLOOD",    accent: "#ff2e4d", accent2: "#ff6a00", glow: "0 0 20px #ff2e4d", unlock: 0 },
  matrix: { name: "MATRIX",   accent: "#00ff88", accent2: "#00d46a", glow: "0 0 20px #00ff88", unlock: 0 },
  gold:   { name: "GOLD",     accent: "#ffcc33", accent2: "#ff8800", glow: "0 0 20px #ffcc33", unlock: 0 },
  aurora: { name: "AURORA",   accent: "#39ffd0", accent2: "#8a5bff", glow: "0 0 20px #39ffd0", unlock: 7 },
  neural: { name: "NEURAL",   accent: "#ff4fd8", accent2: "#00e5ff", glow: "0 0 20px #ff4fd8", unlock: 21 },
  ignite: { name: "IGNITION", accent: "#ff7a18", accent2: "#ffd93b", glow: "0 0 20px #ff7a18", unlock: 365 },
} as const;

export type ThemeKey = keyof typeof THEMES;

/** Streak milestones that auto-evolve the UI theme + wallpaper. */
export const MILESTONES: { d: number; theme: ThemeKey; title: string; line: string; icon: string }[] = [
  { d: 7,   theme: "aurora", icon: "🌌", title: "7 DAYS UNBROKEN", line: "Aurora protocol unlocked. 95% never reach this line." },
  { d: 21,  theme: "neural", icon: "🧠", title: "21 DAYS · NEURAL FORGE", line: "Your wiring changed. Futuristic interface online." },
  { d: 365, theme: "ignite", icon: "🚀", title: "365 DAYS · IGNITION", line: "One full year. Launch sequence complete — you are the legend." },
];

/** 0 = base cosmos, 1 = aurora, 2 = neural, 3 = rocket */
export const wallpaperLevel = (streak: number) => (streak >= 365 ? 3 : streak >= 21 ? 2 : streak >= 7 ? 1 : 0);

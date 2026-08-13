import nightHighway from "@/assets/night-highway.jpg.asset.json";
import aurumPeak from "@/assets/aurum-peak.jpg.asset.json";
import hourglassVideo from "@/assets/hourglass.mp4.asset.json";
import hourglassPoster from "@/assets/hourglass-poster.jpg.asset.json";

export const THEMES = {
  space:   { name: "COSMOS",    accent: "#00d4ff", accent2: "#7b5cff", glow: "0 0 20px #00d4ff", unlock: 0,   wall: 0 },
  blood:   { name: "BLOOD",     accent: "#ff2e4d", accent2: "#ff6a00", glow: "0 0 20px #ff2e4d", unlock: 0,   wall: 1 },
  matrix:  { name: "MATRIX",    accent: "#00ff88", accent2: "#00d46a", glow: "0 0 20px #00ff88", unlock: 0,   wall: 2 },
  gold:    { name: "GOLD",      accent: "#ffcc33", accent2: "#ff8800", glow: "0 0 20px #ffcc33", unlock: 0,   wall: 3 },
  aurora:  { name: "AURORA",    accent: "#39ffd0", accent2: "#8a5bff", glow: "0 0 20px #39ffd0", unlock: 7,   wall: 1 },
  neural:  { name: "NEURAL",    accent: "#ff4fd8", accent2: "#00e5ff", glow: "0 0 20px #ff4fd8", unlock: 21,  wall: 2 },
  plasma:  { name: "PLASMA",    accent: "#7cf5ff", accent2: "#ff2ea6", glow: "0 0 20px #7cf5ff", unlock: 49,  wall: 3 },
  quantum: { name: "QUANTUM",   accent: "#a6ff3d", accent2: "#00b3ff", glow: "0 0 20px #a6ff3d", unlock: 90,  wall: 4 },
  nova:    { name: "NOVA",      accent: "#ff8a3d", accent2: "#ff2ea6", glow: "0 0 20px #ff8a3d", unlock: 170, wall: 5 },
  titan:   { name: "TITAN",     accent: "#c9d6ff", accent2: "#5a7bff", glow: "0 0 20px #c9d6ff", unlock: 250, wall: 6 },
  ignite:  { name: "IGNITION",  accent: "#ff7a18", accent2: "#ffd93b", glow: "0 0 20px #ff7a18", unlock: 365, wall: 7 },
  midnight:{ name: "MIDNIGHT",  accent: "#dfe9f5", accent2: "#7f8da3", glow: "0 0 20px #dfe9f5", unlock: 0,   wall: 0 },
  hourglass:{ name: "HOURGLASS", accent: "#d8dee9", accent2: "#8e9bad", glow: "0 0 20px #d8dee9", unlock: 0,  wall: 0 },
} as const;

/** Photo wallpapers bound to a theme (rendered under the animated layers). */
export const THEME_PHOTO: Partial<Record<ThemeKey, string>> = {
  midnight: nightHighway.url,
  hourglass: hourglassPoster.url,
};

/** Looping cinematic video wallpapers bound to a theme (free for everyone). */
export const THEME_VIDEO: Partial<Record<ThemeKey, string>> = {
  hourglass: hourglassVideo.url,
};

/** Themes reserved for PRO members. */
export const PRO_THEMES: ThemeKey[] = ["midnight"];


export type ThemeKey = keyof typeof THEMES;

export type Milestone = {
  d: number;
  theme: ThemeKey;
  title: string;
  line: string;
  icon: string;
  /** 1 = small, 2 = boom blast, 3 = supernova, 4 = launch sequence */
  intensity: 1 | 2 | 3 | 4;
  /** overlay duration in ms */
  ms: number;
};

/** Streak milestones that auto-evolve the UI theme + wallpaper. */
export const MILESTONES: Milestone[] = [
  { d: 7,   theme: "aurora",  icon: "🌌", intensity: 1, ms: 7000,  title: "7 DAYS UNBROKEN",        line: "Aurora protocol unlocked. 95% never reach this line." },
  { d: 21,  theme: "neural",  icon: "🧠", intensity: 2, ms: 17000, title: "21 DAYS · NEURAL FORGE", line: "Habit locked into your wiring. Boom — futuristic interface online." },
  { d: 49,  theme: "plasma",  icon: "⚡", intensity: 2, ms: 17000, title: "49 DAYS · PLASMA CORE",  line: "Seven weeks clean. Your discipline now runs on plasma." },
  { d: 90,  theme: "quantum", icon: "🧬", intensity: 3, ms: 20000, title: "90 DAYS · QUANTUM LEAP", line: "A full quarter unbroken. You are a different species now." },
  { d: 170, theme: "nova",    icon: "☄️", intensity: 3, ms: 20000, title: "170 DAYS · NOVA STATE",  line: "Half a year of fire. Most people never last a week." },
  { d: 250, theme: "titan",   icon: "🛡️", intensity: 3, ms: 22000, title: "250 DAYS · TITAN CLASS", line: "Unshakeable. Discipline is no longer a choice — it's your default." },
  { d: 365, theme: "ignite",  icon: "🚀", intensity: 4, ms: 25000, title: "365 DAYS · IGNITION",    line: "One full year. Launch sequence complete — you are the legend." },
];

/** 0 = base cosmos → 7 = full ignition */
export const wallpaperLevel = (streak: number) =>
  streak >= 365 ? 7 : streak >= 250 ? 6 : streak >= 170 ? 5 : streak >= 90 ? 4 : streak >= 49 ? 3 : streak >= 21 ? 2 : streak >= 7 ? 1 : 0;

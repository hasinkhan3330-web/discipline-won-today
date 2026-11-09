// Pure, browser-safe rules for the Shake, Typing and Find Color Tiles wake missions.
export type NewMission = "shake" | "typing" | "tiles";
export type MissionMode = "math" | "science" | NewMission;
export const NEW_MISSIONS: readonly NewMission[] = ["shake", "typing", "tiles"];
export const isNewMission = (m: string | null | undefined): m is NewMission => !!m && (NEW_MISSIONS as readonly string[]).includes(m);
export type Level = 1 | 2 | 3;
export const LEVEL_LABEL: Record<Level, string> = { 1: "Easy", 2: "Normal", 3: "Hard" };
export const asLevel = (n: number): Level => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

// ---------- Shake ----------
export const SHAKE_THRESHOLD: Record<Level, number> = { 1: 11, 2: 14, 3: 18 };
export const SHAKE_TARGET: Record<Level, number> = { 1: 20, 2: 40, 3: 70 };
export const SHAKE_MIN_GAP_MS = 150;
export const SHAKE_MAX_PER_SECOND = 7;

export type ShakeSample = { x: number; y: number; z: number; t: number };
/** Low-pass gravity removal + peak detection with refractory gap and per-second cap. Count never decreases. */
export function createShakeCounter(level: Level) {
  const threshold = SHAKE_THRESHOLD[level];
  let gravity: [number, number, number] | null = null;
  let last = -Infinity, count = 0, armed = true;
  const recent: number[] = [];
  return {
    push(s: ShakeSample): number {
      if (!gravity) { gravity = [s.x, s.y, s.z]; return count; }
      const alpha = 0.8;
      gravity = [alpha * gravity[0] + (1 - alpha) * s.x, alpha * gravity[1] + (1 - alpha) * s.y, alpha * gravity[2] + (1 - alpha) * s.z];
      const lx = s.x - gravity[0], ly = s.y - gravity[1], lz = s.z - gravity[2];
      const mag = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (mag < threshold * 0.5) armed = true;
      while (recent.length && s.t - recent[0]! >= 1000) recent.shift();
      if (mag >= threshold && armed && s.t - last >= SHAKE_MIN_GAP_MS && recent.length < SHAKE_MAX_PER_SECOND) {
        count += 1; last = s.t; armed = false; recent.push(s.t);
      }
      return count;
    },
    get count() { return count; },
  };
}
type Vec = { x: number | null; y: number | null; z: number | null } | null | undefined;
export function sampleFromMotion(e: { accelerationIncludingGravity?: Vec; acceleration?: Vec }, t: number): ShakeSample | null {
  const g = e.accelerationIncludingGravity;
  const src = g && g.x !== null ? g : e.acceleration;
  if (!src || src.x === null || src.y === null || src.z === null) return null;
  return { x: src.x, y: src.y, z: src.z, t };
}
export const shakeProgress = (count: number, target: number) => Math.min(1, count / target);

// ---------- Typing ----------
export const TYPING_WORDS: Record<Level, [number, number]> = { 1: [6, 8], 2: [10, 14], 3: [18, 24] };
export const TYPING_MAX_CPS = 12;
export const caseSensitive = (level: Level) => level === 3;
/** Rejects paste/drop/cut/replacement and any single input event that adds more than 2 characters. */
export function acceptTypingInput(prev: string, next: string, inputType?: string): boolean {
  if (inputType && /paste|drop|cut|replacement|yank/i.test(inputType)) return false;
  return next.length - prev.length <= 2;
}
export const normalise = (s: string, level: Level) => (caseSensitive(level) ? s : s.toLowerCase());
export const typingComplete = (typed: string, target: string, level: Level) => normalise(typed, level) === normalise(target, level);
export function letterStates(typed: string, target: string, level: Level): ("todo" | "ok" | "bad")[] {
  return [...target].map((ch, i) => (i >= typed.length ? "todo" : normalise(typed[i]!, level) === normalise(ch, level) ? "ok" : "bad"));
}
export function pickSentence(bank: string[], lastUsed: string[], rand = Math.random): string {
  const avoid = new Set(lastUsed.slice(-5));
  const pool = bank.filter(s => !avoid.has(s));
  const list = pool.length ? pool : bank;
  return list[Math.floor(rand() * list.length)]!;
}

// ---------- Find Color Tiles ----------
export const TILE_GRID: Record<Level, { size: number; min: number; max: number }> = { 1: { size: 4, min: 3, max: 4 }, 2: { size: 5, min: 5, max: 6 }, 3: { size: 6, min: 8, max: 10 } };
export const TILE_WRONG_LIMIT = 3;
export const TILE_PAIRS = [
  { name: "yellow", base: "#6667b8", target: "#f7c325", hard: "#d8b33e" },
  { name: "orange", base: "#1f8a8a", target: "#ff9f1c", hard: "#e0a050" },
  { name: "green", base: "#c2549b", target: "#7ddc6f", hard: "#a3c77a" },
] as const;
export type TileRound = { size: number; targets: number[]; base: string; target: string; name: string };
export function generateTiles(level: Level, rand = Math.random): TileRound {
  const g = TILE_GRID[level];
  const n = g.min + Math.floor(rand() * (g.max - g.min + 1));
  const cells = Array.from({ length: g.size * g.size }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; }
  const pair = TILE_PAIRS[Math.floor(rand() * TILE_PAIRS.length)]!;
  return { size: g.size, targets: cells.slice(0, n).sort((a, b) => a - b), base: pair.base, target: level === 3 ? pair.hard : pair.target, name: pair.name };
}
export type TileState = { round: TileRound; cleared: number[]; wrong: number; taps: number; regenerated: number };
export const newTileState = (level: Level, rand = Math.random): TileState => ({ round: generateTiles(level, rand), cleared: [], wrong: 0, taps: 0, regenerated: 0 });
export function tapTile(s: TileState, index: number, level: Level, rand = Math.random): { state: TileState; hit: boolean; reset: boolean } {
  if (s.cleared.includes(index)) return { state: s, hit: false, reset: false };
  if (s.round.targets.includes(index)) return { state: { ...s, cleared: [...s.cleared, index], taps: s.taps + 1 }, hit: true, reset: false };
  const wrong = s.wrong + 1;
  if (wrong >= TILE_WRONG_LIMIT) return { state: { round: generateTiles(level, rand), cleared: [], wrong: 0, taps: s.taps, regenerated: s.regenerated + 1 }, hit: false, reset: true };
  return { state: { ...s, wrong }, hit: false, reset: false };
}
export const roundCleared = (s: TileState) => s.cleared.length === s.round.targets.length;

export const MISSION_META: Record<NewMission, { name: string; headline: string }> = {
  shake: { name: "Shake", headline: "Shake it off. Move before you scroll." },
  typing: { name: "Typing", headline: "Type it out. Wake your mind first." },
  tiles: { name: "Find Color Tiles", headline: "Spot the tiles. Wake up sharp." },
};
export type MissionChallenge = { mission: NewMission; difficulty: Level; rounds: number; sentences?: string[] };
export function parseChallenge(text: string | null | undefined): MissionChallenge | null {
  try { const j = JSON.parse(text ?? ""); return isNewMission(j?.mission) ? { mission: j.mission, difficulty: asLevel(Number(j.difficulty)), rounds: Math.min(3, Math.max(1, Number(j.rounds) || 1)), sentences: Array.isArray(j.sentences) ? j.sentences.map(String) : undefined } : null; } catch { return null; }
}
export type MissionProof = { elapsed_ms: number; shakes?: number; typed?: string[]; taps?: number; targets?: number };

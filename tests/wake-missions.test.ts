import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  createShakeCounter, SHAKE_TARGET, shakeProgress, acceptTypingInput, typingComplete, letterStates, pickSentence,
  generateTiles, newTileState, tapTile, roundCleared, TILE_GRID, parseChallenge, type Level,
} from "../src/lib/wake-missions/rules";
import { SENTENCES, sentenceWords } from "../src/lib/wake-missions/sentences";

// Seeded RNG for deterministic layouts.
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function stream(level: Level, peaks: number[], hz = 60, ms = 10000) {
  const c = createShakeCounter(level);
  for (let t = 0; t < ms; t += 1000 / hz) {
    const k = Math.floor(t / 100) % peaks.length;
    const spike = (Math.floor(t) % 100) < 20 ? peaks[k]! : 0;
    c.push({ x: spike, y: 0, z: 9.81, t });
  }
  return c.count;
}

test("shake: walking noise (≈3 m/s² bumps) never counts at any level", () => {
  const c = createShakeCounter(1);
  for (let t = 0; t < 20000; t += 16) c.push({ x: Math.sin(t / 250) * 3, y: Math.cos(t / 300) * 2, z: 9.81 + Math.sin(t / 200) * 2.5, t });
  expect(c.count).toBe(0);
});
test("shake: hard shakes count on Normal", () => expect(stream(2, [30, -30])).toBeGreaterThan(40));
test("shake: soft 13 m/s² peaks count on Easy but not Hard", () => {
  expect(stream(1, [16, -16])).toBeGreaterThan(0);
  expect(stream(3, [16, -16])).toBe(0);
});
test("shake: rate limit holds (≤7/s, ≥150 ms apart)", () => {
  const c = createShakeCounter(1);
  const times: number[] = [];
  for (let t = 0; t < 3000; t += 5) { const before = c.count; c.push({ x: (Math.floor(t / 20) % 2 ? 40 : -40), y: 0, z: 9.81, t }); if (c.count > before) times.push(t); }
  for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(150);
  for (const t of times) expect(times.filter(x => x > t - 1000 && x <= t).length).toBeLessThanOrEqual(7);
  expect(c.count).toBeLessThanOrEqual(21);
});
test("shake: progress reaches exactly 100% at target and never exceeds", () => {
  expect(shakeProgress(SHAKE_TARGET[2] - 1, SHAKE_TARGET[2])).toBeLessThan(1);
  expect(shakeProgress(SHAKE_TARGET[2], SHAKE_TARGET[2])).toBe(1);
  expect(shakeProgress(500, SHAKE_TARGET[2])).toBe(1);
  expect([SHAKE_TARGET[1], SHAKE_TARGET[2], SHAKE_TARGET[3]]).toEqual([20, 40, 70]);
});

test("typing: paste, drop and dictation-sized inserts are blocked", () => {
  expect(acceptTypingInput("", "a")).toBe(true);
  expect(acceptTypingInput("a", "abc")).toBe(true);
  expect(acceptTypingInput("a", "abcd")).toBe(false);
  expect(acceptTypingInput("", "x", "insertFromPaste")).toBe(false);
  expect(acceptTypingInput("", "x", "insertFromDrop")).toBe(false);
  expect(acceptTypingInput("abc", "ab", "deleteByCut")).toBe(false);
  expect(acceptTypingInput("", "wake", "insertReplacementText")).toBe(false);
});
test("typing: Easy/Normal ignore case, Hard is exact incl. punctuation", () => {
  expect(typingComplete("OPEN your eyes", "open your eyes", 1)).toBe(true);
  expect(typingComplete("open YOUR eyes", "open your eyes", 2)).toBe(true);
  expect(typingComplete("open your eyes.", "Open your eyes.", 3)).toBe(false);
  expect(typingComplete("Open your eyes", "Open your eyes.", 3)).toBe(false);
  expect(typingComplete("Open your eyes.", "Open your eyes.", 3)).toBe(true);
  expect(letterStates("ox", "op", 1)).toEqual(["ok", "bad"]);
});
test("typing: ≥60 sentences per difficulty and language within word ranges", () => {
  const ranges = { 1: [6, 8], 2: [10, 14], 3: [18, 24] } as const;
  for (const lang of ["en", "hi"] as const) for (const d of [1, 2, 3] as const) {
    const bank = SENTENCES[lang][d];
    expect(new Set(bank).size).toBeGreaterThanOrEqual(60);
    for (const s of bank) { expect(sentenceWords(s)).toBeGreaterThanOrEqual(ranges[d][0]); expect(sentenceWords(s)).toBeLessThanOrEqual(ranges[d][1]); }
  }
});
test("typing: never repeats the last 5 used", () => {
  const bank = SENTENCES.en[1], used: string[] = [], r = rng(7);
  for (let i = 0; i < 200; i++) { const s = pickSentence(bank, used, r); expect(used.slice(-5)).not.toContain(s); used.push(s); }
});

test("tiles: exactly N targets on unique positions in range for every level", () => {
  for (const l of [1, 2, 3] as const) for (let seed = 1; seed < 400; seed++) {
    const t = generateTiles(l, rng(seed));
    expect(t.size).toBe(TILE_GRID[l].size);
    expect(new Set(t.targets).size).toBe(t.targets.length);
    expect(t.targets.length).toBeGreaterThanOrEqual(TILE_GRID[l].min);
    expect(t.targets.length).toBeLessThanOrEqual(TILE_GRID[l].max);
    for (const i of t.targets) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(t.size ** 2); }
  }
});
test("tiles: 3 wrong taps regenerate the round; hits clear it", () => {
  let s = newTileState(2, rng(3));
  const wrongCell = Array.from({ length: 25 }, (_, i) => i).find(i => !s.round.targets.includes(i))!;
  s = tapTile(s, wrongCell, 2).state; s = tapTile(s, wrongCell, 2).state;
  expect(s.wrong).toBe(2);
  const r = tapTile(s, wrongCell, 2, rng(9));
  expect(r.reset).toBe(true); expect(r.state.wrong).toBe(0); expect(r.state.regenerated).toBe(1);
  let t = r.state;
  for (const i of t.round.targets) t = tapTile(t, i, 2).state;
  expect(roundCleared(t)).toBe(true);
});

test("ringing screen: new missions render with no dismiss controls while unfinished", () => {
  const src = readFileSync("src/components/wake/AlarmScreen.tsx", "utf8");
  const branch = src.slice(src.indexOf(": challenge ? <>"), src.indexOf(": event?.question ? <>"));
  expect(branch).toContain("MissionRunner");
  expect(branch).not.toMatch(/navigate|Continue|Close|Skip|onClose/);
  expect(src).toContain("beforeunload"); // existing back/leave guard still applies
  const runner = readFileSync("src/components/wake/missions/MissionRunner.tsx", "utf8");
  expect(runner).not.toMatch(/aria-label="Close|onClose/);
});
test("picker: 5 missions, no Off row, Shake disabled when unsupported", () => {
  const src = readFileSync("src/components/wake/missions/MissionPicker.tsx", "utf8");
  const ids = [...src.matchAll(/\{ id: "(\w+)", name:/g)].map(m => m[1]);
  expect(ids).toEqual(["math", "science", "shake", "typing", "tiles"]);
  expect(src).not.toMatch(/"Off"|id: "none"/);
  expect(src).toContain('r.id === "shake" && motion === false');
  expect(src).toContain("Not supported on this device");
});
test("challenge payload parses only new missions", () => {
  expect(parseChallenge('{"mission":"shake","difficulty":2,"rounds":1}')?.mission).toBe("shake");
  expect(parseChallenge("12 + 3 = ?")).toBeNull();
  expect(parseChallenge('{"mission":"math"}')).toBeNull();
});

test("typing: many mistakes then fixes still completes; deletions are always allowed", () => {
  const target = "open your eyes and smile today";
  let typed = "";
  for (const ch of "opne") { expect(acceptTypingInput(typed, typed + ch)).toBe(true); typed += ch; }
  expect(letterStates(typed, target, 2).includes("bad")).toBe(true);
  while (typed.length > 2) { expect(acceptTypingInput(typed, typed.slice(0, -1), "deleteContentBackward")).toBe(true); typed = typed.slice(0, -1); }
  for (const ch of target.slice(2)) { expect(acceptTypingInput(typed, typed + ch, "insertText")).toBe(true); typed += ch; }
  expect(typingComplete(typed, target, 2)).toBe(true);
});
test("tiles: several wrong taps across new layouts never block finishing", () => {
  let s = newTileState(1, rng(11));
  for (let k = 0; k < 7; k++) { const w = Array.from({ length: 16 }, (_, i) => i).find(i => !s.round.targets.includes(i))!; s = tapTile(s, w, 1, rng(20 + k)).state; }
  for (const i of s.round.targets) s = tapTile(s, i, 1).state;
  expect(roundCleared(s)).toBe(true);
  expect(s.regenerated).toBe(2);
});
test("live typing never falls back to the local bank", () => {
  const src = readFileSync("src/components/wake/missions/MissionRunner.tsx", "utf8");
  expect(src).toContain("if (!preview) return [];");
  expect(readFileSync("src/components/wake/AlarmScreen.tsx", "utf8")).not.toMatch(/<MissionRunner[^>]*preview/);
});

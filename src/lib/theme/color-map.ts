/**
 * Simple-theme color translator. Pure functions: parse a CSS color, classify it
 * (neutral / accent / semantic, light / dark) and return the Simple palette
 * equivalent for the role it plays (background, text, border, graphic).
 * Dark never runs this code.
 */

export const S = {
  canvas: "#F5F5F3",
  surface: "#FFFFFF",
  surface2: "#F0F0EC",
  surface3: "#E8E8E3",
  border: "#E7E7E3",
  borderStrong: "#D5D5CF",
  ink: "#111111",
  onInk: "#FFFFFF",
  ink2: "#55554F",
  ink3: "#6F6F69",
  ink4: "#8F8F89",
  disabled: "#C4C4BE",
  track: "#E8E8E4",
  success: "#1F6B43", successG: "#2E8B57", successBg: "#E8F3EC",
  warning: "#8A5A00", warningG: "#B7791F", warningBg: "#F7F0E1",
  danger: "#C93A3A", dangerBg: "#FBEAEA",
  info: "#1F57D6", infoBg: "#E8EFFD",
} as const;

export type Role = "bg" | "fg" | "border" | "graphic";
type RGBA = { r: number; g: number; b: number; a: number };
type Kind = "neutral" | "accent" | "success" | "warning" | "danger";

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", red: "#ff0000", gold: "#ffd700", silver: "#c0c0c0", gray: "#808080", grey: "#808080", orange: "#ffa500", yellow: "#ffff00", lime: "#00ff00", cyan: "#00ffff", purple: "#800080", green: "#008000", blue: "#0000ff", pink: "#ffc0cb", violet: "#ee82ee" };

function num(v: string, scale = 1) { v = v.trim(); return v.endsWith("%") ? (parseFloat(v) / 100) * scale : parseFloat(v); }

export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (NAMED[s]) return parseColor(NAMED[s]);
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const m = s.match(/^(rgba?|hsla?|oklch)\((.*)\)$/);
  if (!m) return null;
  const parts = m[2].replace(/\//g, " / ").split(/[\s,]+/).filter(Boolean);
  const slash = parts.indexOf("/");
  let alpha = 1;
  let vals = parts;
  if (slash >= 0) { alpha = num(parts[slash + 1] ?? "1"); vals = parts.slice(0, slash); }
  else if (vals.length === 4) { alpha = num(vals[3]); vals = vals.slice(0, 3); }
  if (vals.length < 3 || vals.some((v) => isNaN(parseFloat(v)))) return null;
  if (m[1].startsWith("rgb")) return { r: num(vals[0], 255) / 255, g: num(vals[1], 255) / 255, b: num(vals[2], 255) / 255, a: alpha };
  if (m[1].startsWith("hsl")) {
    const h = parseFloat(vals[0]) / 360, sat = num(vals[1]) / (vals[1].endsWith("%") ? 1 : 100), l = num(vals[2]) / (vals[2].endsWith("%") ? 1 : 100);
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return { r: f(h + 1 / 3), g: f(h), b: f(h - 1 / 3), a: alpha };
  }
  // oklch -> srgb
  const L = vals[0].endsWith("%") ? parseFloat(vals[0]) / 100 : parseFloat(vals[0]);
  const C = vals[1].endsWith("%") ? (parseFloat(vals[1]) / 100) * 0.4 : parseFloat(vals[1]);
  const H = (parseFloat(vals[2]) * Math.PI) / 180;
  const A = C * Math.cos(H), B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, ss = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss];
  const g = (x: number) => { x = Math.max(0, Math.min(1, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
  return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]), a: alpha };
}

export function toOklch({ r, g, b }: RGBA) {
  const li = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const R = li(r), G = li(g), B = li(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363433027 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

export function classify(c: RGBA): { kind: Kind; L: number } {
  const { L, C, h } = toOklch(c);
  if (C < 0.045 || L < 0.12) return { kind: "neutral", L };
  if (h < 38 || h >= 345) return { kind: "danger", L };
  if (h < 98) return { kind: "warning", L };
  if (h >= 140 && h < 178) return { kind: "success", L };
  return { kind: "accent", L };
}

const rgba = (hex: string, a: number) => {
  const c = parseColor(hex)!;
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${+a.toFixed(3)})`;
};
const withA = (hex: string, a: number) => (a >= 0.999 ? hex : rgba(hex, a));

/** Map one parsed color for a role. */
export function mapRGBA(c: RGBA, role: Role): string {
  if (c.a <= 0.001) return "transparent";
  const { kind, L } = classify(c);
  const a = c.a;
  const semantic = kind === "success" || kind === "warning" || kind === "danger";
  const sem = (k: "success" | "warning" | "danger", what: "text" | "graphic" | "tint") =>
    k === "success" ? (what === "text" ? S.success : what === "graphic" ? S.successG : S.successBg)
      : k === "warning" ? (what === "text" ? S.warning : what === "graphic" ? S.warningG : S.warningBg)
        : what === "tint" ? S.dangerBg : S.danger;

  if (role === "fg") {
    if (semantic && L > 0.35) return withA(sem(kind, "text"), Math.max(a, 0.85));
    // dark tinted text sat on a bright same-hue chip in Dark; that chip becomes a soft tint
    if ((kind === "success" || kind === "warning") && L <= 0.35 && toOklch(c).C > 0.05) return sem(kind, "text");
    if (kind === "neutral" || L <= 0.35) {
      if (L < 0.35) return a < 0.6 ? rgba(S.onInk, a) : S.onInk;
      const eff = L * a + (1 - a) * 0.1; // perceived brightness on dark
      if (eff > 0.8) return S.ink;
      if (eff > 0.62) return S.ink2;
      if (eff > 0.45) return S.ink3;
      return S.ink4;
    }
    return a < 0.5 ? S.ink3 : S.ink;
  }

  if (role === "border") {
    if (semantic && L > 0.35) return a < 0.4 ? withA(sem(kind, "graphic"), 0.35) : sem(kind, "graphic");
    if (kind === "neutral" || L <= 0.35) {
      if (L < 0.5) return S.border;
      return a < 0.25 ? S.border : a < 0.6 ? S.borderStrong : S.ink;
    }
    return a < 0.5 ? S.border : S.ink;
  }

  if (role === "graphic") {
    if (semantic && L > 0.35) return withA(sem(kind, "graphic"), a);
    if (kind === "neutral" || L <= 0.35) {
      if (L < 0.5) return a < 0.6 ? rgba(S.ink, a * 0.12) : S.track;
      return withA(S.ink, a);
    }
    return withA(S.ink, a);
  }

  // background
  if (semantic && L > 0.35) return a < 0.5 || kind !== "danger" ? sem(kind, "tint") : sem(kind, "graphic");
  if (kind === "neutral" || L <= 0.35) {
    if (L < 0.5) {
      if (a < 0.999) {
        if (a < 0.3) return rgba(S.ink, Math.min(0.06, a * 0.5));
        // pure black veils are scrims; tinted translucent panels are cards
        return L < 0.05 && a < 0.92 ? "rgba(17, 17, 17, 0.4)" : S.surface;
      }
      if (L < 0.16) return S.canvas;
      if (L < 0.36) return S.surface;
      return S.surface2;
    }
    if (a < 0.6) return rgba(S.ink, Math.min(0.08, a * 0.7));
    if (L > 0.85) return S.ink;
    return S.surface3;
  }
  return a < 0.5 ? rgba(S.ink, Math.min(0.06, a * 0.4)) : S.ink;
}

export const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^()]*\)|\b(?:white|black)\b/g;

export function mapColor(input: string, role: Role): string | null {
  const c = parseColor(input);
  return c ? mapRGBA(c, role) : null;
}

/** Replace every literal color in a value for the given role. */
export function mapValueColors(value: string, role: Role): string {
  return value.replace(COLOR_RE, (m) => { const c = parseColor(m); return !c || c.a <= 0.001 ? m : mapRGBA(c, role); });
}

/** color-mix(in x, COLOR p%, transparent) -> rgba so alpha math stays correct. */
export function flattenColorMix(value: string): string {
  return value.replace(/color-mix\(\s*in\s+[a-z]+\s*,\s*((?:#[0-9a-f]{3,8}|(?:rgba?|oklch|hsla?)\([^()]*\)|white|black))\s+([\d.]+)%\s*,\s*transparent\s*\)/gi, (all, col, pct) => {
    const c = parseColor(col);
    if (!c) return all;
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${+(c.a * (parseFloat(pct) / 100)).toFixed(3)})`;
  });
}

function splitTop(v: string, sep = ","): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (const ch of v) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out.map((x) => x.trim());
}

/** Gradients: rings (conic / hard stops) keep shape, decorative gradients go flat. */
export function mapBackground(value: string): string {
  value = flattenColorMix(value);
  if (!/gradient\(/.test(value)) return mapValueColors(value, "bg");
  const layers = splitTop(value);
  const mapped = layers.map((layer) => {
    const g = layer.match(/^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/s);
    if (!g) return mapValueColors(layer, "bg");
    if (g[1]) return "none";
    const stops = splitTop(g[3]);
    const pos = stops.map((s) => { const p = s.match(/([\d.]+)(%|deg)\s*$/); return p ? parseFloat(p[1]) : null; });
    const hard = pos.some((p, i) => i > 0 && p != null && pos[i - 1] != null && Math.abs(p - (pos[i - 1] as number)) <= 3);
    if (g[2] === "conic" || hard) return `${g[1] ?? ""}${g[2]}-gradient(${stops.map((s) => mapValueColors(s, g[2] === "conic" ? "graphic" : "bg")).join(", ")})`;
    return "none";
  });
  const keep = mapped.filter((m) => m !== "none");
  if (keep.length) return keep.join(", ");
  // flat fallback: first opaque stop
  for (const layer of layers) {
    for (const m of layer.match(COLOR_RE) ?? []) { const c = parseColor(m); if (c && c.a > 0.85) return mapRGBA(c, "bg"); }
  }
  const v = value.match(/var\(--[\w-]+\)/);
  return v ? v[0] : "none";
}

/** Map a single CSS declaration. Returns null to leave it untouched. */
export function mapDeclaration(prop: string, value: string): string | null {
  const p = prop.toLowerCase();
  if (p === "box-shadow" || p === "text-shadow") return value.trim() === "none" ? null : "none";
  if (p === "backdrop-filter" || p === "-webkit-backdrop-filter") return value.trim() === "none" ? null : "none";
  if (p === "filter") { if (!/drop-shadow/.test(value)) return null; const v = value.replace(/drop-shadow\([^()]*(\([^()]*\)[^()]*)*\)/g, "").trim(); return v || "none"; }
  if (p === "font-family") return /mono|courier|orbitron/i.test(value) && !/orbitron/i.test(value) ? null : '"Inter", system-ui, sans-serif';
  if (p.startsWith("--")) return null;
  if (!COLOR_RE.test(value) && !/color-mix|gradient/.test(value)) { COLOR_RE.lastIndex = 0; return null; }
  COLOR_RE.lastIndex = 0;
  let out: string;
  if (p === "background" || p === "background-image" || p === "background-color") out = mapBackground(value);
  else if (p === "color" || p === "caret-color" || p === "-webkit-text-fill-color" || p === "text-decoration-color" || p === "accent-color") out = mapValueColors(flattenColorMix(value), "fg");
  else if (p.startsWith("border") || p.startsWith("outline") || p === "column-rule-color") out = mapValueColors(flattenColorMix(value), "border");
  else if (p === "fill" || p === "stroke" || p === "stop-color" || p === "flood-color" || p === "lighting-color") out = mapValueColors(flattenColorMix(value), "graphic");
  else return null;
  return out === value ? null : out;
}

/** Custom property values: role guessed from the variable's name. */
export function mapCustomProperty(name: string, value: string): string | null {
  const n = name.toLowerCase();
  const v = flattenColorMix(value);
  if (!COLOR_RE.test(v) && !/gradient/.test(v)) { COLOR_RE.lastIndex = 0; return null; }
  COLOR_RE.lastIndex = 0;
  if (/glow|shadow/.test(n)) return /gradient/.test(v) ? "none" : "transparent";
  if (/gradient/.test(v)) return mapBackground(v);
  const only = v.trim().match(COLOR_RE);
  COLOR_RE.lastIndex = 0;
  if (!only || only.length !== 1 || only[0].length !== v.trim().length) return mapValueColors(v, "bg");
  const c = parseColor(only[0]);
  if (!c) return null;
  if (/(^|-)(bg|canvas|page|background|base|void|night)(-|$)/.test(n)) return S.canvas;
  if (/panel|surface|card|sheet|elev|raised|tile/.test(n)) return S.surface;
  if (/deep|well|inset|sunken|chip|soft|subtle/.test(n) && classify(c).L < 0.5) return S.surface2;
  if (/track|rail/.test(n)) return S.track;
  if (/border|line|stroke|hair|divider|rule|outline|edge/.test(n)) return mapRGBA(c, "border");
  if (/muted|dim|sub|faint|caption|quiet|secondary|text-2|ink-2/.test(n)) return classify(c).L > 0.35 ? S.ink3 : mapRGBA(c, "fg");
  if (/text|ink|fg|foreground|title|label|copy/.test(n)) return mapRGBA(c, "fg");
  const { kind, L } = classify(c);
  if (kind === "neutral") return L < 0.5 ? (c.a < 1 ? mapRGBA(c, "bg") : S.surface) : mapRGBA(c, "fg");
  return mapRGBA(c, "graphic");
}

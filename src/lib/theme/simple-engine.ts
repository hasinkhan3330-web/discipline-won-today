/**
 * Runtime Simple-theme layer. Active only while <html data-theme="simple">.
 * 1) Reads every same-origin stylesheet and emits a scoped override sheet
 *    (selectors prefixed with html[data-theme="simple"]), so Dark CSS is never edited.
 * 2) Remaps inline style colors and SVG fill/stroke attributes on live elements,
 *    remembering originals so switching back to Dark restores them exactly.
 * Elements inside [data-simple-keep] (e.g. seal artwork) are left alone.
 */
import { mapCustomProperty, mapDeclaration, flattenColorMix } from "./color-map";

const SHEET_ID = "axen-simple-overrides";
const ROOT = 'html[data-theme="simple"]';
const KEEP = "[data-simple-keep]";
const SKIP_VARS = /^--(tw-|color-|background$|foreground$|card|popover|primary|secondary|muted|accent|destructive|border$|input$|ring$|chart-|sidebar|radius|s-)/;
const SVG_ATTRS = ["fill", "stroke", "stop-color", "flood-color"] as const;

function splitTop(v: string, sep: string): string[] {
  const out: string[] = []; let depth = 0, cur = "", q = "";
  for (const ch of v) {
    if (q) { cur += ch; if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseDecls(block: string): Array<{ prop: string; value: string; important: boolean }> {
  return splitTop(block, ";").map((d) => {
    const i = d.indexOf(":");
    if (i < 0) return null;
    const prop = d.slice(0, i).trim();
    let value = d.slice(i + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, "").trim();
    return { prop, value, important };
  }).filter(Boolean) as Array<{ prop: string; value: string; important: boolean }>;
}

export function scopeSelector(sel: string): string | null {
  return splitTop(sel, ",").map((s) => {
    if (s.includes("data-theme")) return null;
    if (/^(:root|html)(?![\w-])/.test(s)) return s.replace(/^(:root|html)/, ROOT);
    if (/^:host/.test(s)) return null;
    const pe = s.indexOf("::");
    const keep = `:not(${KEEP} *)`;
    const scoped = pe >= 0 ? s.slice(0, pe) + keep + s.slice(pe) : s + keep;
    return /^body(?![\w-])/.test(s) ? `${ROOT} ${s}` : `${ROOT} ${scoped}`;
  }).filter(Boolean).join(", ") || null;
}

type Ctx = { vars: Map<string, string>; anims: Map<string, string> };

function resolveVars(value: string, vars: Map<string, string>): string {
  return value.replace(/var\(\s*(--color-[\w-]+)\s*(?:,[^()]*)?\)/g, (m, n) => vars.get(n) ?? m);
}

function mapBlock(block: string, ctx: Ctx, forKeyframe = false): string {
  const out: string[] = [];
  for (const { prop, value, important } of parseDecls(block)) {
    const imp = important ? " !important" : "";
    if (prop.startsWith("--")) {
      if (SKIP_VARS.test(prop)) continue;
      const m = mapCustomProperty(prop, value);
      if (m) out.push(`${prop}: ${m}${imp}`);
      continue;
    }
    if (!forKeyframe && (prop === "animation" || prop === "animation-name")) {
      let v = value, hit = false;
      for (const [name, alt] of ctx.anims) { const re = new RegExp(`(^|[\\s,])${name}(?=$|[\\s,])`, "g"); if (re.test(v)) { hit = true; v = v.replace(re, `$1${alt}`); } }
      if (hit) out.push(`${prop}: ${v}${imp}`);
      continue;
    }
    const resolved = flattenColorMix(resolveVars(value, ctx.vars));
    const m = mapDeclaration(prop, resolved);
    if (m != null) out.push(`${prop}: ${m}${imp}`);
  }
  return out.join("; ");
}

function bodyOf(cssText: string) { const a = cssText.indexOf("{"), b = cssText.lastIndexOf("}"); return a < 0 ? "" : cssText.slice(a + 1, b); }

function collect(rules: CSSRuleList, ctx: Ctx, sink: string[], pass: 0 | 1) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      if (pass === 0) {
        if (/^(:root|html|:host)/.test(r.selectorText)) for (const d of parseDecls(bodyOf(r.cssText))) if (d.prop.startsWith("--color-") || d.prop === "--color-white") ctx.vars.set(d.prop, d.value);
        continue;
      }
      const block = mapBlock(bodyOf(r.cssText), ctx);
      if (block) { const sel = scopeSelector(r.selectorText); if (sel) sink.push(`${sel} { ${block} }`); }
      // nested rules (native nesting)
      const nested = (r as unknown as { cssRules?: CSSRuleList }).cssRules;
      if (nested && nested.length) { const inner: string[] = []; collect(nested, ctx, inner, pass); }
    } else if (r instanceof CSSKeyframesRule) {
      if (pass === 0) {
        const frames: string[] = []; let changed = false;
        for (const f of Array.from(r.cssRules) as CSSKeyframeRule[]) { const b = mapBlock(bodyOf(f.cssText), ctx, true); if (b) changed = true; frames.push(`${f.keyText} { ${bodyOf(f.cssText)}; ${b} }`); }
        if (changed) { const alt = `simple-${r.name}`; ctx.anims.set(r.name, alt); sink.push(`@keyframes ${alt} { ${frames.join(" ")} }`); }
      }
    } else if (r instanceof CSSMediaRule || r instanceof CSSSupportsRule || (typeof CSSLayerBlockRule !== "undefined" && r instanceof CSSLayerBlockRule) || (typeof CSSContainerRule !== "undefined" && r instanceof CSSContainerRule)) {
      const inner: string[] = [];
      collect((r as CSSGroupingRule).cssRules, ctx, pass === 0 ? sink : inner, pass);
      if (pass === 1 && inner.length) {
        if (r instanceof CSSMediaRule) sink.push(`@media ${r.conditionText} { ${inner.join("\n")} }`);
        else if (r instanceof CSSSupportsRule) sink.push(`@supports ${r.conditionText} { ${inner.join("\n")} }`);
        else if (typeof CSSContainerRule !== "undefined" && r instanceof CSSContainerRule) sink.push(`@container ${(r as CSSContainerRule).containerName ?? ""} ${r.conditionText} { ${inner.join("\n")} }`);
        else sink.push(...inner); // unlayered output beats layered input
      }
    }
  }
}

export function buildOverrideCss(): string {
  const ctx: Ctx = { vars: new Map(), anims: new Map() };
  const sheets = Array.from(document.styleSheets).filter((s) => (s.ownerNode as Element | null)?.id !== SHEET_ID);
  const head: string[] = []; const body: string[] = [];
  for (const pass of [0, 1] as const) for (const sh of sheets) {
    let rules: CSSRuleList | null = null;
    try { rules = sh.cssRules; } catch { continue; }
    if (rules) collect(rules, ctx, pass === 0 ? head : body, pass);
  }
  return head.join("\n") + "\n" + body.join("\n");
}

/* ---------- inline styles + svg attributes ---------- */
type Rec = { orig: string; origImp: string; mapped: string };
const inlineRecs = new WeakMap<Element, Map<string, Rec>>();
const attrRecs = new WeakMap<Element, Map<string, Rec>>();
const touched = new Set<Element>();
let busy = false;

function processEl(el: Element) {
  if (el.closest(KEEP)) return;
  const st = (el as HTMLElement).style;
  const raw = el.getAttribute("style");
  if (st && raw) {
    let recs = inlineRecs.get(el);
    for (const { prop, value, important } of parseDecls(raw)) {
      const rec = recs?.get(prop);
      if (rec && st.getPropertyValue(prop) === rec.mapped) continue;
      const m = prop.startsWith("--") ? mapCustomProperty(prop, value) : mapDeclaration(prop, flattenColorMix(value));
      if (m == null) { if (rec) recs!.delete(prop); continue; }
      st.setProperty(prop, m, "important");
      if (!recs) { recs = new Map(); inlineRecs.set(el, recs); }
      recs.set(prop, { orig: value, origImp: important ? "important" : "", mapped: st.getPropertyValue(prop) });
      touched.add(el);
    }
  }
  if (el instanceof SVGElement) {
    for (const a of SVG_ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      let recs = attrRecs.get(el);
      const rec = recs?.get(a);
      if (rec && v === rec.mapped) continue;
      const m = mapDeclaration(a, v);
      if (m == null) continue;
      el.setAttribute(a, m);
      if (!recs) { recs = new Map(); attrRecs.set(el, recs); }
      recs.set(a, { orig: v, origImp: "", mapped: m });
      touched.add(el);
    }
  }
}

function processTree(root: Element) {
  processEl(root);
  root.querySelectorAll("[style],[fill],[stroke],[stop-color],[flood-color]").forEach(processEl);
}

function restoreAll() {
  for (const el of touched) {
    const st = (el as HTMLElement).style;
    inlineRecs.get(el)?.forEach((r, prop) => { if (st.getPropertyValue(prop) === r.mapped) st.setProperty(prop, r.orig, r.origImp); });
    attrRecs.get(el)?.forEach((r, a) => { if (el.getAttribute(a) === r.mapped) el.setAttribute(a, r.orig); });
    inlineRecs.delete(el); attrRecs.delete(el);
  }
  touched.clear();
}

let observer: MutationObserver | null = null;
let headObserver: MutationObserver | null = null;
let pending = new Set<Element>();
let raf = 0;
let sheetTimer = 0;

function writeSheet() {
  let tag = document.getElementById(SHEET_ID) as HTMLStyleElement | null;
  if (!tag) { tag = document.createElement("style"); tag.id = SHEET_ID; document.head.appendChild(tag); }
  const css = buildOverrideCss();
  if (tag.textContent !== css) tag.textContent = css;
}

function flush() {
  raf = 0; busy = true;
  const list = pending; pending = new Set();
  list.forEach((n) => { if (n.isConnected) processTree(n); });
  busy = false;
}

export function startSimple() {
  if (typeof document === "undefined" || observer) return;
  writeSheet();
  processTree(document.documentElement);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes") pending.add(m.target as Element);
      else m.addedNodes.forEach((n) => { if (n.nodeType === 1) pending.add(n as Element); });
    }
    if (!raf && pending.size) raf = requestAnimationFrame(flush);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", ...SVG_ATTRS] });
  headObserver = new MutationObserver((muts) => {
    if (muts.every((m) => Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every((n) => (n as Element).id === SHEET_ID))) return;
    clearTimeout(sheetTimer); sheetTimer = window.setTimeout(writeSheet, 120);
  });
  headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  void busy;
}

export function stopSimple() {
  if (typeof document === "undefined") return;
  observer?.disconnect(); observer = null;
  headObserver?.disconnect(); headObserver = null;
  if (raf) cancelAnimationFrame(raf); raf = 0; pending.clear();
  document.getElementById(SHEET_ID)?.remove();
  restoreAll();
}

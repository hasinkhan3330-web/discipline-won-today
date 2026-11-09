import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCoachV2State } from "@/utils/coach-v2.functions";
import type { VoiceApi, VoicePhase } from "@/components/VoiceCoach";
import { OrbCanvas } from "./OrbCanvas";
import s from "./coach-orb.module.css";

export const ORB_THEMES = { lime: ["#C6F432", "#2FB8C9"], ice: ["#4DA3FF", "#7FD6FF"], violet: ["#D17BFF", "#8A7CFF"] } as const;
type ThemeKey = keyof typeof ORB_THEMES;
const SWATCH: Record<ThemeKey, string> = { lime: "linear-gradient(135deg,#C6F432,#2FB8C9)", ice: "#4DA3FF", violet: "linear-gradient(135deg,#ff8bd0,#b57cff)" };
const THEME_LABEL: Record<ThemeKey, string> = { lime: "1. Lime", ice: "2. Ice blue", violet: "3. Violet" };
const LABEL: Record<VoicePhase, string> = { idle: "Tap the mic to talk", listen: "Listening...", think: "Thinking...", speak: "Coach is speaking..." };
const CHIPS = ["Plan my next 7 days", "Fix my weakest habit", "I feel like quitting"];
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

/** "DD Mon YYYY", e.g. 09 Aug 2027. */
export function formatPillDate(iso: string): string {
  const d = new Date(iso);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")} ${m} ${d.getFullYear()}`;
}
export function pillText(row: { status?: string | null; current_period_end?: string | null } | null, now = new Date()): string {
  if (!row?.current_period_end) return "Free";
  const end = new Date(row.current_period_end);
  const active = end > now && row.status !== "expired" && row.status !== "halted";
  return `${active ? "Active" : "Expired"} · ${formatPillDate(row.current_period_end)}`;
}

export function CoachOrbScreen({ voice, chatBusy, onChip, onKeyboard, sheet, planSheet, onStat }: {
  voice: VoiceApi; chatBusy: boolean; onChip: (text: string) => void; onKeyboard: () => void; sheet: ReactNode; planSheet: ReactNode; onStat: () => void;
}) {
  const load = useServerFn(getCoachV2State);
  const [theme, setTheme] = useState<ThemeKey>("lime");
  const [pct, setPct] = useState<number | null>(null);
  const [pill, setPill] = useState<string>("Free");
  const [mode, setMode] = useState<VoicePhase>("idle");
  const busyRef = useRef(chatBusy); busyRef.current = chatBusy;
  const voiceRef = useRef(voice); voiceRef.current = voice;

  useEffect(() => { try { const t = localStorage.getItem("axen-theme") as ThemeKey | null; if (t && t in ORB_THEMES) setTheme(t); } catch { /* storage blocked */ } }, []);
  const pick = (k: ThemeKey) => { setTheme(k); try { localStorage.setItem("axen-theme", k); } catch { /* storage blocked */ } };

  const refresh = useCallback(() => load({ data: { timezone: tz() } }).then((r) => setPct(Math.round((r as { confidence: number }).confidence))).catch(() => {}), [load]);
  useEffect(() => { void refresh(); const h = () => void refresh(); window.addEventListener("axen:coach-plan-changed", h); return () => window.removeEventListener("axen:coach-plan-changed", h); }, [refresh]);

  useEffect(() => {
    let off = false;
    const run = async () => {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      const { data } = await supabase.from("subscriptions").select("status, current_period_end").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!off) setPill(pillText(data));
    };
    void run(); window.addEventListener("subscription:refresh", run);
    return () => { off = true; window.removeEventListener("subscription:refresh", run); };
  }, []);

  const [a, b] = ORB_THEMES[theme];
  // Coach-only: hide the global strip and tint the nav while this screen is mounted.
  useEffect(() => {
    const body = document.body; body.dataset.coachOrb = "1"; body.style.setProperty("--coach-a", a);
    return () => { delete body.dataset.coachOrb; body.style.removeProperty("--coach-a"); };
  }, [a]);

  const getMode = useCallback((): VoicePhase => { const p = voiceRef.current.phase(); return p === "idle" && busyRef.current ? "think" : p; }, []);
  const getLevel = useCallback(() => voiceRef.current.level(), []);
  const status = voice.error && mode === "idle" ? voice.error : LABEL[mode];

  return (
    <section className={s.app} style={{ "--a": a, "--b": b } as CSSProperties} aria-label="AXEN AI Coach">
      <div className={`${s.scroll} ${s.themes}`}>
        {(Object.keys(ORB_THEMES) as ThemeKey[]).map((k) => <button key={k} className={`${s.th} ${theme === k ? s.on : ""}`} onClick={() => pick(k)}><i style={{ background: SWATCH[k] }} />{THEME_LABEL[k]}</button>)}
      </div>
      <div className={s.head}>
        <div className={s.logo}><b>◆</b>AXEN</div>
        <div className={s.right}>
          <button className={s.kb} onClick={onKeyboard} aria-label="Open text coach"><Keyboard size={18} strokeWidth={1.6} /></button>
          <div className={s.pill}>{pill}</div>
        </div>
      </div>
      <OrbCanvas colors={[a, b]} getMode={getMode} getLevel={getLevel} onMode={setMode} />
      <button className={s.stat} onClick={onStat}><strong>{pct ?? 0}%</strong><span>Coach knows you</span></button>
      <div className={s.status} style={{ color: mode === "idle" ? "var(--muted)" : "var(--a)" }} aria-live="polite">{status}</div>
      <div className={`${s.scroll} ${s.chips}`}>{CHIPS.map((c) => <button key={c} className={s.chip} disabled={chatBusy} onClick={() => onChip(c)}>{c}</button>)}</div>
      <div className={s.card}>
        <div><small>Private real-time session</small><h2>Talk to your coach</h2></div>
        <button className={`${s.mic} ${mode === "listen" ? s.live : ""}`} onClick={voice.toggle} disabled={voice.busy} aria-label={voice.live ? "End voice session" : "Talk to your coach"}>
          <svg viewBox="0 0 24 24"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.9V22h2v-3.1A8 8 0 0 0 20 11z" /></svg><span className={s.sq} />
        </button>
      </div>
      {voice.extras && <div className={s.extras}>{voice.extras}</div>}
      {sheet}
      {planSheet}
    </section>
  );
}

export function OrbSheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  if (!open) return null;
  return <div className={s.backdrop} onClick={onClose}><div className={s.sheet} role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}><button className={s.grab} onClick={onClose} aria-label="Close" />{children}</div></div>;
}

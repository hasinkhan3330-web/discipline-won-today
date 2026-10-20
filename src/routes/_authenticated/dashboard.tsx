import { CoinBadge } from "@/components/CoinBadge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlement } from "@/utils/premium.functions";
import { User, Swords, Crown, Flower2, BarChart3, Lock, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { Paywall } from "@/components/Paywall";
import { PaywallGate } from "@/components/PaywallGate";
import { TaskVerify, type VerifyKind } from "@/components/TaskVerify";
import { TopThreeModal } from "@/components/TopThreeModal";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useEntitlementContext, EntitlementProvider } from "@/components/EntitlementProvider";
import { ProtectedFeatureGate } from "@/components/ProtectedFeatureGate";
import { Leaderboard } from "@/components/Leaderboard";
import { NudgeListener } from "@/components/verified/NudgeListener";

import { TrialBanner, TrialWelcome } from "@/components/TrialBanner";
import { GateSkeleton } from "@/components/GateSkeleton";
import { AiCoach } from "@/components/AiCoach";



import { CropModal } from "@/components/CropModal";
import { Onboarding, type OnboardingAnswers } from "@/components/Onboarding";
import { flushQuizToProfile } from "@/lib/quiz";
import { THEMES, MILESTONES, THEME_PHOTO, THEME_VIDEO, PRO_THEMES, type ThemeKey } from "@/constants/themes";
import axenLogo from "@/assets/axen-logo.png";

import { useMeditation } from "@/hooks/useMeditation";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { HomeTab } from "@/tabs/HomeTab";
import { ZenTab } from "@/tabs/ZenTab";
import { StatsTab } from "@/tabs/StatsTab";
import { RankTab } from "@/tabs/RankTab";
import { useMilestoneSeals } from "@/hooks/useMilestoneSeals";
import { ProfileTab } from "@/tabs/ProfileTab";

import { stopAlarm as stopAlarmAudio, previewTone } from "@/lib/alarm-audio";

import toneTechno from "@/assets/ringtones/techno_beat.mp3.asset.json";
import toneMeduzza from "@/assets/ringtones/MEDUZZA.mp3.asset.json";
import toneModern from "@/assets/ringtones/Modern_talking.mp3.asset.json";
import toneOppenheimer from "@/assets/ringtones/Oppenheimer.mp3.asset.json";
import toneClassic from "@/assets/ringtones/Classic.mp3.asset.json";
import toneMorning from "@/assets/ringtones/good_morning.mp3.asset.json";
import toneSuperLoud from "@/assets/ringtones/the_cutie_pie-super-loud-ahh-alarm-165805_1.mp3.asset.json";
import toneScariest from "@/assets/ringtones/The_Scariest_Alarm_256k.mp3.asset.json";
import toneRetro from "@/assets/ringtones/retro_emergency.wav.asset.json";
import toneLoudEmergency from "@/assets/ringtones/loud_emergency.mp3.asset.json";
import { publicDisplayName, safeName } from "@/lib/display-name";
import { WakeProtocol } from "@/components/WakeProtocol";
import { readWakeState } from "@/lib/wake.functions";
import { webAlarmScheduler } from "@/lib/web-alarm-scheduler";
import type { AlarmState } from "@/lib/wake-types";

const WAKE_OPTIONS = [
  { time: "4AM", pts: 10, tag: "ELITE", line: "The world sleeps. You rise." },
  { time: "5AM", pts: 7,  tag: "STRONG", line: "Before the sun. Before the noise." },
  { time: "6AM", pts: 5,  tag: "SOLID", line: "First light. First move." },
  { time: "7AM", pts: 3,  tag: "BASE",  line: "Better than yesterday." },
] as const;

const RINGTONES = [
  { id: "superloud",   name: "SUPER LOUD",     url: toneSuperLoud.url },
  { id: "scariest",    name: "SCARIEST ALARM", url: toneScariest.url },
  { id: "techno",      name: "TECHNO BEAT",    url: toneTechno.url },
  { id: "meduzza",     name: "MEDUZZA",        url: toneMeduzza.url },
  { id: "modern",      name: "MODERN TALKING", url: toneModern.url },
  { id: "oppenheimer", name: "OPPENHEIMER",    url: toneOppenheimer.url },
  { id: "classic",     name: "CLASSIC",        url: toneClassic.url },
  { id: "morning",     name: "GOOD MORNING",   url: toneMorning.url },
  { id: "retro",       name: "RETRO EMERGENCY", url: toneRetro.url },
  { id: "emergency",   name: "LOUD EMERGENCY",  url: toneLoudEmergency.url },
];


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AXEN Habit & Discipline" },
      { name: "description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, legendary quotes, streaks." },
      { property: "og:title", content: "Dashboard — AXEN Habit & Discipline" },
      { property: "og:description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, legendary quotes, streaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardShell,
});

/** One shared, server-authoritative entitlement verdict for the whole app. */
function DashboardShell() {
  const ctx = Route.useRouteContext() as { user?: { id: string } };
  return (
    <EntitlementProvider userId={ctx?.user?.id ?? null}>
      <NudgeListener userId={ctx?.user?.id ?? null} />
      <App />
    </EntitlementProvider>
  );
}


type Task = { id: number; icon: string; name: string; pts: number; done: boolean };

function App() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const [tab, setTab] = useState("home");
  useEffect(() => { window.dispatchEvent(new CustomEvent("axen:active-tab", { detail: tab })); }, [tab]);
  const [themeKey, setThemeKeyState] = useState<ThemeKey>("hourglass");
  const setThemeKey = (k: ThemeKey) => {
    setThemeKeyState(k);
    try { localStorage.setItem("dwt_theme", k); } catch {}
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dwt_theme") as ThemeKey | null;
      if (saved && THEMES[saved]) setThemeKeyState(saved);
    } catch {}
  }, []);
  const [celebration, setCelebration] = useState<(typeof MILESTONES)[number] | null>(null);

  const [coins, setCoins] = useState(0);
  const [myRankBadge, setMyRankBadge] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [shields, setShields] = useState(0);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>({});
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [streakLoaded, setStreakLoaded] = useState(false);


  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<{ n: string; c: number; s: number; img: string; you?: boolean }[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [life, setLife] = useState<{ bestStreak: number; lifetimeCoins: number; heat: { date: string; count: number }[]; topTask: { icon: string; name: string; count: number } | null; focusMinutes: number; taskTotal?: number; completionCount?: number } | null>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("YOU");
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isActive: hasActiveSubscription, loading: subLoading } = useSubscription(myId);
  // Paid subscription access fallback, refreshed in real time.
  const access = useAccessControl(myId);
  // ONE centralized, server-clock paid entitlement verdict.
  const ent = useEntitlementContext();
  // Authoritative entitlement, computed server-side from the bearer token.
  const checkEntitlement = useServerFn(getEntitlement);
  const [serverEntitled, setServerEntitled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    const run = () => checkEntitlement()
      .then(r => { if (!cancelled) setServerEntitled(!!(r as any)?.entitled); })
      .catch(() => { if (!cancelled) setServerEntitled(false); });
    run();
    window.addEventListener("focus", run);
    window.addEventListener("subscription:refresh", run);
    return () => { cancelled = true; window.removeEventListener("focus", run); window.removeEventListener("subscription:refresh", run); };
  }, [myId, checkEntitlement, hasActiveSubscription]);


  const fallbackAvatar = (n: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=0a0a19&color=00ff88&size=200&bold=true`;

  const refreshAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    setMyId(uid);
    setMyEmail(userData.user?.email ?? null);

    // A held shield covers a fully missed day before the penalty runs.
    // The server ledger makes this idempotent across refreshes and races.
    try {
      const { data: sh } = await (supabase.rpc as any)("use_streak_shield");
      const shRow = Array.isArray(sh) ? sh[0] : sh;
      if (shRow?.applied) {
        toast.success("Shield used", { description: "You missed a day — your streak survived." });
      }
    } catch {}

    try {
      const { data: pen } = await (supabase.rpc as any)("apply_daily_penalty");
      const row = Array.isArray(pen) ? pen[0] : pen;
      if (row?.penalized) {
        toast.error("−3 COINS", { description: "You missed a task yesterday. Discipline demands 100%." });
      }
    } catch {}

    const today = new Date().toISOString().slice(0, 10);
    const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    // Pre-signup quiz answers cached before the account existed — write them once.
    await flushQuizToProfile(uid).catch(() => false);

    const [{ data: prof }, { data: taskRows }, { data: doneToday }, { data: leaders }, { data: weekRows }] = await Promise.all([
      supabase.from("profiles").select("display_name, coins, streak, longest_streak, avatar_url, shields, onboarded, referred_by, preferred_name, age_range, acquisition_source, primary_goal, first_habit, social_hours_daily, biggest_distraction, wake_time, sleep_time, consistency_days, routine_breaker, preferred_focus_time, commitment_milestone, onboarding_step").eq("id", uid).maybeSingle(),

      supabase.from("tasks").select("id, icon, name, pts, sort_order, frequency, duration_days, started_on, require_scan, scan_classes").eq("user_id", uid).eq("is_active", true).order("sort_order"),
      supabase.from("task_completions").select("task_id").eq("user_id", uid).eq("completed_on", today),
      supabase.from("public_profiles").select("id, display_name, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20),
      supabase.from("task_completions").select("completed_on").eq("user_id", uid).gte("completed_on", sevenAgo),
    ]);

    if (prof) {
      setCoins(prof.coins ?? 0);
      setStreak(prof.streak ?? 0);
      setMyName(publicDisplayName(prof.display_name, uid));
      setMyAvatar(prof.avatar_url || "");
      setShields((prof as any).shields ?? 0);
      setOnboarded(!!(prof as any).onboarded);
      setReferredBy((prof as any).referred_by ?? null);
      setOnboardingStep(Number((prof as any).onboarding_step ?? 1));
      setOnboardingAnswers({
        preferred_name: (prof as any).preferred_name ?? safeName(prof.display_name, "") ?? "",
        age_range: (prof as any).age_range ?? undefined,
        acquisition_source: (prof as any).acquisition_source ?? undefined,
        primary_goal: (prof as any).primary_goal ?? undefined,
        first_habit: (prof as any).first_habit ?? undefined,
        social_hours_daily: (prof as any).social_hours_daily ?? undefined,
        biggest_distraction: (prof as any).biggest_distraction ?? undefined,
        wake_time: (prof as any).wake_time?.slice?.(0,5) ?? undefined,
        sleep_time: (prof as any).sleep_time?.slice?.(0,5) ?? undefined,
        consistency_days: (prof as any).consistency_days ?? undefined,
        routine_breaker: (prof as any).routine_breaker ?? undefined,
        preferred_focus_time: (prof as any).preferred_focus_time ?? undefined,
        commitment_milestone: (prof as any).commitment_milestone ?? undefined,
      });
    } else {
      setOnboarded(true);
    }
    setStreakLoaded(true);


    const doneIds = new Set((doneToday || []).map(d => d.task_id as string));
    setTasks((taskRows || []).map((r, i) => ({
      id: i + 1,
      _uuid: r.id as string,
      icon: r.icon,
      name: r.name,
      pts: /wake/i.test(r.name) ? 10 : /cold|shower|workout|gym/i.test(r.name) ? 3 : Math.min(5, Math.max(1, r.pts ?? 2)),
      done: doneIds.has(r.id as string),
      frequency: r.frequency,
      durationDays: r.duration_days,
      startedOn: r.started_on,
      requireScan: false,
      scanClasses: [] as string[],
    }) as unknown as Task));

    setBoard((leaders || []).map(l => ({
      n: publicDisplayName(l.display_name, l.id),
      c: l.coins ?? 0,
      s: l.streak ?? 0,
      img: l.avatar_url || fallbackAvatar(publicDisplayName(l.display_name, l.id)),
      you: l.id === uid,
    })));

    const total = (taskRows || []).length || 1;
    const counts: Record<string, number> = {};
    (weekRows || []).forEach(r => { counts[r.completed_on] = (counts[r.completed_on] || 0) + 1; });
    const bars: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      bars.push(Math.min(100, Math.round((counts[d] || 0) / total * 100)));
    }
    setWeekly(bars);

    // ---- lifetime stats ----
    const thirtyAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const [{ data: allComps }, { data: earns }, { data: focusSessions }] = await Promise.all([
      supabase.from("task_completions").select("task_id, completed_on").eq("user_id", uid),
      supabase.from("coin_transactions").select("amount").eq("user_id", uid).gt("amount", 0),
      supabase.from("focus_sessions").select("minutes").eq("user_id", uid),
    ]);

    const byDay: Record<string, number> = {};
    const byTask: Record<string, number> = {};
    (allComps || []).forEach(c => {
      if (c.completed_on >= thirtyAgo) byDay[c.completed_on] = (byDay[c.completed_on] || 0) + 1;
      byTask[c.task_id as string] = (byTask[c.task_id as string] || 0) + 1;
    });

    const heat: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      heat.push({ date: d, count: byDay[d] || 0 });
    }

    let topTask: { icon: string; name: string; count: number } | null = null;
    Object.entries(byTask).forEach(([tid, count]) => {
      if (!topTask || count > topTask.count) {
        const t = (taskRows || []).find(r => r.id === tid);
        if (t) topTask = { icon: t.icon, name: t.name, count };
      }
    });

    setLife({
      bestStreak: (prof as any)?.longest_streak ?? prof?.streak ?? 0,
      lifetimeCoins: (earns || []).reduce((s, e) => s + (e.amount || 0), 0),
      heat,
      topTask,
      focusMinutes: (focusSessions || []).reduce((sum, session) => sum + (session.minutes || 0), 0),
      taskTotal: (taskRows || []).length,
      completionCount: (allComps || []).length,
    });
  };


  // Single background boot fetch — guarded so React's double-mount (and fast
  // remounts) never fire the whole dashboard query set twice.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void refreshAll()
      .catch(error => console.error("AXEN dashboard initialization failed", error instanceof Error ? error.message : "Unknown initialization error"));
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const question = (event as CustomEvent<{ question?: string }>).detail?.question;
      if (!question) return;
      setTab("coach");
      // Coach is a Pro feature: locked users see the paywall instead of a failed request.
      if (!ent.premiumAccess) return;
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("axen:coach-question", { detail: { question } })), 420);
    };
    window.addEventListener("axen:ask-coach", handler);
    return () => window.removeEventListener("axen:ask-coach", handler);
  }, [ent.premiumAccess]);



  const buyShield = async () => {
    const { data, error } = await (supabase.rpc as any)("buy_streak_shield");
    if (error) {
      toast.error("Could not buy a shield", { description: error.message });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setCoins(row.coins ?? coins);
      setShields(row.shields ?? shields);
      toast.success("Shield acquired", { description: "One missed day will not break your streak." });
    }
  };

  const finishOnboarding = async () => {
    setOnboarded(true);
    await refreshAll();
  };

  // ---- streak milestones: auto-evolve theme + wallpaper, celebrate once; revert on break ----
  useEffect(() => {
    if (!streakLoaded) return;

    // 1) if the active theme is no longer unlocked (streak broke), fall back to base
    setThemeKeyState(prev => {
      if (streak >= THEMES[prev].unlock) return prev;
      try { localStorage.setItem("dwt_theme", "space"); } catch {}
      return "space";
    });

    const reached = [...MILESTONES].reverse().find(m => streak >= m.d);
    let seen = 0;
    try { seen = Number(localStorage.getItem("dwt_milestone") || 0); } catch {}

    // 2) streak dropped below the last celebrated milestone -> reset so it can re-celebrate later
    if (seen > (reached?.d ?? 0)) {
      try { localStorage.setItem("dwt_milestone", String(reached?.d ?? 0)); } catch {}
      setCelebration(null);
      return;
    }

    // 3) new milestone reached
    if (!reached || seen >= reached.d) return;
    try { localStorage.setItem("dwt_milestone", String(reached.d)); } catch {}
    setThemeKey(reached.theme);
    setCelebration(reached);
    toast.success(`${reached.icon} ${reached.title}`, { description: reached.line });
    const t = setTimeout(() => setCelebration(null), reached.ms);
    return () => clearTimeout(t);
  }, [streak, streakLoaded]);



  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const openCropper = (file: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { alert("Use a JPG, PNG or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image too large (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadCroppedBlob = async (blob: Blob) => {
    if (!myId) return;
    setUploading(true);
    try {
      const path = `${myId}/profile.webp`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr || new Error("signed url failed");
      const url = `${signed.signedUrl}&v=${Date.now()}`;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", myId);
      if (updErr) throw updErr;
      setMyAvatar(url);
      setCropSrc(null);
      await refreshAll();
    } catch (e: any) {
      alert("Upload failed: " + (e?.message || "unknown"));
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!myId) return;
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([`${myId}/profile.webp`]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", myId);
      setMyAvatar("");
      await refreshAll();
    } catch (e: any) {
      alert("Could not remove photo: " + (e?.message || "unknown"));
    } finally {
      setUploading(false);
    }
  };


  const [showWake, setShowWake] = useState(false);
  const [wakeState, setWakeState] = useState<AlarmState | null>(null);
  const readAlarm = useServerFn(readWakeState);
  const [ringtone, setRingtone] = useState<string>(() => {
    if (typeof window === "undefined") return "superloud";
    const saved = localStorage.getItem("dwt_ringtone");
    return saved && RINGTONES.some(r => r.id === saved) ? saved : "superloud";
  });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ uuid: string; kind: VerifyKind; classes: string[]; scan: boolean } | null>(null);
  const [topThree, setTopThree] = useState<string | null>(null);
  const pickRingtone = (id: string) => {
    setRingtone(id);
    try { localStorage.setItem("dwt_ringtone", id); } catch { /* ignore */ }
    if (previewId === id) { stopAlarmAudio(); setPreviewId(null); return; }
    const r = RINGTONES.find(x => x.id === id);
    if (r) { previewTone(r.url); setPreviewId(id); }
  };
  const stopPreview = () => { stopAlarmAudio(); setPreviewId(null); };

  const [wakeMode, setWakeMode] = useState<"math" | "science">("math");
  useEffect(() => {
    let live = true;
    const refreshAlarm = async () => {
      if (!myId) return;
      try {
        const state = await readAlarm();
        if (!live) return;
        webAlarmScheduler.synchronize(state);
        setWakeState(state);
        if (state.settings) { setRingtone(state.settings.tone); setWakeMode(state.settings.mode); }
      } catch { /* readiness displays connection errors */ }
    };
    void refreshAlarm();
    window.addEventListener("axen:wake-updated", refreshAlarm);
    const solved = () => { void refreshAll(); };
    window.addEventListener("axen:wake-solved", solved);
    return () => { live = false; window.removeEventListener("axen:wake-updated", refreshAlarm); window.removeEventListener("axen:wake-solved", solved); };
  }, [myId, readAlarm]);

  const theme = THEMES[themeKey];
  const G = theme.accent;
  const G2 = theme.accent2;
  // wallpaper is bound to the selected theme — changing theme changes wallpaper too
  const wallLevel = theme.wall;
  const wallPhoto = THEME_PHOTO[themeKey];
  const wallVideo = THEME_VIDEO[themeKey];



  useEffect(() => () => stopAlarmAudio(), []);

  const completeTaskRpc = async (uuid: string, overridePts?: number) => {
    if (typeof overridePts === "number") {
      await supabase.from("tasks").update({ pts: overridePts }).eq("id", uuid);
    }
    const { data, error } = await supabase.rpc("complete_task", { _task_id: uuid });
    if (typeof overridePts === "number") {
      await supabase.from("tasks").update({ pts: 10 }).eq("id", uuid);
    }
    if (error) { console.error(error); toast.error("Could not save that task", { description: error.message }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) { setCoins(row.coins ?? 0); setStreak(row.streak ?? 0); }
    setTasks(p => p.map(t => (t as any)._uuid === uuid ? { ...t, done: true } : t));

    // Keep the Stats/Rank derived numbers live instead of stale until the next reload.
    const today = new Date().toISOString().slice(0, 10);
    const awarded = Number(row?.awarded ?? 0);
    setLife(prev => prev ? {
      ...prev,
      bestStreak: Math.max(prev.bestStreak, Number(row?.longest_streak ?? row?.streak ?? 0)),
      lifetimeCoins: prev.lifetimeCoins + Math.max(0, awarded),
      heat: prev.heat.map(h => h.date === today ? { ...h, count: h.count + 1 } : h),
    } : prev);
    setWeekly(prev => {
      const total = tasks.length || 1;
      const next = [...prev];
      const doneToday = tasks.filter(t => (t as any).done || (t as any)._uuid === uuid).length;
      next[next.length - 1] = Math.min(100, Math.round(doneToday / total * 100));
      return next;
    });

    supabase.from("public_profiles").select("id, display_name, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20).then(({ data: leaders }) => {
      if (!leaders) return;
      setBoard(leaders.map(l => ({
        n: publicDisplayName(l.display_name, l.id),
        c: l.coins ?? 0, s: l.streak ?? 0,
        img: l.avatar_url || fallbackAvatar(publicDisplayName(l.display_name, l.id)),
        you: l.id === myId,
      })));
    });
  };

  const completeHabitFromProfile = async (uuid: string) => {
    const t = tasks.find(x => (x as any)._uuid === uuid);
    if (t && /wake/i.test(t.name)) {
      setShowWake(true);
      return;
    }
    await completeTaskRpc(uuid);
  };

  // One-time streak milestone bonuses (server decides; idempotent).
  const milestoneSeals = useMilestoneSeals(myId, coins);
  const milestoneRef = useRef(0);
  useEffect(() => {
    const best = Math.max(streak, life?.bestStreak ?? 0);
    if (!myId || best < 7 || milestoneRef.current >= best) return;
    milestoneRef.current = best;
    (async () => {
      const { data, error } = await (supabase as any).rpc("claim_streak_milestones");
      if (error || !Array.isArray(data)) return;
      const fresh = data.filter((r: any) => r.newly_awarded);
      if (!fresh.length) return;
      const total = fresh.reduce((sum: number, r: any) => sum + Number(r.coins), 0);
      setCoins(c => c + total);
      toast.success(`+${total.toLocaleString()} coins · ${fresh[fresh.length - 1].milestone}-day streak badge unlocked`);
    })();
  }, [streak, life?.bestStreak, myId]);

  /** Logs a finished Zen session on the account and credits its coins. */
  const onZenComplete = async (minutes: number, row: { coins: number; awarded: number }) => {
    const awarded = Number(row?.awarded ?? 0);
    if (typeof row?.coins === "number") setCoins(row.coins);
    setLife(prev => prev ? { ...prev, lifetimeCoins: prev.lifetimeCoins + Math.max(0, awarded) } : prev);
    if (awarded > 0) toast.success(`+${awarded} coins · ${minutes} min of stillness logged`);
  };

  // One-time 5,000-coin milestone gift, stored on the account so it never repeats.
  const giftRef = useRef(false);
  useEffect(() => {
    if (!myId || coins < 5000 || giftRef.current) return;
    giftRef.current = true;
    (async () => {
      const { data: existing } = await supabase
        .from("unlock_rewards").select("id")
        .eq("user_id", myId).eq("reward_key", "gift_5000").maybeSingle();
      if (existing) return;
      const { error } = await supabase
        .from("unlock_rewards")
        .insert({ user_id: myId, reward_key: "gift_5000", metadata: { coins } } as never);
      if (error) { giftRef.current = false; return; }
      toast.success("5,000 coin milestone unlocked", {
        description: "Your exclusive theme reward is now available on the Rank screen.",
      });
    })();
  }, [coins, myId]);

  const med = useMeditation(tasks as any, completeTaskRpc, onZenComplete);

  const onFocusComplete = async (
    tier: { id: string; reward: number },
    lockMode: "strict" | "flex",
    apps: string[],
  ): Promise<number | null> => {
    const { data, error } = await (supabase as any).rpc("complete_focus_session", {
      _tier: tier.id, _lock_mode: lockMode, _blocked_apps: apps,
    });
    if (error) {
      console.error(error);
      toast.error("Could not credit that focus session", { description: error.message });
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const newCoins = row?.coins ?? null;
    const awarded = Number(row?.awarded ?? 0);
    if (typeof newCoins === "number") setCoins(newCoins);
    setLife(prev => prev ? { ...prev, lifetimeCoins: prev.lifetimeCoins + awarded, focusMinutes: prev.focusMinutes + Number(row?.minutes ?? 0) } : prev);

    toast.success(`+${awarded} coins · focus session logged`);
    supabase.from("public_profiles").select("id, display_name, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20).then(({ data: leaders }) => {
      if (!leaders) return;
      setBoard(leaders.map(l => ({
        n: publicDisplayName(l.display_name, l.id),
        c: l.coins ?? 0, s: l.streak ?? 0,
        img: l.avatar_url || fallbackAvatar(publicDisplayName(l.display_name, l.id)),
        you: l.id === myId,
      })));
    });
    return newCoins;
  };

  const onMusicReward = (awarded: number, minutes: number) => {
    if (awarded <= 0) return;
    setCoins(value => value + awarded);
    setLife(previous => previous ? { ...previous, lifetimeCoins: previous.lifetimeCoins + awarded, focusMinutes: previous.focusMinutes + minutes } : previous);
  };

  const createCoachHabit = async (name: string) => {
    if (!myId || !name.trim()) return;
    const { error } = await supabase.from("tasks").insert({ user_id: myId, name: name.trim().slice(0,80), icon: "◎", pts: 10, sort_order: tasks.length + 1, frequency: "daily", duration_days: 21 });
    if (error) return void toast.error("Could not add that habit", { description: error.message });
    await refreshAll(); toast.success("Habit added to today’s missions"); setTab("home");
  };


  const verifyKindFor = (name: string): VerifyKind | null => {
    if (/focus|study|read/i.test(name)) return "focus";
    return null;
  };

  /** Scan proof applies to the three built-ins AND any habit with saved accepted classes. */
  const scanTargetFor = (t: any): { kind: VerifyKind; classes: string[] } | null => {
    const classes: string[] = Array.isArray(t?.scanClasses) ? t.scanClasses : [];
    const kind = verifyKindFor(t?.name ?? "");
    if (kind) return { kind, classes };
    return null;
  };

  const tick = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    if (/wake/i.test(t.name)) {
      setShowWake(true);
      return;
    }
    if (/top\s?3|top three missions/i.test(t.name)) {
      setTopThree((t as any)._uuid as string);
      return;
    }
    const target = scanTargetFor(t);
    if (target) { setVerify({ uuid: (t as any)._uuid as string, kind: target.kind, classes: target.classes, scan: false }); return; }
    completeTaskRpc((t as any)._uuid);
  };

  const scanTask = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    const target = scanTargetFor(t);
    if (!target) return;
    setVerify({ uuid: (t as any)._uuid as string, kind: target.kind, classes: target.classes, scan: true });
  };

  // get_entitlement() (database clock: verified subscription OR unexpired 3-day
  // trial) is the single verdict; the legacy fallbacks only apply while it loads.
  const premiumUnlocked = !ent.isLoading
    ? ent.premiumAccess
    : serverEntitled === null
      ? access.hasAccess
      : serverEntitled;
  const premiumTabs = ["rank", "zen", "coach"]; // Rank hosts Rank Scan + Accountability; Coach is the AI assistant
  // Resolve entitlement BEFORE gating renders — no unlocked↔locked flash.
  const gateReady = !!myId && !ent.isLoading;


  

  const keyframes = `
    @keyframes twinkle { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
    @keyframes shoot { 0%{transform:translateX(0) translateY(0) rotate(20deg);opacity:0} 10%{opacity:1} 70%{opacity:1} 100%{transform:translateX(140vw) translateY(60vh) rotate(20deg);opacity:0} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes glow { 0%,100%{text-shadow:0 0 20px ${G},0 0 40px ${G}} 50%{text-shadow:0 0 30px ${G},0 0 60px ${G},0 0 80px ${G2}} }
    @keyframes orbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
    @keyframes breatheIn { from{transform:scale(0.55);box-shadow:0 0 40px ${G}55} to{transform:scale(1);box-shadow:0 0 120px ${G},0 0 240px ${G2}88} }
    @keyframes breatheOut { from{transform:scale(1);box-shadow:0 0 120px ${G},0 0 240px ${G2}88} to{transform:scale(0.55);box-shadow:0 0 40px ${G}55} }
    @keyframes breatheHold { 0%,100%{transform:scale(1);box-shadow:0 0 120px ${G},0 0 240px ${G2}88} 50%{transform:scale(1.02);box-shadow:0 0 160px ${G},0 0 300px ${G2}} }
    @keyframes ringSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes nav-pulse { 0%,100%{box-shadow:0 -4px 20px ${G}22} 50%{box-shadow:0 -6px 28px ${G}44,0 0 16px ${G}33} }
    @keyframes icon-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
    @keyframes glow-breathe { 0%,100%{filter:drop-shadow(0 0 4px ${G}88)} 50%{filter:drop-shadow(0 0 10px ${G}cc)} }
    @keyframes press-burst { 0%{transform:scale(0.95);box-shadow:0 0 0 ${G}ff} 100%{transform:scale(1);box-shadow:0 0 0 8px transparent} }
    @keyframes shimmer-sweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  `;

  const CARD = cardStyle(G);
  const TITLE = titleStyle;

  const TABS = [
    { id: "home", Icon: Swords, label: "Home" },
    { id: "rank", Icon: Crown, label: "Rank" },
    { id: "zen", Icon: Flower2, label: "Zen" },
    { id: "coach", Icon: Bot, label: "Coach" },
    { id: "stats", Icon: BarChart3, label: "Stats" },
    { id: "profile", Icon: User, label: "You" },
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", color: AX.text, background: AX.bg, fontFamily: AX.font, position: "relative" }}>
      <style>{keyframes}</style>

      {onboarded === false && <Onboarding initialStep={onboardingStep} initialAnswers={onboardingAnswers} onFinish={finishOnboarding} />}

      {celebration && (
        <div onClick={() => setCelebration(null)} style={{
          position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(3,3,10,0.82)", backdropFilter: "blur(6px)", padding: 24, cursor: "pointer", overflow: "hidden",
        }}>
          {/* boom blast rings — 21 days and beyond */}
          {celebration.intensity >= 2 && Array.from({ length: celebration.intensity * 2 }, (_, i) => (
            <div key={`br${i}`} style={{
              position: "absolute", left: "50%", top: "50%", width: 220, height: 220, marginLeft: -110, marginTop: -110,
              borderRadius: "50%", border: `2px solid ${i % 2 ? G2 : G}`,
              animation: `boom-ring ${1.6 + i * 0.2}s ease-out ${i * 0.45}s infinite`,
            }} />
          ))}
          {/* confetti / sparks */}
          {celebration.intensity >= 2 && Array.from({ length: celebration.intensity * 18 }, (_, i) => (
            <div key={`cf${i}`} style={{
              position: "absolute", top: 0, left: `${(i * 37) % 100}%`,
              width: 5, height: 12, background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? G : G2,
              boxShadow: `0 0 8px ${G}`,
              animation: `confetti-fall ${2.4 + ((i * 13) % 20) / 10}s linear ${(i % 12) * 0.25}s infinite`,
            }} />
          ))}
          {/* supernova flash for the biggest tiers */}
          {celebration.intensity >= 3 && (
            <div style={{
              position: "absolute", left: "50%", top: "50%", width: 420, height: 420, marginLeft: -210, marginTop: -210,
              borderRadius: "50%", background: `radial-gradient(circle, ${G}66 0%, transparent 65%)`,
              filter: "blur(24px)", animation: "nova-pulse 2.4s ease-in-out infinite",
            }} />
          )}
          {/* launch sequence rockets at 365 */}
          {celebration.intensity >= 4 && [0, 1, 2].map(i => (
            <div key={`cr${i}`} style={{
              position: "absolute", bottom: "-10%", left: `${12 + i * 34}%`, fontSize: 34,
              filter: `drop-shadow(0 0 14px ${G})`,
              animation: `rocket-fly ${4 + i}s linear ${i * 0.8}s infinite`,
            }}>🚀</div>
          ))}

          <div style={{
            position: "relative", maxWidth: 340, width: "100%", textAlign: "center", padding: "30px 22px",
            background: "rgba(10,10,25,0.9)", border: `1px solid ${G}`, borderRadius: 4,
            boxShadow: `0 0 ${30 + celebration.intensity * 20}px ${G}88, inset 0 0 30px ${G}22`,
            animation: "celebrate-pop 0.5s ease-out",
          }}>
            <div style={{ fontSize: 52, filter: `drop-shadow(0 0 18px ${G})` }}>{celebration.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, color: "#fff", marginTop: 10, textShadow: `0 0 14px ${G}` }}>{celebration.title}</div>
            <div style={{ width: 90, height: 2, background: `linear-gradient(90deg,transparent,${G},transparent)`, margin: "12px auto" }} />
            <div style={{ fontSize: 12, color: "#ccc", letterSpacing: 1.2, lineHeight: 1.6 }}>{celebration.line}</div>
            <div style={{ fontSize: 10, color: G, letterSpacing: 3, marginTop: 16 }}>◉ NEW THEME + WALLPAPER ACTIVATED</div>
            <div style={{ fontSize: 9, color: "#666", letterSpacing: 2, marginTop: 8 }}>[ TAP TO CONTINUE ]</div>
          </div>
        </div>
      )}


      <div className="ax-shell" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>
        {/* TOPBAR */}
        <div className="ax-safe-top" style={{ padding: tab === "home" ? "9px 12px" : "14px 16px", background: AX.bg, borderBottom: `1px solid ${AX.border}`, display: tab === "coach" || tab === "stats" || tab === "profile" || tab === "rank" ? "none" : "flex", justifyContent: "space-between", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 99 }}>
          <img src={axenLogo} alt="AXEN Habit & Discipline" style={{ height: 22, width: "auto", flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {gateReady && !premiumUnlocked && (
              <button onClick={() => setShowPaywall(true)} style={{ background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF", padding: "7px 14px", fontSize: 13, fontWeight: 600, fontFamily: AX.font, cursor: "pointer", borderRadius: 12, whiteSpace: "nowrap", flexShrink: 0 }}>Go Pro</button>
            )}
            <CoinBadge amount={coins} variant="balance" />
          </div>

        </div>

        <TrialBanner ent={ent} onUpgrade={() => setShowPaywall(true)} />
        {ent.justStartedTrial && <TrialWelcome onClose={ent.dismissTrialWelcome} />}

        {/* CONTENT */}

        <div
          className="ax-content-pad"
          style={{
            flex: 1,
            minWidth: 0,
            paddingTop: tab === "coach" || tab === "stats" || tab === "profile" || tab === "rank" ? 0 : tab === "home" ? 8 : 14,
            paddingLeft: tab === "coach" || tab === "stats" || tab === "profile" || tab === "rank" ? 0 : tab === "home" ? 10 : 12,
            paddingRight: tab === "coach" || tab === "stats" || tab === "profile" || tab === "rank" ? 0 : tab === "home" ? 10 : 12,
            paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
          }}
          key={tab}
        >






          {verify && (
            <TaskVerify
              kind={verify.kind}
              acceptedClasses={verify.classes}
              startInScan={verify.scan}
              onClose={() => setVerify(null)}
              onVerified={() => { const id = verify.uuid; setVerify(null); completeTaskRpc(id); }}
            />
          )}

          {topThree && (
            <TopThreeModal
              onClose={() => setTopThree(null)}
              onCoins={c => setCoins(c)}
              onAllDone={() => {
                const id = topThree;
                setTasks(p => p.map(t => ((t as any)._uuid === id ? { ...t, done: true } : t)));
              }}
            />
          )}

          {showPaywall && myId && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", background: "#000" }}>
              <button onClick={() => setShowPaywall(false)} style={{ position: "fixed", top: 12, right: 12, zIndex: 201, background: "rgba(0,0,0,0.6)", border: `1px solid ${G}66`, color: G, fontFamily: AX.font, fontSize: 11, letterSpacing: 2, padding: "6px 10px", cursor: "pointer" }}>✕ CLOSE</button>
              <Paywall userId={myId} email={myEmail} />
            </div>
          )}

          <>
            {tab === "home" && (
              <HomeTab
                name={myName} coins={coins} streak={streak} shields={shields}
                tasks={tasks} tick={tick} onScan={scanTask} onFocusComplete={onFocusComplete} onMusicReward={onMusicReward}
                onBuyShield={buyShield}
                reminderTasks={tasks.map(t => ({ uuid: (t as any)._uuid as string, name: t.name, done: t.done }))}
                wakeSet={!!wakeState?.settings?.enabled && !!wakeState.settings.next_fire_at && webAlarmScheduler.ready}
                hasPaidFocus={ent.isPremium}
                onUnlockFocus={() => setShowPaywall(true)}
              />
            )}
            {tab === "rank" && (!gateReady ? <GateSkeleton /> : (
              <ProtectedFeatureGate featureName="Rank & Accountability" onUpgrade={() => setShowPaywall(true)} onContinueBasic={() => setTab("home")}>
                {myId && (
                  <Leaderboard
                    myId={myId}
                    myName={myName}
                    onMyBadge={setMyRankBadge}
                    uploading={uploading}
                    onEditPhoto={openCropper}
                    onRemovePhoto={removeAvatar}
                  />
                )}
                <RankTab
                  sectionsOnly
                  coins={coins}
                  streak={streak}
                  bestStreak={life?.bestStreak ?? streak}
                  name={myName}
                  avatar={myAvatar}
                  todayDone={tasks.filter(t => t.done).length}
                  todayTotal={tasks.length}
                  activeTheme={themeKey}
                  onApplyTheme={setThemeKey}
                  onNavigate={setTab}
                />
              </ProtectedFeatureGate>
            ))}

            {tab === "zen" && (!gateReady ? <GateSkeleton /> : (
              <ProtectedFeatureGate featureName="Zen Mode" onUpgrade={() => setShowPaywall(true)} onContinueBasic={() => setTab("home")}>
                <ZenTab med={med} coins={coins} />
              </ProtectedFeatureGate>
            ))}
            {tab === "coach" && (!gateReady ? <GateSkeleton /> : (
              <ProtectedFeatureGate featureName="AI Assistant" onUpgrade={() => setShowPaywall(true)} onContinueBasic={() => setTab("home")}>
                <AiCoach onOpenFocus={() => { setTab("home"); window.setTimeout(() => window.dispatchEvent(new Event("axen:open-focus")), 80); }} onCreateHabit={createCoachHabit} />
              </ProtectedFeatureGate>
            ))}


            {tab === "stats" && (
              <StatsTab
                weekly={weekly}
                life={life ? { ...life, medMinutes: med.medLifetime } : undefined}
                coins={coins}
                streak={streak}
                seals={milestoneSeals}
              />
            )}
            {tab === "profile" && (
              <ProfileTab
                coins={coins} streak={streak}
                myName={myName} myAvatar={myAvatar} uploading={uploading}
                openCropper={openCropper}
                fallbackAvatar={fallbackAvatar}
                todayDone={tasks.filter(t => t.done).length}
                todayTotal={tasks.length}
                weekly={weekly}
                life={life ?? undefined}
                habits={tasks.map(task => ({
                  uuid: (task as any)._uuid as string,
                  name: task.name,
                  icon: task.icon,
                  pts: task.pts,
                  done: task.done,
                  frequency: (task as any).frequency,
                  durationDays: (task as any).durationDays,
                  startedOn: (task as any).startedOn,
                }))}
                userId={myId}
                onCompleteHabit={completeHabitFromProfile}
                onRefresh={refreshAll}
                onOpenStats={() => setTab("stats")}
                onSignOut={handleSignOut}
                referredBy={referredBy}
                onCoins={setCoins}
              />
            )}
          </>


          {/* LEGAL LINKS */}
          <div style={{ display: tab === "home" || tab === "coach" || tab === "stats" || tab === "profile" || tab === "rank" ? "none" : "block", marginTop: 28, padding: "16px 12px", textAlign: "center", borderTop: `1px solid ${AX.border}` }}>
            <div style={{ fontSize: 12, color: AX.muted, marginBottom: 10 }}>AXEN Habit &amp; Discipline · a product of Next AI</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
              <Link to="/privacy" style={{ color: AX.muted, textDecoration: "none", fontSize: 12 }}>Privacy</Link>
              <Link to="/terms" style={{ color: AX.muted, textDecoration: "none", fontSize: 12 }}>Terms</Link>
              <Link to="/refund" style={{ color: AX.muted, textDecoration: "none", fontSize: 12 }}>Refund</Link>
            </div>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <div className="ax-safe-bottom" style={{
          position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 430, margin: "0 auto",
           background: tab === "coach" ? "rgba(3, 8, 22, 0.9)" : AX.bg, backdropFilter: tab === "coach" ? "blur(18px)" : undefined, borderTop: `1px solid ${tab === "coach" ? "rgba(60, 171, 255, 0.28)" : AX.border}`, display: "flex", zIndex: 99,
        }}>
          {TABS.map(n => {
            const active = tab === n.id;
            const locked = gateReady && premiumTabs.includes(n.id) && !premiumUnlocked;
            const Ico = locked ? Lock : n.Icon;
            return (
              <button key={n.id} className="ax-nav" onClick={() => setTab(n.id)} style={{
                flex: "1 1 0", minWidth: 0, padding: "10px 2px 12px", background: "transparent", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                color: active ? AX.accent : AX.muted, fontFamily: AX.font,
                transition: "color .15s ease",
              }}>
                <Ico size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span className="ax-ellipsis" style={{ fontSize: 11, fontWeight: active ? 600 : 500, maxWidth: "100%" }}>{n.label}</span>
              </button>
            );
          })}
          <style>{`
            .ax-nav { -webkit-tap-highlight-color: transparent; }
            .ax-nav:active { transform: scale(0.96); }
          `}</style>
        </div>

      </div>


      {showWake && (
        <WakeProtocol
          options={WAKE_OPTIONS}
          tones={RINGTONES}
          initialTier={wakeState?.settings ? `${Number.parseInt(wakeState.settings.time, 10)}AM` : undefined}
          initialTone={ringtone}
          initialMode={wakeMode}
          coins={coins}
          streak={streak}
          bestStreak={life?.bestStreak ?? streak}
          onClose={() => { stopPreview(); setShowWake(false); }}
          onTone={pickRingtone}
          onMode={setWakeMode}
        />
      )}

      {cropSrc && (
        <CropModal
          src={cropSrc}
          accent={G}
          accent2={G2}
          busy={uploading}
          onCancel={() => setCropSrc(null)}
          onConfirm={uploadCroppedBlob}
        />
      )}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlement } from "@/utils/premium.functions";
import { User, Swords, Crown, Flower2, BarChart3, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { Paywall } from "@/components/Paywall";
import { PaywallGate } from "@/components/PaywallGate";
import { TaskVerify, type VerifyKind } from "@/components/TaskVerify";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useEntitlement } from "@/hooks/useEntitlement";
import { TrialStatusChip } from "@/components/TrialStatusChip";
import { DevTrialSimulator } from "@/components/DevTrialSimulator";
import { GateSkeleton } from "@/components/GateSkeleton";


import { CropModal } from "@/components/CropModal";
import { Onboarding } from "@/components/Onboarding";
import { flushQuizToProfile } from "@/lib/quiz";
import { THEMES, MILESTONES, THEME_PHOTO, THEME_VIDEO, PRO_THEMES, type ThemeKey } from "@/constants/themes";
import { analyzeWake, type WakeVerdict } from "@/lib/wake-ai";
import axenLogo from "@/assets/axen-logo.png";
import habitLogo from "@/assets/habit-discipline-logo.png";

import { useMeditation } from "@/hooks/useMeditation";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { HomeTab } from "@/tabs/HomeTab";
import { RankTab } from "@/tabs/RankTab";
import { ZenTab } from "@/tabs/ZenTab";
import { StatsTab } from "@/tabs/StatsTab";
import { ProfileTab } from "@/tabs/ProfileTab";

import { startAlarm as startAlarmAudio, stopAlarm as stopAlarmAudio, previewTone, isAlarmPlaying } from "@/lib/alarm-audio";

import toneTechno from "@/assets/ringtones/techno_beat.mp3.asset.json";
import toneMeduzza from "@/assets/ringtones/MEDUZZA.mp3.asset.json";
import toneModern from "@/assets/ringtones/Modern_talking.mp3.asset.json";
import toneOppenheimer from "@/assets/ringtones/Oppenheimer.mp3.asset.json";
import toneClassic from "@/assets/ringtones/Classic.mp3.asset.json";
import toneMorning from "@/assets/ringtones/good_morning.mp3.asset.json";
import toneSuperLoud from "@/assets/ringtones/the_cutie_pie-super-loud-ahh-alarm-165805_1.mp3.asset.json";
import toneScariest from "@/assets/ringtones/The_Scariest_Alarm_256k.mp3.asset.json";

const WAKE_OPTIONS = [
  { time: "4AM", pts: 21, tag: "ELITE", line: "The world sleeps. You rise." },
  { time: "5AM", pts: 17, tag: "STRONG", line: "Before the sun. Before the noise." },
  { time: "6AM", pts: 9,  tag: "SOLID", line: "First light. First move." },
  { time: "7AM", pts: 5,  tag: "BASE",  line: "Better than yesterday." },
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
];


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AXEN Habit & Discipline" },
      { name: "description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, legendary quotes, streaks." },
      { property: "og:title", content: "Dashboard — AXEN Habit & Discipline" },
      { property: "og:description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, legendary quotes, streaks." },
    ],
  }),
  component: App,
});

type Task = { id: number; icon: string; name: string; pts: number; done: boolean };

function App() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const [screen, setScreen] = useState<"splash" | "app">("splash");
  const [tab, setTab] = useState("home");
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
  const [streak, setStreak] = useState(0);
  const [shields, setShields] = useState(0);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [streakLoaded, setStreakLoaded] = useState(false);


  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<{ n: string; c: number; s: number; img: string; you?: boolean }[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [life, setLife] = useState<{ bestStreak: number; lifetimeCoins: number; heat: { date: string; count: number }[]; topTask: { icon: string; name: string; count: number } | null; taskTotal?: number } | null>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("YOU");
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isActive: hasActiveSubscription, loading: subLoading } = useSubscription(myId);
  // Invisible-trial access control: profiles.trial_ends_at / is_subscribed, realtime.
  const access = useAccessControl(myId);
  // ONE centralized, server-clock entitlement verdict (trial + subscription).
  const ent = useEntitlement(myId);
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

    // Ensure the legacy trial record exists (idempotent, server-stamped).
    try { await supabase.rpc("ensure_app_trial"); } catch {}

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
      supabase.from("profiles").select("display_name, coins, streak, longest_streak, avatar_url, shields, onboarded, referred_by").eq("id", uid).maybeSingle(),

      supabase.from("tasks").select("id, icon, name, pts, sort_order").eq("user_id", uid).eq("is_active", true).order("sort_order"),
      supabase.from("task_completions").select("task_id").eq("user_id", uid).eq("completed_on", today),
      supabase.from("public_profiles").select("id, display_name, username, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20),
      supabase.from("task_completions").select("completed_on").eq("user_id", uid).gte("completed_on", sevenAgo),
    ]);

    if (prof) {
      setCoins(prof.coins ?? 0);
      setStreak(prof.streak ?? 0);
      setMyName(prof.display_name || "YOU");
      setMyAvatar(prof.avatar_url || "");
      setShields((prof as any).shields ?? 0);
      setOnboarded(!!(prof as any).onboarded);
      setReferredBy((prof as any).referred_by ?? null);
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
      pts: r.pts,
      done: doneIds.has(r.id as string),
    }) as unknown as Task));

    setBoard((leaders || []).map(l => ({
      n: (l.display_name || l.username || "USER").toUpperCase().replace(/\s+/g, "_"),
      c: l.coins ?? 0,
      s: l.streak ?? 0,
      img: l.avatar_url || fallbackAvatar(l.display_name || l.username || "U"),
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
    const [{ data: allComps }, { data: earns }] = await Promise.all([
      supabase.from("task_completions").select("task_id, completed_on").eq("user_id", uid),
      supabase.from("coin_transactions").select("amount").eq("user_id", uid).gt("amount", 0),
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
      taskTotal: (taskRows || []).length,
    });
  };


  // Single boot fetch — guarded so React's double-mount (and fast remounts)
  // never fire the whole dashboard query set twice.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    refreshAll();
  }, []);

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
    if (!myId) return;
    await supabase.from("profiles").update({ onboarded: true } as any).eq("id", myId);
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
    if (file.size > 10 * 1024 * 1024) { alert("Image too large (max 10MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadCroppedBlob = async (blob: Blob) => {
    if (!myId) return;
    setUploading(true);
    try {
      const path = `${myId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr || new Error("signed url failed");
      const url = signed.signedUrl;
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

  // 4AM proof-of-wakeup state
  const [proof, setProof] = useState<null | {
    mode: "time" | "choose" | "quiz" | "scan" | "result";
    wakePts?: number;
    wakeTime?: string;
    wakeLine?: string;
    subject?: "math" | "physics";
    question?: string;
    answer?: number;
    input?: string;
    correct?: boolean;
    startedAt?: number;
    firstKeyMs?: number;
    keyTimes?: number[];
    corrections?: number;
    verdict?: WakeVerdict;
    wrong?: number;

  }>(null);

  const [ringtone, setRingtone] = useState<string>(() => {
    if (typeof window === "undefined") return "superloud";
    const saved = localStorage.getItem("dwt_ringtone");
    return saved && RINGTONES.some(r => r.id === saved) ? saved : "superloud";
  });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ uuid: string; kind: VerifyKind; scan: boolean } | null>(null);
  const pickRingtone = (id: string) => {
    setRingtone(id);
    try { localStorage.setItem("dwt_ringtone", id); } catch { /* ignore */ }
    if (previewId === id) { stopAlarmAudio(); setPreviewId(null); return; }
    const r = RINGTONES.find(x => x.id === id);
    if (r) { previewTone(r.url); setPreviewId(id); }
  };
  const stopPreview = () => { stopAlarmAudio(); setPreviewId(null); };



  useEffect(() => {
    const t = setTimeout(() => setScreen("app"), 2500);
    return () => clearTimeout(t);
  }, []);

  const theme = THEMES[themeKey];
  const G = AX.accent;
  const G2 = AX.accent;
  // wallpaper is bound to the selected theme — changing theme changes wallpaper too
  const wallLevel = theme.wall;
  const wallPhoto = THEME_PHOTO[themeKey];
  const wallVideo = THEME_VIDEO[themeKey];



  const buildQuestion = (subject: "math" | "physics") => {
    if (subject === "math") {
      const ops = [
        () => { const a = 12 + Math.floor(Math.random()*40); const b = 5 + Math.floor(Math.random()*30); return { q: `${a} + ${b} = ?`, a: a+b }; },
        () => { const a = 40 + Math.floor(Math.random()*50); const b = 5 + Math.floor(Math.random()*30); return { q: `${a} − ${b} = ?`, a: a-b }; },
        () => { const a = 3 + Math.floor(Math.random()*11); const b = 3 + Math.floor(Math.random()*11); return { q: `${a} × ${b} = ?`, a: a*b }; },
        () => { const b = 3 + Math.floor(Math.random()*9); const r = 2 + Math.floor(Math.random()*10); return { q: `${b*r} ÷ ${b} = ?`, a: r }; },
      ];
      return ops[Math.floor(Math.random()*ops.length)]();
    }
    const ops = [
      () => { const m = 2 + Math.floor(Math.random()*8); const a = 2 + Math.floor(Math.random()*8); return { q: `Force = mass × acceleration. m=${m}kg, a=${a}m/s². F = ? (N)`, a: m*a }; },
      () => { const d = 20 + Math.floor(Math.random()*80); const t = 2 + Math.floor(Math.random()*8); return { q: `Speed = distance ÷ time. d=${d*t}m, t=${t}s. Speed = ? (m/s)`, a: d }; },
      () => { const m = 2 + Math.floor(Math.random()*8); const g = 10; const h = 2 + Math.floor(Math.random()*8); return { q: `PE = m·g·h. m=${m}kg, g=${g}, h=${h}m. PE = ? (J)`, a: m*g*h }; },
      () => { const v = 2 + Math.floor(Math.random()*10); const m = 2 + Math.floor(Math.random()*8); return { q: `Momentum p = m·v. m=${m}kg, v=${v}m/s. p = ? (kg·m/s)`, a: m*v }; },
    ];
    return ops[Math.floor(Math.random()*ops.length)]();
  };

  // live alarm: loops at 200% boosted volume until the user dismisses it
  const stopAlarm = () => stopAlarmAudio();
  const startAlarm = () => {
    const r = RINGTONES.find(x => x.id === ringtone) || RINGTONES[0];
    startAlarmAudio(r.url);
  };
  useEffect(() => () => stopAlarmAudio(), []);


  const startProof = (subject: "math" | "physics") => {
    const { q, a } = buildQuestion(subject);
    setPreviewId(null);
    startAlarm();
    setProof(p => ({
      ...(p || {}), mode: "quiz", subject, question: q, answer: a, input: "",
      startedAt: Date.now(), keyTimes: [], corrections: 0, firstKeyMs: undefined, wrong: 0,
    }));
  };


  const wakeTask = tasks.find(t => /wake/i.test(t.name)) || tasks[0];

  const completeTaskRpc = async (uuid: string, overridePts?: number) => {
    if (typeof overridePts === "number") {
      await supabase.from("tasks").update({ pts: overridePts }).eq("id", uuid);
    }
    const { data, error } = await supabase.rpc("complete_task", { _task_id: uuid });
    if (typeof overridePts === "number") {
      await supabase.from("tasks").update({ pts: 21 }).eq("id", uuid);
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

    supabase.from("public_profiles").select("id, display_name, username, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20).then(({ data: leaders }) => {
      if (!leaders) return;
      setBoard(leaders.map(l => ({
        n: (l.display_name || l.username || "USER").toUpperCase().replace(/\s+/g, "_"),
        c: l.coins ?? 0, s: l.streak ?? 0,
        img: l.avatar_url || fallbackAvatar(l.display_name || l.username || "U"),
        you: l.id === myId,
      })));
    });
  };

  const med = useMeditation(tasks as any, completeTaskRpc);

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
    if (typeof newCoins === "number") setCoins(newCoins);
    setLife(prev => prev ? { ...prev, lifetimeCoins: prev.lifetimeCoins + tier.reward } : prev);

    toast.success(`+${tier.reward} coins · focus session logged`);
    supabase.from("public_profiles").select("id, display_name, username, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20).then(({ data: leaders }) => {
      if (!leaders) return;
      setBoard(leaders.map(l => ({
        n: (l.display_name || l.username || "USER").toUpperCase().replace(/\s+/g, "_"),
        c: l.coins ?? 0, s: l.streak ?? 0,
        img: l.avatar_url || fallbackAvatar(l.display_name || l.username || "U"),
        you: l.id === myId,
      })));
    });
    return newCoins;
  };


  const submitProof = () => {
    if (!proof || proof.mode !== "quiz") return;
    const now = Date.now();
    const correct = Number(proof.input) === proof.answer;

    // WRONG → the alarm keeps ringing. New question, no escape.
    if (!correct) {
      const next = buildQuestion(proof.subject ?? "math");
      toast.error("Wrong answer — the alarm keeps ringing", { description: "Solve the new problem to silence it." });
      if (!isAlarmPlaying()) startAlarm();
      setProof({
        ...proof,
        question: next.q, answer: next.a, input: "",
        wrong: (proof.wrong ?? 0) + 1,
        corrections: (proof.corrections ?? 0) + 1,
      });
      return;
    }

    // CORRECT → only now is the alarm allowed to stop.
    stopAlarm();
    const started = proof.startedAt ?? now;
    const times = proof.keyTimes ?? [];
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    const verdict = analyzeWake({
      firstKeyMs: proof.firstKeyMs ?? now - started,
      totalMs: now - started,
      keyGaps: gaps,
      corrections: proof.corrections ?? 0,
      correct,
      claimed: proof.wakeTime || "4AM",
      hour: new Date().getHours(),
    });
    setProof({ ...proof, mode: "scan", correct, verdict });
    setTimeout(() => {
      setProof(p => (p && p.mode === "scan" ? { ...p, mode: "result" } : p));
      if (verdict.awake && wakeTask && !wakeTask.done) {
        completeTaskRpc((wakeTask as any)._uuid, proof.wakePts ?? 10);
      }
    }, 2800);
  };


  const verifyKindFor = (name: string): VerifyKind | null => {
    if (/workout|gym|train|exercise/i.test(name)) return "gym";
    if (/shower|bath|cold/i.test(name)) return "shower";
    if (/focus|study|read/i.test(name)) return "focus";
    return null;
  };

  const tick = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    if (/wake/i.test(t.name)) { setProof({ mode: "time" }); return; }
    const kind = verifyKindFor(t.name);
    if (kind) { setVerify({ uuid: (t as any)._uuid as string, kind, scan: false }); return; }
    completeTaskRpc((t as any)._uuid);
  };

  const scanTask = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    const kind = verifyKindFor(t.name);
    if (!kind) return;
    setVerify({ uuid: (t as any)._uuid as string, kind, scan: true });
  };

  // Invisible trial (Days 1–3): full access, zero counters, badges or prompts.
  // useEntitlement() (DB clock: trial + subscription) is the single verdict;
  // the legacy server fn / profiles row only act as a fallback while it loads.
  const premiumUnlocked = !ent.isLoading
    ? ent.isPremium
    : serverEntitled === null
      ? access.hasAccess
      : serverEntitled;
  const premiumTabs = ["rank", "zen"]; // Rank tab also hosts Accountability (friends)
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

  if (screen === "splash") {
    return (
      <div style={{ width: "100%", height: "100vh", background: AX.bg, position: "relative", overflow: "hidden", fontFamily: AX.font }}>
        <style>{keyframes}</style>
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: `1px solid ${G}44`, animation: "orbit 8s linear infinite" }}>
            <div style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, borderRadius: "50%", background: G, boxShadow: `0 0 20px ${G}` }} />
          </div>
          <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", border: `1px solid ${G2}33`, animation: "orbit 14s linear infinite reverse" }} />
          <img src={axenLogo} alt="AXEN Habit & Discipline" style={{ width: "min(58vw, 260px)", height: "auto", zIndex: 3, filter: `drop-shadow(0 0 22px ${G})`, animation: "glow 2.5s ease-in-out infinite" }} />
          <div style={{ width: 120, height: 2, background: `linear-gradient(90deg,transparent,${G},transparent)`, margin: "22px auto", zIndex: 3 }} />
          <img src={habitLogo} alt="Habit & Discipline" style={{ width: "min(46vw, 210px)", height: "auto", zIndex: 3, opacity: 0.95, filter: `drop-shadow(0 0 14px ${G}aa)`, animation: "pulse 2s ease-in-out infinite" }} />
          <div style={{ marginTop: 40, fontSize: 9, letterSpacing: 3, color: "#555", zIndex: 3 }}>[ INITIALIZING SYSTEM ]</div>
        </div>
      </div>
    );
  }

  const CARD = cardStyle(G);
  const TITLE = titleStyle;

  const TABS = [
    { id: "home", Icon: Swords, label: "Home" },
    { id: "rank", Icon: Crown, label: "Rank" },
    { id: "zen", Icon: Flower2, label: "Zen" },
    { id: "stats", Icon: BarChart3, label: "Stats" },
    { id: "profile", Icon: User, label: "You" },
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", color: AX.text, background: AX.bg, fontFamily: AX.font, position: "relative" }}>
      <style>{keyframes}</style>

      {onboarded === false && <Onboarding onFinish={finishOnboarding} />}

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
        <div className="ax-safe-top" style={{ padding: "14px 16px", background: AX.bg, borderBottom: `1px solid ${AX.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 99 }}>
          <img src={axenLogo} alt="AXEN Habit & Discipline" style={{ height: 22, width: "auto", flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {gateReady && !premiumUnlocked && (
              <button onClick={() => setShowPaywall(true)} style={{ background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF", padding: "7px 14px", fontSize: 13, fontWeight: 600, fontFamily: AX.font, cursor: "pointer", borderRadius: 12, whiteSpace: "nowrap", flexShrink: 0 }}>Go Pro</button>
            )}
            <div className="ax-ellipsis" style={{ background: "#181820", border: `1px solid ${AX.border}`, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: AX.text, borderRadius: 12, maxWidth: "45vw" }}>{coins} coins</div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="ax-content-pad" style={{ flex: 1, minWidth: 0, padding: "14px 12px" }} key={tab}>






          {verify && (
            <TaskVerify
              kind={verify.kind}
              startInScan={verify.scan}
              onClose={() => setVerify(null)}
              onVerified={() => { const id = verify.uuid; setVerify(null); completeTaskRpc(id); }}
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
                tasks={tasks} tick={tick} onScan={scanTask} onFocusComplete={onFocusComplete}
                onBuyShield={buyShield}
                reminderTasks={tasks.map(t => ({ uuid: (t as any)._uuid as string, name: t.name, done: t.done }))}
              />
            )}
            {tab === "rank" && (!gateReady ? <GateSkeleton /> : (
              <PaywallGate hasAccess={premiumUnlocked} onUpgrade={() => setShowPaywall(true)}>
                <RankTab coins={coins} streak={streak} bestStreak={life?.bestStreak ?? 0} board={board} fallbackAvatar={fallbackAvatar} />
              </PaywallGate>
            ))}
            {tab === "zen" && (!gateReady ? <GateSkeleton /> : (
              <PaywallGate hasAccess={premiumUnlocked} onUpgrade={() => setShowPaywall(true)}>
                <ZenTab med={med} />
              </PaywallGate>
            ))}

            {tab === "stats" && (
              <StatsTab
                weekly={weekly}
                life={life ? { ...life, medMinutes: med.medLifetime } : undefined}
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
                onSignOut={handleSignOut}
                referredBy={referredBy}
                onCoins={setCoins}
              />
            )}
          </>


          {/* LEGAL LINKS */}
          <div style={{ marginTop: 28, padding: "16px 12px", textAlign: "center", borderTop: `1px solid ${AX.border}` }}>
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
          background: AX.bg, borderTop: `1px solid ${AX.border}`, display: "flex", zIndex: 99,
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

      {/* 4AM PROOF-OF-WAKEUP MODAL */}
      {proof && (
        <div onClick={() => proof.mode === "result" && setProof(null)} style={{
          position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, overflowY: "auto", animation: "fadeUp 0.25s ease-out",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 380, maxHeight: "88dvh", overflowY: "auto", background: "rgba(10,10,25,0.95)",
            border: `1px solid ${G}77`, borderLeft: `3px solid ${G}`,
            padding: 20, boxShadow: `0 10px 60px ${G}55, inset 0 1px 0 ${G}33`,
            fontFamily: AX.font,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: G, marginBottom: 6 }}>
              ▸ {proof.mode === "time" ? "WAKE PROTOCOL" : `${proof.wakeTime || "04:00"} PROTOCOL`}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 2, marginBottom: 4, textShadow: `0 0 12px ${G}` }}>
              {proof.mode === "time" ? "WHEN DID YOU RISE?" : "PROVE YOU ARE AWAKE"}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 18, lineHeight: 1.5 }}>
              {proof.mode === "time"
                ? <>Pick your wake-up tier. Earlier = more coins. Then set your alarm tone.</>
                : <>Sleeping minds cannot solve. Answer correctly to earn <span style={{ color: G }}>+{proof.wakePts ?? 10} coins</span>.</>}
            </div>

            {proof.mode === "time" && (
              <>
                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 2, marginBottom: 10 }}>WAKE TIER</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                  {WAKE_OPTIONS.map(w => (
                    <button key={w.time} onClick={() => setProof({ mode: "choose", wakePts: w.pts, wakeTime: w.time, wakeLine: w.line })} style={{
                      textAlign: "left", padding: "12px 12px", background: `linear-gradient(135deg, ${G}22, transparent)`,
                      border: `1px solid ${G}66`, borderLeft: `3px solid ${G}`, color: "#fff", cursor: "pointer",
                      fontFamily: AX.font,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, textShadow: `0 0 10px ${G}` }}>{w.time}</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: G }}>+{w.pts}</span>
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: G2, marginBottom: 4 }}>{w.tag}</div>
                      <div style={{ fontSize: 9, color: "#999", lineHeight: 1.4 }}>{w.line}</div>
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 2, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12 }}>🚨</span> EMERGENCY RINGTONE
                  </span>
                  <span style={{ fontSize: 8, color: G, letterSpacing: 1 }}>200% BOOST</span>
                </div>
                <div style={{
                  maxHeight: 190, overflowY: "auto", marginBottom: 14, display: "grid", gap: 6,
                  padding: 6, background: "rgba(0,0,0,0.35)", border: "1px solid #23232E", borderRadius: 14,
                  WebkitOverflowScrolling: "touch",
                }}>
                  {RINGTONES.map(r => {
                    const active = ringtone === r.id;
                    const playing = previewId === r.id;
                    return (
                      <button key={r.id} onClick={() => pickRingtone(r.id)} style={{
                        padding: "12px 12px", borderRadius: 12,
                        background: active ? `linear-gradient(135deg, ${G}44, ${G2}22)` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? G : "#2A2A36"}`,
                        color: active ? "#fff" : "#aaa", cursor: "pointer",
                        fontFamily: AX.font, fontSize: 11, letterSpacing: 2, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        transition: "background .15s ease, border-color .15s ease",
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ color: active ? G : "#555" }}>{active ? "◉" : "○"}</span>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                        </span>
                        <span style={{ fontSize: 10, color: G, flexShrink: 0 }}>{playing ? "■ STOP" : "▶"}</span>
                      </button>
                    );
                  })}
                </div>


                <button onClick={() => { stopPreview(); setProof(null); }} style={{
                  marginTop: 4, width: "100%", padding: 8, background: "transparent",
                  border: "1px solid #333", color: "#666", cursor: "pointer",
                  fontFamily: AX.font, fontSize: 10, letterSpacing: 2,
                }}>CANCEL</button>
              </>
            )}

            {proof.mode === "choose" && (
              <>
                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 2, marginBottom: 10 }}>CHOOSE YOUR PROOF</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(["math", "physics"] as const).map(s => (
                    <button key={s} onClick={() => startProof(s)} style={{
                      padding: "16px 8px", background: `linear-gradient(135deg, ${G}22, transparent)`,
                      border: `1px solid ${G}66`, color: "#fff", cursor: "pointer",
                      fontFamily: AX.font, fontSize: 13, fontWeight: 700, letterSpacing: 2,
                    }}>
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{s === "math" ? "🧮" : "⚛️"}</div>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button onClick={() => { stopPreview(); setProof({ mode: "time" }); }} style={{
                  marginTop: 14, width: "100%", padding: 8, background: "transparent",
                  border: "1px solid #333", color: "#888", cursor: "pointer",
                  fontFamily: AX.font, fontSize: 10, letterSpacing: 2,
                }}>← BACK</button>
              </>
            )}

            {proof.mode === "quiz" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: G, letterSpacing: 3 }}>
                    {proof.subject === "math" ? "🧮 MATH" : "⚛️ PHYSICS"}
                  </div>
                  <div style={{ fontSize: 9, color: "#ff4466", letterSpacing: 2, animation: "pulse 1s infinite" }}>🔔 ALARM RINGING</div>
                </div>
                <div style={{
                  padding: 16, background: "rgba(0,0,0,0.5)", border: `1px solid ${G}44`,
                  fontSize: 15, color: "#fff", marginBottom: 14, lineHeight: 1.5, textAlign: "center", fontWeight: 700,
                }}>{proof.question}</div>
                <input
                  autoFocus type="number" inputMode="numeric" value={proof.input ?? ""}
                  onChange={e => {
                    const now = Date.now();
                    const prev = proof.input ?? "";
                    setProof({
                      ...proof,
                      input: e.target.value,
                      keyTimes: [...(proof.keyTimes ?? []), now],
                      firstKeyMs: proof.firstKeyMs ?? now - (proof.startedAt ?? now),
                      corrections: (proof.corrections ?? 0) + (e.target.value.length < prev.length ? 1 : 0),
                    });
                  }}
                  onKeyDown={e => e.key === "Enter" && submitProof()}
                  placeholder="Your answer"
                  style={{
                    width: "100%", padding: "12px 14px", background: "rgba(0,0,0,0.6)",
                    border: `1px solid ${G}66`, color: "#fff", fontFamily: AX.font,
                    fontSize: 18, letterSpacing: 2, textAlign: "center", outline: "none",
                    boxSizing: "border-box", marginBottom: 12,
                  }}
                />
                <button onClick={submitProof} disabled={!proof.input} style={{
                  width: "100%", padding: 12, background: proof.input ? `linear-gradient(90deg, ${G}, ${G2})` : "#222",
                  border: "none", color: proof.input ? "#000" : "#555", cursor: proof.input ? "pointer" : "not-allowed",
                  fontFamily: AX.font, fontSize: 12, fontWeight: 900, letterSpacing: 3,
                  boxShadow: proof.input ? `0 0 20px ${G}66` : "none",
                }}>SUBMIT PROOF</button>
                {!!proof.wrong && (
                  <div style={{ marginTop: 10, fontSize: 10, color: "#ff4466", letterSpacing: 1.5, textAlign: "center" }}>
                    {proof.wrong} WRONG {proof.wrong === 1 ? "ATTEMPT" : "ATTEMPTS"} · ALARM STILL RINGING
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 9, color: "#555", letterSpacing: 1.5, textAlign: "center", lineHeight: 1.6 }}>
                  🔒 LOCKED — THE ALARM ONLY STOPS ON A CORRECT ANSWER
                </div>
              </>
            )}

            {proof.mode === "scan" && (
              <div style={{ padding: "6px 0" }}>
                <div style={{ position: "relative", height: 90, border: `1px solid ${G}44`, background: "rgba(0,0,0,0.5)", overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🧠</div>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 26, background: `linear-gradient(180deg, transparent, ${G}55, transparent)`, animation: "scan-sweep 1.2s linear infinite" }} />
                </div>
                <div style={{ fontSize: 11, color: "#fff", letterSpacing: 3, fontWeight: 900, textAlign: "center", marginBottom: 10 }}>AI WAKE SENSOR · ANALYSING</div>
                {(proof.verdict?.factors ?? []).map((f, i) => (
                  <div key={f.label} style={{
                    display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 1.5,
                    padding: "6px 8px", marginBottom: 4, background: "rgba(0,0,0,0.4)",
                    border: `1px solid ${f.ok ? G + "55" : "#ff446655"}`,
                    animation: `fadeUp 0.3s ease-out ${i * 0.25}s both`,
                  }}>
                    <span style={{ color: "#999" }}>{f.ok ? "◉" : "○"} {f.label}</span>
                    <span style={{ color: f.ok ? G : "#ff4466" }}>{f.value}</span>
                  </div>
                ))}
                <div style={{ fontSize: 9, color: "#666", letterSpacing: 2, textAlign: "center", marginTop: 10 }}>ON-DEVICE · NO DATA LEAVES YOUR PHONE</div>
              </div>
            )}


            {proof.mode === "result" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>{proof.verdict?.awake ? "✅" : "❌"}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: proof.verdict?.awake ? G : "#ff4466", letterSpacing: 2, marginBottom: 8 }}>
                  {proof.verdict?.awake ? "AWAKE CONFIRMED" : "NOT CONFIRMED"}
                </div>
                <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 10 }}>
                  AI CONFIDENCE <span style={{ color: proof.verdict?.awake ? G : "#ff4466", fontWeight: 900 }}>{proof.verdict?.score ?? 0}%</span>
                </div>
                <div style={{ height: 6, background: "#0a0a15", border: `1px solid ${G}22`, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${proof.verdict?.score ?? 0}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 10px ${G}`, transition: "width 0.6s" }} />
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 16, lineHeight: 1.5 }}>
                  {proof.verdict?.awake
                    ? <>+{proof.wakePts ?? 10} coins added. {proof.wakeLine || "You rose while the world slept."}</>
                    : proof.correct
                      ? <>Answer was right, but the sensor read sleepy signals. Try again fully awake.</>
                      : <>Correct answer was <span style={{ color: G }}>{proof.answer}</span>. No coins — but the discipline still counts.</>}
                </div>
                <button onClick={() => setProof(null)} style={{
                  width: "100%", padding: 10, background: `linear-gradient(90deg, ${G}, ${G2})`,
                  border: "none", color: "#000", cursor: "pointer",
                  fontFamily: AX.font, fontSize: 11, fontWeight: 900, letterSpacing: 3,
                }}>CONTINUE</button>
              </div>

            )}
          </div>
        </div>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlement } from "@/utils/premium.functions";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { Paywall } from "@/components/Paywall";
import { SpaceWallpaper } from "@/components/SpaceWallpaper";
import { CropModal } from "@/components/CropModal";
import { THEMES, type ThemeKey } from "@/constants/themes";
import { useMeditation } from "@/hooks/useMeditation";
import { cardStyle, titleStyle } from "@/tabs/styles";
import { HomeTab } from "@/tabs/HomeTab";
import { RankTab } from "@/tabs/RankTab";
import { QuotesTab } from "@/tabs/QuotesTab";
import { ZenTab } from "@/tabs/ZenTab";
import { StatsTab } from "@/tabs/StatsTab";
import { ProfileTab } from "@/tabs/ProfileTab";

import alarmLoud from "@/assets/freesound_community-loud-emergency-alarm-54635.mp3.asset.json";
import alarmReverb from "@/assets/freesound_community-emergency-alarm-with-reverb-29431.mp3.asset.json";
import alarmRooster from "@/assets/mixkit-rooster-crowing-in-the-morning-2462.wav.asset.json";
import alarmClassic from "@/assets/mixkit-classic-alarm-995.wav.asset.json";

const WAKE_OPTIONS = [
  { time: "4AM", pts: 21, tag: "ELITE", line: "The world sleeps. You rise." },
  { time: "5AM", pts: 17, tag: "STRONG", line: "Before the sun. Before the noise." },
  { time: "6AM", pts: 9,  tag: "SOLID", line: "First light. First move." },
  { time: "7AM", pts: 5,  tag: "BASE",  line: "Better than yesterday." },
] as const;

const RINGTONES = [
  { id: "loud",    name: "SIREN",    url: alarmLoud.url },
  { id: "reverb",  name: "REVERB",   url: alarmReverb.url },
  { id: "rooster", name: "ROOSTER",  url: alarmRooster.url },
  { id: "classic", name: "CLASSIC",  url: alarmClassic.url },
];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "DWT — Discipline Won Today" },
      { name: "description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, warrior quotes, streaks." },
      { property: "og:title", content: "DWT — Discipline Won Today" },
      { property: "og:description", content: "Ultra-futuristic discipline tracker. Cosmic wallpapers, daily missions, warrior quotes, streaks." },
    ],
  }),
  component: App,
});

type Task = { id: number; icon: string; name: string; pts: number; done: boolean };

function App() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const [screen, setScreen] = useState<"splash" | "app">("splash");
  const [tab, setTab] = useState("home");
  const [themeKey, setThemeKey] = useState<ThemeKey>("space");

  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<{ n: string; c: number; s: number; img: string; you?: boolean }[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [life, setLife] = useState<{ bestStreak: number; lifetimeCoins: number; heat: { date: string; count: number }[]; topTask: { icon: string; name: string; count: number } | null } | null>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("YOU");
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialReady, setTrialReady] = useState(false);
  const { isActive: hasActiveSubscription, loading: subLoading } = useSubscription(myId);
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

    try {
      const { data: trialRows, error: trialError } = await supabase.rpc("ensure_app_trial");
      if (!trialError) {
        const trial = Array.isArray(trialRows) ? trialRows[0] : trialRows;
        setTrialEndsAt(trial?.trial_ends_at ?? null);
      }
    } finally {
      setTrialReady(true);
    }

    try {
      const { data: pen } = await (supabase.rpc as any)("apply_daily_penalty");
      const row = Array.isArray(pen) ? pen[0] : pen;
      if (row?.penalized) {
        toast.error("−3 COINS", { description: "You missed a task yesterday. Discipline demands 100%." });
      }
    } catch {}

    const today = new Date().toISOString().slice(0, 10);
    const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const [{ data: prof }, { data: taskRows }, { data: doneToday }, { data: leaders }, { data: weekRows }] = await Promise.all([
      supabase.from("profiles").select("display_name, coins, streak, longest_streak, avatar_url").eq("id", uid).maybeSingle(),

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
    }

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
    });
  };


  useEffect(() => { refreshAll(); }, []);

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
    mode: "time" | "choose" | "quiz" | "result";
    wakePts?: number;
    wakeTime?: string;
    wakeLine?: string;
    subject?: "math" | "physics";
    question?: string;
    answer?: number;
    input?: string;
    correct?: boolean;
  }>(null);
  const [ringtone, setRingtone] = useState<string>(() => {
    if (typeof window === "undefined") return "loud";
    return localStorage.getItem("dwt_ringtone") || "loud";
  });
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const playPreview = (url: string) => {
    try {
      if (previewRef.current) { previewRef.current.pause(); previewRef.current.currentTime = 0; }
      const a = new Audio(url);
      a.volume = 0.6;
      previewRef.current = a;
      a.play().catch(() => {});
      setTimeout(() => { try { a.pause(); } catch {} }, 2500);
    } catch {}
  };
  const pickRingtone = (id: string) => {
    setRingtone(id);
    try { localStorage.setItem("dwt_ringtone", id); } catch {}
    const r = RINGTONES.find(x => x.id === id);
    if (r) playPreview(r.url);
  };

  useEffect(() => {
    const t = setTimeout(() => setScreen("app"), 2500);
    return () => clearTimeout(t);
  }, []);

  const theme = THEMES[themeKey];
  const G = theme.accent;
  const G2 = theme.accent2;

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

  const startProof = (subject: "math" | "physics") => {
    const { q, a } = buildQuestion(subject);
    setProof(p => ({ ...(p || {}), mode: "quiz", subject, question: q, answer: a, input: "" }));
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
    if (error) { console.error(error); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) { setCoins(row.coins ?? 0); setStreak(row.streak ?? 0); }
    setTasks(p => p.map(t => (t as any)._uuid === uuid ? { ...t, done: true } : t));
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

  const submitProof = () => {
    if (!proof || proof.mode !== "quiz") return;
    const correct = Number(proof.input) === proof.answer;
    setProof({ ...proof, mode: "result", correct });
    if (correct && wakeTask && !wakeTask.done) {
      completeTaskRpc((wakeTask as any)._uuid, proof.wakePts ?? 10);
    }
  };

  const tick = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    if (/wake/i.test(t.name)) { setProof({ mode: "time" }); return; }
    completeTaskRpc((t as any)._uuid);
  };

  const trialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date();
  // Server verdict is authoritative; client state only avoids a loading flash.
  const premiumUnlocked = serverEntitled === null
    ? (hasActiveSubscription || trialActive)
    : serverEntitled;
  const premiumTabs = ["rank", "quotes", "zen"];
  const gateReady = trialReady && !!myId && !subLoading && serverEntitled !== null;
  const premiumLocked = gateReady && premiumTabs.includes(tab) && !premiumUnlocked;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;

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
  `;

  if (screen === "splash") {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#000", position: "relative", overflow: "hidden", fontFamily: "monospace" }}>
        <style>{keyframes}</style>
        <SpaceWallpaper accent={G} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: `1px solid ${G}44`, animation: "orbit 8s linear infinite" }}>
            <div style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, borderRadius: "50%", background: G, boxShadow: `0 0 20px ${G}` }} />
          </div>
          <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", border: `1px solid ${G2}33`, animation: "orbit 14s linear infinite reverse" }} />
          <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: 6, textAlign: "center", lineHeight: 1.2, animation: "glow 2.5s ease-in-out infinite", zIndex: 3 }}>
            DISCIPLINE<br />WON TODAY
          </div>
          <div style={{ width: 120, height: 2, background: `linear-gradient(90deg,transparent,${G},transparent)`, margin: "22px auto", zIndex: 3 }} />
          <div style={{ fontSize: 11, letterSpacing: 5, color: G, zIndex: 3, animation: "pulse 2s ease-in-out infinite" }}>STAY HARD · EVERY DAY</div>
          <div style={{ marginTop: 40, fontSize: 9, letterSpacing: 3, color: "#555", zIndex: 3 }}>[ INITIALIZING SYSTEM ]</div>
        </div>
      </div>
    );
  }

  const CARD = cardStyle(G);
  const TITLE = titleStyle;

  const TABS = [
    { id: "home", icon: "⚔️", label: "Home" },
    { id: "rank", icon: "🏆", label: "Rank" },
    { id: "quotes", icon: "💬", label: "Quotes" },
    { id: "zen", icon: "🧘", label: "Zen" },
    { id: "stats", icon: "📊", label: "Stats" },
    { id: "profile", icon: "👤", label: "You" },
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", color: "#e8e8e8", fontFamily: "monospace", position: "relative", overflow: "hidden" }}>
      <style>{keyframes}</style>
      <SpaceWallpaper accent={G} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* TOPBAR */}
        <div style={{ padding: "14px 16px", background: "rgba(10,10,25,0.7)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${G}55`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 99, boxShadow: `0 2px 20px ${G}22` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: G, boxShadow: `0 0 10px ${G}`, animation: "pulse 1.5s infinite" }} />
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: `0 0 12px ${G}` }}>DWT</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {(Object.keys(THEMES) as ThemeKey[]).map(k => (
              <button key={k} onClick={() => setThemeKey(k)} title={THEMES[k].name} style={{
                width: 18, height: 18, borderRadius: "50%",
                background: `linear-gradient(135deg, ${THEMES[k].accent}, ${THEMES[k].accent2})`,
                border: themeKey === k ? `2px solid #fff` : `1px solid #333`,
                cursor: "pointer", padding: 0,
                boxShadow: themeKey === k ? `0 0 10px ${THEMES[k].accent}` : "none",
              }} />
            ))}
            <div style={{ background: `linear-gradient(135deg,${G}22,${G2}22)`, border: `1px solid ${G}66`, padding: "5px 10px", fontSize: 13, fontWeight: 700, color: G, marginLeft: 4, borderRadius: 2 }}>🪙 {coins}</div>
            <button onClick={handleSignOut} title="Sign out" style={{ background: "transparent", border: `1px solid ${G}55`, color: "#aaa", padding: "5px 8px", fontSize: 10, letterSpacing: 2, fontFamily: "monospace", cursor: "pointer", borderRadius: 2 }}>EXIT</button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 90px", animation: "fadeUp 0.4s ease-out" }} key={tab}>

          {gateReady && trialActive && !hasActiveSubscription && (
            <div style={{ ...CARD, borderLeft: `3px solid ${G}`, fontSize: 11, color: "#ddd", letterSpacing: 1.5, lineHeight: 1.5 }}>
              <span style={{ color: G, fontWeight: 900 }}>◉ FREE ACCESS ACTIVE</span> · {trialDaysLeft} DAY{trialDaysLeft === 1 ? "" : "S"} LEFT. Home, Stats and You stay open; Rank, Quotes and Zen become PRO after trial.
            </div>
          )}

          {premiumLocked && myId && <Paywall userId={myId} email={myEmail} />}

          {!premiumLocked && <>
            {tab === "home" && <HomeTab G={G} G2={G2} coins={coins} streak={streak} tasks={tasks} tick={tick} />}
            {tab === "rank" && <RankTab G={G} board={board} fallbackAvatar={fallbackAvatar} />}
            {tab === "quotes" && <QuotesTab G={G} />}
            {tab === "zen" && <ZenTab G={G} G2={G2} med={med} />}
            {tab === "stats" && <StatsTab G={G} G2={G2} weekly={weekly} life={life ? { ...life, medMinutes: med.medLifetime } : undefined} />}
            {tab === "profile" && (
              <ProfileTab
                G={G} G2={G2}
                coins={coins} streak={streak}
                myName={myName} myAvatar={myAvatar} uploading={uploading}
                themeKey={themeKey} setThemeKey={setThemeKey}
                board={board}
                openCropper={openCropper}
                fallbackAvatar={fallbackAvatar}
              />
            )}
          </>}
        </div>

        {/* BOTTOM NAV */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto",
          background: "rgba(10,10,25,0.85)", backdropFilter: "blur(20px)",
          borderTop: `1px solid ${G}55`, display: "flex", zIndex: 99,
          boxShadow: `0 -4px 20px ${G}22`,
        }}>
          {TABS.map(n => {
            const active = tab === n.id;
            const locked = gateReady && premiumTabs.includes(n.id) && !premiumUnlocked;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                flex: 1, padding: "10px 4px 12px", background: "transparent", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                color: active ? G : "#555", position: "relative",
              }}>
                {active && <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: G, boxShadow: `0 0 8px ${G}` }} />}
                <span style={{ fontSize: 20, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", filter: active ? `drop-shadow(0 0 6px ${G})` : "none" }}>
                  {locked ? "🔒" : n.id === "profile" ? <User size={20} strokeWidth={2} /> : n.icon}
                </span>
                <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4AM PROOF-OF-WAKEUP MODAL */}
      {proof && (
        <div onClick={() => proof.mode === "result" && setProof(null)} style={{
          position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, animation: "fadeUp 0.25s ease-out",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 380, background: "rgba(10,10,25,0.95)",
            border: `1px solid ${G}77`, borderLeft: `3px solid ${G}`,
            padding: 20, boxShadow: `0 10px 60px ${G}55, inset 0 1px 0 ${G}33`,
            fontFamily: "monospace",
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
                      fontFamily: "monospace",
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

                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 2, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12 }}>🚨</span> EMERGENCY RINGTONE
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                  {RINGTONES.map(r => {
                    const active = ringtone === r.id;
                    return (
                      <button key={r.id} onClick={() => pickRingtone(r.id)} style={{
                        padding: "10px 8px",
                        background: active ? `linear-gradient(135deg, ${G}44, ${G2}22)` : "rgba(0,0,0,0.4)",
                        border: `1px solid ${active ? G : "#333"}`,
                        color: active ? "#fff" : "#aaa", cursor: "pointer",
                        fontFamily: "monospace", fontSize: 10, letterSpacing: 2, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                      }}>
                        <span>{active ? "◉" : "○"} {r.name}</span>
                        <span style={{ fontSize: 9, color: G }}>▶</span>
                      </button>
                    );
                  })}
                </div>

                <button onClick={() => setProof(null)} style={{
                  marginTop: 4, width: "100%", padding: 8, background: "transparent",
                  border: "1px solid #333", color: "#666", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 10, letterSpacing: 2,
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
                      fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2,
                    }}>
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{s === "math" ? "🧮" : "⚛️"}</div>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button onClick={() => setProof({ mode: "time" })} style={{
                  marginTop: 14, width: "100%", padding: 8, background: "transparent",
                  border: "1px solid #333", color: "#888", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 10, letterSpacing: 2,
                }}>← BACK</button>
              </>
            )}

            {proof.mode === "quiz" && (
              <>
                <div style={{ fontSize: 9, color: G, letterSpacing: 3, marginBottom: 8 }}>
                  {proof.subject === "math" ? "🧮 MATH" : "⚛️ PHYSICS"}
                </div>
                <div style={{
                  padding: 16, background: "rgba(0,0,0,0.5)", border: `1px solid ${G}44`,
                  fontSize: 15, color: "#fff", marginBottom: 14, lineHeight: 1.5, textAlign: "center", fontWeight: 700,
                }}>{proof.question}</div>
                <input
                  autoFocus type="number" inputMode="numeric" value={proof.input ?? ""}
                  onChange={e => setProof({ ...proof, input: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && submitProof()}
                  placeholder="Your answer"
                  style={{
                    width: "100%", padding: "12px 14px", background: "rgba(0,0,0,0.6)",
                    border: `1px solid ${G}66`, color: "#fff", fontFamily: "monospace",
                    fontSize: 18, letterSpacing: 2, textAlign: "center", outline: "none",
                    boxSizing: "border-box", marginBottom: 12,
                  }}
                />
                <button onClick={submitProof} disabled={!proof.input} style={{
                  width: "100%", padding: 12, background: proof.input ? `linear-gradient(90deg, ${G}, ${G2})` : "#222",
                  border: "none", color: proof.input ? "#000" : "#555", cursor: proof.input ? "pointer" : "not-allowed",
                  fontFamily: "monospace", fontSize: 12, fontWeight: 900, letterSpacing: 3,
                  boxShadow: proof.input ? `0 0 20px ${G}66` : "none",
                }}>SUBMIT PROOF</button>
                <button onClick={() => setProof(null)} style={{
                  marginTop: 8, width: "100%", padding: 6, background: "transparent",
                  border: "none", color: "#555", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 10, letterSpacing: 2,
                }}>CANCEL</button>
              </>
            )}

            {proof.mode === "result" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>{proof.correct ? "✅" : "❌"}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: proof.correct ? G : "#ff4466", letterSpacing: 2, marginBottom: 8 }}>
                  {proof.correct ? "PROOF ACCEPTED" : "PROOF FAILED"}
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 16, lineHeight: 1.5 }}>
                  {proof.correct
                    ? <>+{proof.wakePts ?? 10} coins added. {proof.wakeLine || "You rose while the world slept."}</>
                    : <>Correct answer was <span style={{ color: G }}>{proof.answer}</span>. No coins — but the discipline still counts.</>}
                </div>
                <button onClick={() => setProof(null)} style={{
                  width: "100%", padding: 10, background: `linear-gradient(90deg, ${G}, ${G2})`,
                  border: "none", color: "#000", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 11, fontWeight: 900, letterSpacing: 3,
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

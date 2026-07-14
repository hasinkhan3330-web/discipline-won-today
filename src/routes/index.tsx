import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
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

// Wikipedia Special:FilePath auto-resolves to the current image — no hash prefix needed.
const wiki = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=800`;

const QUOTES = [
  { p: "SHAH RUKH KHAN", q: "Success is not a good teacher, failure makes you humble.", img: wiki("Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg") },
  { p: "DAVID GOGGINS", q: "When your alarm goes off — that split second — that is the exact moment your character is being defined.", img: wiki("David_Goggins_2024.jpg") },
  { p: "KOBE BRYANT", q: "Everything negative — pressure, challenges — is all an opportunity for me to rise.", img: wiki("Kobe_Bryant_2014.jpg") },
  { p: "MICHAEL JORDAN", q: "I've failed over and over again in my life. And that is why I succeed.", img: wiki("Michael_Jordan_in_2014.jpg") },
  { p: "BRUCE LEE", q: "Do not pray for an easy life, pray for the strength to endure a difficult one.", img: wiki("Bruce_Lee_1973.jpg") },
  { p: "ELON MUSK", q: "When something is important enough, you do it even if the odds are not in your favor.", img: wiki("Elon_Musk_Colorado_2022_(cropped2).jpg") },
  { p: "ARNOLD SCHWARZENEGGER", q: "The mind is the limit. As long as the mind can envision it, you can do it.", img: wiki("Governor_Arnold_Schwarzenegger.jpg") },
  { p: "MUHAMMAD ALI", q: "Don't count the days, make the days count.", img: wiki("Muhammad_Ali_NYWTS.jpg") },
  { p: "STEVE JOBS", q: "Your time is limited, so don't waste it living someone else's life.", img: wiki("Steve_Jobs_Headshot_2010-CROP_(cropped_2).jpg") },
  { p: "CRISTIANO RONALDO", q: "Talent without working hard is nothing.", img: wiki("Cristiano_Ronaldo_2018.jpg") },
  { p: "LIONEL MESSI", q: "You have to fight to reach your dream. You have to sacrifice and work hard for it.", img: wiki("Lionel_Messi_20180626.jpg") },
  { p: "VIRAT KOHLI", q: "Self-belief and hard work will always earn you success.", img: wiki("Virat_Kohli_in_PMO_New_Delhi.jpg") },
  { p: "MS DHONI", q: "You can't ask for the process to be right and the result to also go in your favour every time.", img: wiki("MS_Dhoni_January_2016_(cropped).jpg") },
  { p: "SACHIN TENDULKAR", q: "I have played every match as if it was my last one.", img: wiki("Sachin_at_Castrol_Golden_Spanner_Awards_(crop).jpg") },
  { p: "RATAN TATA", q: "I don't believe in taking right decisions. I take decisions and then make them right.", img: wiki("Ratan_Tata_-_World_Economic_Forum_Annual_Meeting_2011.jpg") },
  { p: "A.P.J. ABDUL KALAM", q: "Dream is not that which you see while sleeping, it is something that does not let you sleep.", img: wiki("A._P._J._Abdul_Kalam.jpg") },
  { p: "NELSON MANDELA", q: "It always seems impossible until it's done.", img: wiki("Nelson_Mandela-2008_(edit).jpg") },
  { p: "MAHATMA GANDHI", q: "Be the change that you wish to see in the world.", img: wiki("Portrait_Gandhi.jpg") },
  { p: "ALBERT EINSTEIN", q: "Strive not to be a success, but rather to be of value.", img: wiki("Einstein_1921_by_F_Schmutzer_-_restoration.jpg") },
  { p: "WARREN BUFFETT", q: "The more you learn, the more you earn.", img: wiki("Warren_Buffett_KU_Visit.jpg") },
  { p: "BILL GATES", q: "It's fine to celebrate success but it is more important to heed the lessons of failure.", img: wiki("Bill_Gates_2018.jpg") },
  { p: "JEFF BEZOS", q: "If you decide that you're going to do only the things you know are going to work, you're going to leave a lot of opportunity on the table.", img: wiki("Jeff_Bezos_2016.jpg") },
  { p: "MARK ZUCKERBERG", q: "The biggest risk is not taking any risk.", img: wiki("Mark_Zuckerberg_F8_2018_Keynote_(cropped).jpg") },
  { p: "SUNDAR PICHAI", q: "Wear your failure as a badge of honor.", img: wiki("Sundar_Pichai_WEF_2020.png") },
  { p: "MIKE TYSON", q: "Discipline is doing what you hate to do, but doing it like you love it.", img: wiki("Mike_Tyson_2019_by_Glenn_Francis.jpg") },
  { p: "CONOR McGREGOR", q: "There's no talent here, this is hard work. This is an obsession.", img: wiki("Conor_McGregor_2018.jpg") },
  { p: "DWAYNE JOHNSON", q: "Success isn't always about greatness. It's about consistency.", img: wiki("Dwayne_Johnson_2014_(cropped).jpg") },
  { p: "SYLVESTER STALLONE", q: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", img: wiki("Sylvester_Stallone_Cannes_2019.jpg") },
  { p: "KEANU REEVES", q: "The simple act of paying attention can take you a long way.", img: wiki("Keanu_Reeves_2019.jpg") },
];

const THEMES = {
  space: { name: "COSMOS", accent: "#00d4ff", accent2: "#7b5cff", glow: "0 0 20px #00d4ff" },
  blood: { name: "BLOOD", accent: "#ff2e4d", accent2: "#ff6a00", glow: "0 0 20px #ff2e4d" },
  matrix: { name: "MATRIX", accent: "#00ff88", accent2: "#00d46a", glow: "0 0 20px #00ff88" },
  gold: { name: "GOLD", accent: "#ffcc33", accent2: "#ff8800", glow: "0 0 20px #ffcc33" },
} as const;

type ThemeKey = keyof typeof THEMES;

function SpaceWallpaper({ accent }: { accent: string }) {
  // deterministic star field
  const stars = Array.from({ length: 90 }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 71) % 100;
    const s = ((i * 13) % 3) + 1;
    const d = ((i * 7) % 40) / 10;
    return { x, y, s, d, k: i };
  });
  const shootingStars = [0, 1, 2, 3];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", background: "radial-gradient(ellipse at 20% 10%, #1a0a3e 0%, #0a0620 40%, #000 100%)" }}>
      {/* nebula glow */}
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-20%", width: 500, height: 500, background: "radial-gradient(circle, #7b5cff33 0%, transparent 60%)", filter: "blur(40px)" }} />

      {/* moon */}
      <div style={{ position: "absolute", top: 60, right: 30, width: 90, height: 90, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #f5f0dc 0%, #d4cba8 40%, #8a8168 100%)", boxShadow: `0 0 60px rgba(245,240,220,0.4), 0 0 120px ${accent}33, inset -8px -12px 20px rgba(0,0,0,0.5)` }}>
        <div style={{ position: "absolute", top: 18, left: 22, width: 10, height: 10, borderRadius: "50%", background: "rgba(0,0,0,0.15)" }} />
        <div style={{ position: "absolute", top: 40, left: 55, width: 6, height: 6, borderRadius: "50%", background: "rgba(0,0,0,0.15)" }} />
        <div style={{ position: "absolute", top: 60, left: 30, width: 14, height: 8, borderRadius: "50%", background: "rgba(0,0,0,0.12)" }} />
      </div>

      {/* stars */}
      {stars.map(st => (
        <div key={st.k} style={{
          position: "absolute", left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s,
          background: "#fff", borderRadius: "50%", boxShadow: `0 0 ${st.s * 3}px #fff`,
          animation: `twinkle 3s ease-in-out ${st.d}s infinite`,
        }} />
      ))}

      {/* shooting stars */}
      {shootingStars.map(i => (
        <div key={i} style={{
          position: "absolute", top: `${10 + i * 20}%`, left: "-10%",
          width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, #fff)`,
          boxShadow: `0 0 8px ${accent}`,
          animation: `shoot 6s linear ${i * 2.2}s infinite`,
          transform: "rotate(20deg)",
        }} />
      ))}

      {/* scanline grid */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${accent}05 1px, transparent 1px), linear-gradient(90deg, ${accent}05 1px, transparent 1px)`, backgroundSize: "40px 40px", opacity: 0.4 }} />
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState<"splash" | "app">("splash");
  const [tab, setTab] = useState("home");
  const [themeKey, setThemeKey] = useState<ThemeKey>("space");
  const [coins, setCoins] = useState(1240);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, icon: "🌅", name: "Wake Up 4AM", pts: 10, done: false },
    { id: 2, icon: "🚿", name: "Cold Shower", pts: 4, done: false },
    { id: 3, icon: "💪", name: "Workout", pts: 15, done: false },
    { id: 4, icon: "📚", name: "Deep Focus", pts: 8, done: false },
    { id: 5, icon: "📵", name: "Phone Free", pts: 5, done: false },
    { id: 6, icon: "🎯", name: "Daily Goals", pts: 4, done: false },
    { id: 7, icon: "🍔", name: "No Junk Food", pts: 4, done: false },
    { id: 8, icon: "🧘", name: "Meditation", pts: 3, done: false },
  ]);

  // 4AM proof-of-wakeup state
  const [proof, setProof] = useState<null | {
    mode: "choose" | "quiz" | "result";
    subject?: "math" | "physics";
    question?: string;
    answer?: number;
    input?: string;
    correct?: boolean;
  }>(null);

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
    setProof({ mode: "quiz", subject, question: q, answer: a, input: "" });
  };

  const submitProof = () => {
    if (!proof || proof.mode !== "quiz") return;
    const correct = Number(proof.input) === proof.answer;
    setProof({ ...proof, mode: "result", correct });
    if (correct) {
      setTasks(p => p.map(t => t.id === 1 && !t.done ? { ...t, done: true } : t));
      setCoins(c => c + 10);
    }
  };

  const tick = (id: number) => {
    if (id === 1) {
      const t = tasks.find(x => x.id === 1);
      if (t && !t.done) { setProof({ mode: "choose" }); return; }
    }
    setTasks(p => p.map(t => {
      if (t.id === id && !t.done) { setCoins(c => c + t.pts); return { ...t, done: true }; }
      return t;
    }));
  };

  const done = tasks.filter(t => t.done).length;
  const pct = Math.round(done / tasks.length * 100);
  const streak = 12;

  // GLOBAL KEYFRAMES
  const keyframes = `
    @keyframes twinkle { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
    @keyframes shoot { 0%{transform:translateX(0) translateY(0) rotate(20deg);opacity:0} 10%{opacity:1} 70%{opacity:1} 100%{transform:translateX(140vw) translateY(60vh) rotate(20deg);opacity:0} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes glow { 0%,100%{text-shadow:0 0 20px ${G},0 0 40px ${G}} 50%{text-shadow:0 0 30px ${G},0 0 60px ${G},0 0 80px ${G2}} }
    @keyframes orbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  `;

  if (screen === "splash") {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#000", position: "relative", overflow: "hidden", fontFamily: "monospace" }}>
        <style>{keyframes}</style>
        <SpaceWallpaper accent={G} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {/* orbit ring */}
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

  const CARD: React.CSSProperties = {
    background: "rgba(10,10,25,0.55)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${G}33`,
    borderLeft: `2px solid ${G}`,
    padding: 14,
    marginBottom: 12,
    boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 ${G}22`,
    borderRadius: 2,
  };
  const TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#e8e8e8", marginBottom: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 };

  const TABS = [
    { id: "home", icon: "⚔️", label: "Home" },
    { id: "rank", icon: "🏆", label: "Rank" },
    { id: "quotes", icon: "💬", label: "Quotes" },
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
            {/* theme swatches */}
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
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 90px", animation: "fadeUp 0.4s ease-out" }} key={tab}>

          {tab === "home" && <>
            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> TODAY'S <span style={{ color: G }}>STATS</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[{ v: coins, l: "COINS" }, { v: `${streak}d`, l: "STREAK" }, { v: `${done}/${tasks.length}`, l: "TASKS" }, { v: `${pct}%`, l: "COMPLETE" }].map((s, i) => (
                  <div key={i} style={{ background: `linear-gradient(135deg, ${G}15, transparent)`, border: `1px solid ${G}33`, padding: "12px 10px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 20, height: 20, borderTop: `1px solid ${G}`, borderRight: `1px solid ${G}` }} />
                    <div style={{ fontSize: 22, fontWeight: 800, color: G, textShadow: `0 0 12px ${G}88` }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "#888", letterSpacing: 2, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between", marginBottom: 5, letterSpacing: 2 }}>
                <span>MISSION PROGRESS</span><span style={{ color: G }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: "#0a0a15", borderRadius: 3, border: `1px solid ${G}22`, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 10px ${G}`, transition: "width 0.5s" }} />
              </div>
            </div>

            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> TODAY'S <span style={{ color: G }}>MISSION</span></div>
              {tasks.map(t => (
                <div key={t.id} onClick={() => tick(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 10px",
                  background: t.done ? "rgba(0,0,0,0.3)" : `linear-gradient(90deg, ${G}12, transparent)`,
                  border: `1px solid ${t.done ? "#222" : G + "33"}`,
                  borderLeft: `3px solid ${t.done ? "#333" : G}`,
                  marginBottom: 6, cursor: "pointer", opacity: t.done ? 0.45 : 1,
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", textDecoration: t.done ? "line-through" : "none", letterSpacing: 1 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: G, letterSpacing: 1, marginTop: 2 }}>+{t.pts} COINS</div>
                  </div>
                  <div style={{ width: 22, height: 22, border: `1.5px solid ${t.done ? G : "#333"}`, background: t.done ? G : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#000", fontWeight: 900, boxShadow: t.done ? `0 0 10px ${G}` : "none" }}>{t.done ? "✓" : ""}</div>
                </div>
              ))}
            </div>
          </>}

          {tab === "rank" && <div style={CARD}>
            <div style={TITLE}><span style={{ color: G }}>▸</span> GLOBAL <span style={{ color: G }}>LEADERBOARD</span></div>
            {[
              { r: 1, n: "IRON_WARRIOR", c: 8940, s: 67 },
              { r: 2, n: "DISCIPLINE_X", c: 7234, s: 45 },
              { r: 3, n: "5AM_BEAST", c: 6102, s: 38 },
              { r: 4, n: "MONK_MODE", c: 5200, s: 29 },
              { r: 5, n: "YOU", c: coins, s: streak, you: true },
              { r: 6, n: "SHADOW_RUN", c: 3421, s: 19 },
              { r: 7, n: "NOCHILL_99", c: 2156, s: 12 },
            ].map(u => (
              <div key={u.r} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px",
                background: u.you ? `linear-gradient(90deg, ${G}22, transparent)` : "rgba(0,0,0,0.3)",
                border: `1px solid ${u.you ? G + "66" : "#222"}`, borderLeft: `3px solid ${u.you ? G : "#333"}`,
                marginBottom: 6,
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: u.r <= 3 ? G : "#555", width: 22, textAlign: "center" }}>
                  {u.r === 1 ? "🥇" : u.r === 2 ? "🥈" : u.r === 3 ? "🥉" : u.r}
                </div>
                <img src={`https://i.pravatar.cc/40?img=${u.r + 10}`} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${G}44` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1 }}>{u.n}</div>
                  <div style={{ fontSize: 10, color: "#666", letterSpacing: 1 }}>{u.s} DAY STREAK</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: G, textShadow: `0 0 8px ${G}66` }}>{u.c}</div>
              </div>
            ))}
          </div>}

          {tab === "quotes" && <>
            {QUOTES.map((q, i) => (
              <div key={i} style={{
                position: "relative", marginBottom: 12, borderRadius: 2, overflow: "hidden",
                border: `1px solid ${G}44`, borderLeft: `3px solid ${G}`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
                background: "rgba(10,10,25,0.6)", backdropFilter: "blur(10px)",
              }}>
                <div style={{ position: "relative", height: 380, overflow: "hidden", background: "#05050a" }}>
                  <img src={q.img} alt={q.p} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "contrast(1.05) saturate(1.1)" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 60%, rgba(10,10,25,0.95) 100%)`, pointerEvents: "none" }} />

                  <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "4px 8px", background: "rgba(0,0,0,0.6)", border: `1px solid ${G}66` }}>◉ LEGEND #{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 2, textShadow: `0 0 10px ${G}` }}>{q.p}</div>
                </div>
                <div style={{ padding: 14, fontSize: 13, color: "#ddd", lineHeight: 1.7, fontStyle: "italic", borderTop: `1px solid ${G}22` }}>
                  <span style={{ color: G, fontSize: 20, marginRight: 4 }}>"</span>
                  {q.q}
                  <span style={{ color: G, fontSize: 20, marginLeft: 4 }}>"</span>
                </div>
              </div>
            ))}
          </>}

          {tab === "stats" && <div style={CARD}>
            <div style={TITLE}><span style={{ color: G }}>▸</span> WEEKLY <span style={{ color: G }}>PROGRESS</span></div>
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "TDY"].map((d, i) => {
              const v = [80, 65, 90, 45, 75, 100, pct][i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, fontSize: 10, color: "#666", letterSpacing: 2 }}>{d}</div>
                  <div style={{ flex: 1, height: 8, background: "#0a0a15", borderRadius: 4, border: `1px solid ${G}22`, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${v}%`, background: `linear-gradient(90deg,${G},${G2})`, boxShadow: `0 0 8px ${G}` }} />
                  </div>
                  <div style={{ width: 32, fontSize: 11, color: G, textAlign: "right", fontWeight: 700 }}>{v}%</div>
                </div>
              );
            })}
          </div>}

          {tab === "profile" && <>
            {/* TOP RANKED — auto-sorted by coins, top holder shown large */}
            {(() => {
              const roster = [
                { n: "IRON_WARRIOR", c: 8940, s: 67, img: "https://i.pravatar.cc/200?img=12" },
                { n: "DISCIPLINE_X", c: 7234, s: 45, img: "https://i.pravatar.cc/200?img=15" },
                { n: "5AM_BEAST", c: 6102, s: 38, img: "https://i.pravatar.cc/200?img=33" },
                { n: "MONK_MODE", c: 5200, s: 29, img: "https://i.pravatar.cc/200?img=52" },
                { n: "YOU", c: coins, s: streak, img: "https://i.pravatar.cc/200?img=68" },
                { n: "SHADOW_RUN", c: 3421, s: 19, img: "https://i.pravatar.cc/200?img=57" },
              ].sort((a, b) => b.c - a.c);
              const [top, second, third] = roster;
              return (
                <div style={{ ...CARD, textAlign: "center", padding: 22, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${G}44, transparent 70%)` }} />
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div style={{ fontSize: 10, color: G, letterSpacing: 4, marginBottom: 10 }}>◈ #1 ON THE GRID ◈</div>
                    <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 10px" }}>
                      <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${G}`, boxShadow: `0 0 24px ${G}, inset 0 0 16px ${G}66`, animation: "orbit 10s linear infinite" }}>
                        <div style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, borderRadius: "50%", background: G2, boxShadow: `0 0 12px ${G2}` }} />
                      </div>
                      <img src={top.img} alt={top.n} style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: `3px solid ${G}`, boxShadow: `0 0 30px ${G}` }} />
                      <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: 26, filter: `drop-shadow(0 0 8px ${G})` }}>🥇</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 12px ${G}` }}>{top.n}</div>
                    <div style={{ fontSize: 11, color: G, letterSpacing: 2, marginBottom: 14 }}>{top.c} COINS · {top.s}d STREAK</div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 6 }}>
                      {[{ u: second, medal: "🥈", rank: "#2" }, { u: third, medal: "🥉", rank: "#3" }].map(({ u, medal, rank }) => (
                        <div key={u.n} style={{ textAlign: "center" }}>
                          <div style={{ position: "relative", width: 62, height: 62, margin: "0 auto 6px" }}>
                            <img src={u.img} alt={u.n} style={{ width: 62, height: 62, borderRadius: "50%", objectFit: "cover", border: `2px solid ${G}88`, boxShadow: `0 0 12px ${G}55` }} />
                            <div style={{ position: "absolute", bottom: -3, right: -3, fontSize: 16 }}>{medal}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1 }}>{u.n}</div>
                          <div style={{ fontSize: 9, color: G, letterSpacing: 1 }}>{rank} · {u.c}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> THEME <span style={{ color: G }}>SELECTOR</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(Object.keys(THEMES) as ThemeKey[]).map(k => {
                  const t = THEMES[k];
                  const active = themeKey === k;
                  return (
                    <button key={k} onClick={() => setThemeKey(k)} style={{
                      background: active ? `linear-gradient(135deg, ${t.accent}33, ${t.accent2}22)` : "rgba(0,0,0,0.3)",
                      border: `1px solid ${active ? t.accent : "#333"}`,
                      borderLeft: `3px solid ${t.accent}`,
                      padding: "12px 10px", cursor: "pointer", color: "#e8e8e8",
                      fontFamily: "monospace", textAlign: "left",
                      boxShadow: active ? `0 0 15px ${t.accent}55` : "none",
                    }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent2 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: active ? t.accent : "#ccc" }}>{t.name}</div>
                      <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{active ? "◉ ACTIVE" : "○ SELECT"}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VICTORIES — cinematic photo cards with hard-hitting one-liners */}
            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> <span style={{ color: G }}>VICTORIES</span></div>
              {[
                {
                  label: "4AM AWAKENING",
                  cond: "Woke up at 4AM today",
                  line: "No one woke you. You rose at 4AM while the world slept.",
                  done: tasks.find(t => t.id === 1)?.done ?? false,
                  img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
                },
                {
                  label: "7 DAY IRON WEEK",
                  cond: "7 days · zero misses",
                  line: "95% of people quit here. You are not one of them.",
                  done: streak >= 7,
                  img: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&q=80",
                },
                {
                  label: "30 DAY REWIRE",
                  cond: "30 days · unbroken",
                  line: "Thirty days. You did not build a habit — you rewrote your identity.",
                  done: streak >= 30,
                  img: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80",
                },
              ].map((v, i) => (
                <div key={i} style={{
                  position: "relative", height: 130, marginBottom: 10, overflow: "hidden",
                  border: `1px solid ${v.done ? G + "88" : "#222"}`,
                  borderLeft: `3px solid ${v.done ? G : "#333"}`,
                  opacity: v.done ? 1 : 0.55,
                  boxShadow: v.done ? `0 4px 20px ${G}22` : "none",
                }}>
                  <img src={v.img} alt={v.label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: v.done ? `contrast(1.1) saturate(1.15)` : "grayscale(0.9) brightness(0.5)" }} />
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(5,5,15,0.35) 0%, rgba(5,5,15,0.92) 100%)` }} />
                  <div style={{ position: "absolute", top: 8, left: 10, fontSize: 9, color: v.done ? G : "#666", letterSpacing: 2, padding: "3px 7px", background: "rgba(0,0,0,0.7)", border: `1px solid ${v.done ? G + "77" : "#333"}` }}>
                    {v.done ? "◉ UNLOCKED" : "🔒 LOCKED"} · {v.cond}
                  </div>
                  <div style={{ position: "absolute", bottom: 8, left: 10, right: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 10px ${G}`, marginBottom: 4 }}>{v.label}</div>
                    <div style={{ fontSize: 11, color: "#e0e0e8", lineHeight: 1.4, fontStyle: "italic" }}>
                      <span style={{ color: G, marginRight: 3 }}>"</span>{v.line}<span style={{ color: G, marginLeft: 3 }}>"</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                flex: 1, padding: "10px 4px 12px", background: "transparent", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                color: active ? G : "#555", position: "relative",
              }}>
                {active && <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: G, boxShadow: `0 0 8px ${G}` }} />}
                <span style={{ fontSize: 20, filter: active ? `drop-shadow(0 0 6px ${G})` : "none" }}>{n.icon}</span>
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
            <div style={{ fontSize: 10, letterSpacing: 4, color: G, marginBottom: 6 }}>▸ 04:00 PROTOCOL</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 2, marginBottom: 4, textShadow: `0 0 12px ${G}` }}>PROVE YOU ARE AWAKE</div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 18, lineHeight: 1.5 }}>
              Sleeping minds cannot solve. Answer correctly to earn <span style={{ color: G }}>+10 coins</span>.
            </div>

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
                <button onClick={() => setProof(null)} style={{
                  marginTop: 14, width: "100%", padding: 8, background: "transparent",
                  border: "1px solid #333", color: "#666", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 10, letterSpacing: 2,
                }}>CANCEL</button>
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
                    ? <>+10 coins added. You rose while the world slept.</>
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
    </div>
  );
}

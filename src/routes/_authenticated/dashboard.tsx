import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Wikipedia Special:FilePath auto-resolves to the current image — no hash prefix needed.
const wiki = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=800`;

// Each legend has MULTIPLE photos AND MULTIPLE quotes.
// Every day: person + photo + quote all rotate independently → always a fresh combo, never the same card twice in a row.
const LEGENDS: { p: string; imgs: string[]; qs: string[] }[] = [
  { p: "SHAH RUKH KHAN", imgs: ["Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg", "Shah_Rukh_Khan_2014.jpg", "Shah_Rukh_Khan_at_the_Ra.One_Music_Launch.jpg"].map(wiki),
    qs: ["Success is not a good teacher, failure makes you humble.", "I am a self-made man. And it is my hard work that has made me what I am today.", "Never give up. Have faith in yourself.", "Dreams are the ones that don't let you sleep."] },
  { p: "DAVID GOGGINS", imgs: ["David_Goggins_2024.jpg", "David_Goggins_2013.jpg"].map(wiki),
    qs: ["When your alarm goes off — that split second — that is the exact moment your character is being defined.", "You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.", "The only way you gain mental toughness is to do things you're not happy doing.", "Suffering is the true test of life."] },
  { p: "KOBE BRYANT", imgs: ["Kobe_Bryant_2014.jpg", "Kobe_Bryant_8.jpg", "Kobe_Bryant_2010.jpg"].map(wiki),
    qs: ["Everything negative — pressure, challenges — is all an opportunity for me to rise.", "The most important thing is to try and inspire people so that they can be great in whatever they want to do.", "Great things come from hard work and perseverance. No excuses.", "Rest at the end, not in the middle."] },
  { p: "MICHAEL JORDAN", imgs: ["Michael_Jordan_in_2014.jpg", "Michael-Jordan.jpg"].map(wiki),
    qs: ["I've failed over and over again in my life. And that is why I succeed.", "I can accept failure, everyone fails at something. But I can't accept not trying.", "Some people want it to happen, some wish it would happen, others make it happen.", "Talent wins games, but teamwork and intelligence win championships."] },
  { p: "BRUCE LEE", imgs: ["Bruce_Lee_1973.jpg", "Bruce_Lee_As_Kato_1967.jpg"].map(wiki),
    qs: ["Do not pray for an easy life, pray for the strength to endure a difficult one.", "Absorb what is useful, discard what is not, add what is uniquely your own.", "The successful warrior is the average man, with laser-like focus.", "Knowing is not enough, we must apply. Willing is not enough, we must do."] },
  { p: "ELON MUSK", imgs: ["Elon_Musk_Colorado_2022_(cropped2).jpg", "Elon_Musk_Royal_Society_(crop2).jpg"].map(wiki),
    qs: ["When something is important enough, you do it even if the odds are not in your favor.", "Failure is an option here. If things are not failing, you are not innovating enough.", "Persistence is very important. You should not give up unless you are forced to give up.", "The first step is to establish that something is possible; then probability will occur."] },
  { p: "ARNOLD SCHWARZENEGGER", imgs: ["Governor_Arnold_Schwarzenegger.jpg", "Arnold_Schwarzenegger_by_Gage_Skidmore_4.jpg"].map(wiki),
    qs: ["The mind is the limit. As long as the mind can envision it, you can do it.", "Strength does not come from winning. Your struggles develop your strengths.", "The worst thing I can be is the same as everybody else. I hate that.", "The last three or four reps is what makes the muscle grow."] },
  { p: "MUHAMMAD ALI", imgs: ["Muhammad_Ali_NYWTS.jpg", "Muhammad_Ali_1966.jpg"].map(wiki),
    qs: ["Don't count the days, make the days count.", "I hated every minute of training, but I said, 'Suffer now and live the rest of your life as a champion.'", "He who is not courageous enough to take risks will accomplish nothing in life.", "Impossible is just a word thrown around by small men."] },
  { p: "STEVE JOBS", imgs: ["Steve_Jobs_Headshot_2010-CROP_(cropped_2).jpg", "Steve_Jobs_1955-2011.jpg"].map(wiki),
    qs: ["Your time is limited, so don't waste it living someone else's life.", "Stay hungry, stay foolish.", "Innovation distinguishes between a leader and a follower.", "The only way to do great work is to love what you do."] },
  { p: "CRISTIANO RONALDO", imgs: ["Cristiano_Ronaldo_2018.jpg", "Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis,_September_2023_(cropped).jpg"].map(wiki),
    qs: ["Talent without working hard is nothing.", "Your love makes me strong, your hate makes me unstoppable.", "I'm living a dream I never want to wake up from.", "Dedication, hard work all the time, and belief."] },
  { p: "LIONEL MESSI", imgs: ["Lionel_Messi_20180626.jpg", "Lionel-Messi-Argentina-2022-FIFA-World-Cup_(cropped).jpg"].map(wiki),
    qs: ["You have to fight to reach your dream. You have to sacrifice and work hard for it.", "It took me 17 years and 114 days to become an overnight success.", "The best decisions aren't made with your mind, but with your instinct.", "You can overcome anything, if and only if you love something enough."] },
  { p: "VIRAT KOHLI", imgs: ["Virat_Kohli_in_PMO_New_Delhi.jpg", "Virat_Kohli_January_2023_(cropped).jpg"].map(wiki),
    qs: ["Self-belief and hard work will always earn you success.", "You have to just concentrate on things you can control.", "If you chase perfection, you catch excellence.", "I want to leave a legacy for people who watch me play cricket."] },
  { p: "MS DHONI", imgs: ["MS_Dhoni_January_2016_(cropped).jpg", "Dhoni_stumping_a_batsman_(cropped).jpg"].map(wiki),
    qs: ["You can't ask for the process to be right and the result to also go in your favour every time.", "Never let success get to your head and never let failure get to your heart.", "Yes, I do get emotional. That's how you know you are alive.", "I don't ever want people to say I did something for my personal gain."] },
  { p: "SACHIN TENDULKAR", imgs: ["Sachin_at_Castrol_Golden_Spanner_Awards_(crop).jpg", "Sachin_Tendulkar_in_July_2023.jpg"].map(wiki),
    qs: ["I have played every match as if it was my last one.", "Chase your dreams, but always know the road that will lead you home again.", "When people throw stones at you, you turn them into milestones.", "Discipline and consistency have taken me where I am today."] },
  { p: "RATAN TATA", imgs: ["Ratan_Tata_-_World_Economic_Forum_Annual_Meeting_2011.jpg", "Ratan_Tata_in_Vancouver.jpg"].map(wiki),
    qs: ["I don't believe in taking right decisions. I take decisions and then make them right.", "If you want to walk fast, walk alone. If you want to walk far, walk together.", "None can destroy iron, but its own rust can. Likewise, none can destroy a person, but their own mindset can.", "Take the stones people throw at you, and use them to build a monument."] },
  { p: "A.P.J. ABDUL KALAM", imgs: ["A._P._J._Abdul_Kalam.jpg", "A._P._J._Abdul_Kalam_in_2008.jpg"].map(wiki),
    qs: ["Dream is not that which you see while sleeping, it is something that does not let you sleep.", "You have to dream before your dreams can come true.", "If you want to shine like a sun, first burn like a sun.", "Man needs difficulties in life because they are necessary to enjoy success."] },
  { p: "NELSON MANDELA", imgs: ["Nelson_Mandela-2008_(edit).jpg", "Nelson_Mandela_1994.jpg"].map(wiki),
    qs: ["It always seems impossible until it's done.", "I learned that courage was not the absence of fear, but the triumph over it.", "The greatest glory in living lies not in never falling, but in rising every time we fall.", "Do not judge me by my successes, judge me by how many times I fell down and got back up again."] },
  { p: "ALBERT EINSTEIN", imgs: ["Einstein_1921_by_F_Schmutzer_-_restoration.jpg", "Albert_Einstein_1947.jpg"].map(wiki),
    qs: ["Strive not to be a success, but rather to be of value.", "In the middle of difficulty lies opportunity.", "A person who never made a mistake never tried anything new.", "Life is like riding a bicycle. To keep your balance, you must keep moving."] },
  { p: "WARREN BUFFETT", imgs: ["Warren_Buffett_KU_Visit.jpg", "Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit.jpg"].map(wiki),
    qs: ["The more you learn, the more you earn.", "It's better to hang out with people better than you.", "Someone is sitting in the shade today because someone planted a tree a long time ago.", "Risk comes from not knowing what you're doing."] },
  { p: "BILL GATES", imgs: ["Bill_Gates_2018.jpg", "Bill_Gates_2017_(cropped).jpg"].map(wiki),
    qs: ["It's fine to celebrate success but it is more important to heed the lessons of failure.", "Your most unhappy customers are your greatest source of learning.", "Patience is a key element of success.", "Don't compare yourself with anyone in this world. If you do, you are insulting yourself."] },
  { p: "JEFF BEZOS", imgs: ["Jeff_Bezos_2016.jpg", "Jeff_Bezos_at_Amazon_Spheres_Grand_Opening_in_Seattle_-_2018_(39074799225)_(cropped).jpg"].map(wiki),
    qs: ["If you decide that you're going to do only the things you know are going to work, you're going to leave a lot of opportunity on the table.", "Life is too short to hang out with people who are not resourceful.", "What we need to do is always lean into the future.", "In the end, we are our choices."] },
  { p: "MIKE TYSON", imgs: ["Mike_Tyson_2019_by_Glenn_Francis.jpg", "Mike_Tyson_20AUG09.jpg"].map(wiki),
    qs: ["Discipline is doing what you hate to do, but doing it like you love it.", "Everyone has a plan until they get punched in the mouth.", "I'm a dreamer. I have to dream and reach for the stars.", "My power is discombobulatingly devastating."] },
  { p: "CONOR McGREGOR", imgs: ["Conor_McGregor_2018.jpg", "Conor_McGregor_2015.jpg"].map(wiki),
    qs: ["There's no talent here, this is hard work. This is an obsession.", "We're not here to take part. We're here to take over.", "Doubt is only removed by action.", "If you can see it in your mind, you can hold it in your hand."] },
  { p: "DWAYNE JOHNSON", imgs: ["Dwayne_Johnson_2014_(cropped).jpg", "Dwayne_Johnson_2018.jpg"].map(wiki),
    qs: ["Success isn't always about greatness. It's about consistency.", "Be humble. Be hungry. And always be the hardest worker in the room.", "Wake up determined, go to bed satisfied.", "The wall is there to see how bad you want it."] },
  { p: "SYLVESTER STALLONE", imgs: ["Sylvester_Stallone_Cannes_2019.jpg", "Sylvester_Stallone_November_9,_2012.jpg"].map(wiki),
    qs: ["It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", "Every champion was once a contender that refused to give up.", "I take rejection as someone blowing a bugle in my ear to wake me up.", "Life's not about how hard of a hit you can give. It's about how many you can take, and still keep moving forward."] },
  { p: "LEBRON JAMES", imgs: ["LeBron_James_%2851959977144%29_(cropped2).jpg", "LeBron_James_(15662939969)_(cropped).jpg"].map(wiki),
    qs: ["You have to be able to accept failure to get better.", "I like criticism. It makes you strong.", "Nothing is given. Everything is earned.", "I treated my body like a machine — I gave it the best fuel and worked it hard."] },
  { p: "USAIN BOLT", imgs: ["Usain_Bolt_Rio_100m_final_2016k.jpg", "Usain_Bolt_smiling_Berlin_2009.JPG"].map(wiki),
    qs: ["I trained four years to run nine seconds. People give up when they don't see results in two months.", "Kill them with success and bury them with a smile.", "I know what I can do, so it doesn't bother me what other people think.", "Dreams are free. Goals have a cost."] },
  { p: "NEYMAR JR", imgs: ["Bra-Cos_(6)_(cropped).jpg", "Neymar_-_MG_9061_(cropped).jpg"].map(wiki),
    qs: ["It is not about being the best. It is about being better than you were yesterday.", "In football, as in life, you must always keep fighting.", "Everything is possible if you believe.", "I want to be an athlete that people remember."] },
  { p: "TONY ROBBINS", imgs: ["Tony_Robbins_-_Unleash_the_Power_Within,_London_-_2019_(48918961658)_(cropped).jpg", "Tony_Robbins.jpg"].map(wiki),
    qs: ["The path to success is to take massive, determined action.", "Setting goals is the first step in turning the invisible into the visible.", "Where focus goes, energy flows.", "Beliefs have the power to create and the power to destroy."] },
  { p: "STEPHEN HAWKING", imgs: ["Stephen_Hawking.StarChild.jpg", "Stephen_Hawking_in_Cambridge.jpg"].map(wiki),
    qs: ["However difficult life may seem, there is always something you can do and succeed at.", "Intelligence is the ability to adapt to change.", "Look up at the stars and not down at your feet.", "Quiet people have the loudest minds."] },
];

// Fixed random-ish permutation so each day pulls a fresh (person, quote, photo) combo.
// Same day → same combo on every reload (deterministic). Next day → guaranteed change.
const rot = (s: number, m: number) => ((s % m) + m) % m;
const dayCombo = (dayIdx: number) => {
  const person = LEGENDS[rot(dayIdx * 7 + 3, LEGENDS.length)];
  const q = person.qs[rot(dayIdx * 5 + 1, person.qs.length)];
  const img = person.imgs[rot(dayIdx * 3 + 2, person.imgs.length)];
  return { p: person.p, q, img };
};


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
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const [screen, setScreen] = useState<"splash" | "app">("splash");
  const [tab, setTab] = useState("home");
  const [themeKey, setThemeKey] = useState<ThemeKey>("space");

  // ===== SUPABASE-BACKED STATE =====
  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<{ n: string; c: number; s: number; img: string; you?: boolean }[]>([]);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("YOU");

  const fallbackAvatar = (n: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=0a0a19&color=00ff88&size=200&bold=true`;

  const refreshAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    setMyId(uid);

    const today = new Date().toISOString().slice(0, 10);
    const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const [{ data: prof }, { data: taskRows }, { data: doneToday }, { data: leaders }, { data: weekRows }] = await Promise.all([
      supabase.from("profiles").select("display_name, coins, streak, avatar_url").eq("id", uid).maybeSingle(),
      supabase.from("tasks").select("id, icon, name, pts, sort_order").eq("user_id", uid).eq("is_active", true).order("sort_order"),
      supabase.from("task_completions").select("task_id").eq("user_id", uid).eq("completed_on", today),
      supabase.from("public_profiles").select("id, display_name, username, avatar_url, coins, streak").order("coins", { ascending: false }).order("streak", { ascending: false }).limit(20),
      supabase.from("task_completions").select("completed_on").eq("user_id", uid).gte("completed_on", sevenAgo),
    ]);

    if (prof) {
      setCoins(prof.coins ?? 0);
      setStreak(prof.streak ?? 0);
      setMyName(prof.display_name || "YOU");
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

    // Weekly bars: last 7 days completion count / total tasks
    const total = (taskRows || []).length || 1;
    const counts: Record<string, number> = {};
    (weekRows || []).forEach(r => { counts[r.completed_on] = (counts[r.completed_on] || 0) + 1; });
    const bars: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      bars.push(Math.min(100, Math.round((counts[d] || 0) / total * 100)));
    }
    setWeekly(bars);
  };

  useEffect(() => { refreshAll(); }, []);


  // 4AM proof-of-wakeup state
  const [proof, setProof] = useState<null | {
    mode: "choose" | "quiz" | "result";
    subject?: "math" | "physics";
    question?: string;
    answer?: number;
    input?: string;
    correct?: boolean;
  }>(null);

  // MEDITATION state
  const [medMin, setMedMin] = useState(5);
  const [medLeft, setMedLeft] = useState(5 * 60);
  const [medRun, setMedRun] = useState(false);
  const [medSessions, setMedSessions] = useState(0);
  const [medTotal, setMedTotal] = useState(0);

  useEffect(() => {
    if (!medRun) return;
    const id = setInterval(() => {
      setMedLeft(s => {
        if (s <= 1) {
          setMedRun(false);
          setMedSessions(x => x + 1);
          setMedTotal(x => x + medMin);
          // Award via meditation task RPC (idempotent per day). If already claimed today, no double reward.
          const medTask = tasks.find(t => /medit/i.test(t.name));
          if (medTask && !medTask.done) completeTaskRpc((medTask as any)._uuid);
          return medMin * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [medRun, medMin, tasks]);


  // Derive breathing phase from elapsed seconds — no extra timers needed.
  const elapsed = medMin * 60 - medLeft;
  const phaseSec = elapsed % 8;
  const medPhase: "inhale" | "exhale" = phaseSec < 4 ? "inhale" : "exhale";

  const pickMed = (m: number) => { setMedMin(m); setMedLeft(m * 60); setMedRun(false); };
  const fmtT = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

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

  // Get the wake-up task (first task) — for 4AM proof binding
  const wakeTask = tasks.find(t => /wake/i.test(t.name)) || tasks[0];

  const completeTaskRpc = async (uuid: string) => {
    const { data, error } = await supabase.rpc("complete_task", { _task_id: uuid });
    if (error) { console.error(error); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) { setCoins(row.coins ?? 0); setStreak(row.streak ?? 0); }
    // mark local task done
    setTasks(p => p.map(t => (t as any)._uuid === uuid ? { ...t, done: true } : t));
    // refresh leaderboard in background
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

  const submitProof = () => {
    if (!proof || proof.mode !== "quiz") return;
    const correct = Number(proof.input) === proof.answer;
    setProof({ ...proof, mode: "result", correct });
    if (correct && wakeTask && !wakeTask.done) {
      completeTaskRpc((wakeTask as any)._uuid);
    }
  };

  const tick = (id: number) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    // 4AM wake task requires proof
    if (/wake/i.test(t.name)) { setProof({ mode: "choose" }); return; }
    completeTaskRpc((t as any)._uuid);
  };



  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;


  // GLOBAL KEYFRAMES
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
            <button onClick={handleSignOut} title="Sign out" style={{ background: "transparent", border: `1px solid ${G}55`, color: "#aaa", padding: "5px 8px", fontSize: 10, letterSpacing: 2, fontFamily: "monospace", cursor: "pointer", borderRadius: 2 }}>EXIT</button>
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
            {board.length === 0 && <div style={{ fontSize: 11, color: "#666", textAlign: "center", padding: 20, letterSpacing: 2 }}>LOADING…</div>}
            {board.map((u, i) => {
              const r = i + 1;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px",
                  background: u.you ? `linear-gradient(90deg, ${G}22, transparent)` : "rgba(0,0,0,0.3)",
                  border: `1px solid ${u.you ? G + "66" : "#222"}`, borderLeft: `3px solid ${u.you ? G : "#333"}`,
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: r <= 3 ? G : "#555", width: 22, textAlign: "center" }}>
                    {r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r}
                  </div>
                  <img src={u.img} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(u.n); }} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${G}44`, objectFit: "cover" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8e8", letterSpacing: 1 }}>{u.you ? "YOU" : u.n}</div>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: 1 }}>{u.s} DAY STREAK</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: G, textShadow: `0 0 8px ${G}66` }}>{u.c}</div>
                </div>
              );
            })}
          </div>}


          {tab === "quotes" && (() => {
            // Daily rotation — quote & person change every single day
            const now = new Date();
            const dayIdx = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
            const today = dayCombo(dayIdx);
            const todayI = rot(dayIdx, 999);
            const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
            const countdown = () => {
              const t = new Date(); t.setHours(24, 0, 0, 0);
              const ms = t.getTime() - Date.now();
              const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
              return `${String(h).padStart(2,"0")}H ${String(m).padStart(2,"0")}M`;
            };
            const upcoming = Array.from({ length: 30 }, (_, k) => ({ ...dayCombo(dayIdx + k + 1), _k: k }));

            const fallback = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0a0a19&color=00ff88&size=400&bold=true&font-size=0.42`;
            return <>
              {/* TODAY'S LEGEND — rotates every 24h */}
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, letterSpacing: 2, color: G }}>
                <span>◉ TODAY · {dateLabel}</span>
                <span style={{ color: "#888" }}>NEXT DROP IN {countdown()}</span>
              </div>
              <div style={{
                position: "relative", marginBottom: 18, borderRadius: 2, overflow: "hidden",
                border: `1px solid ${G}`, borderLeft: `4px solid ${G}`,
                boxShadow: `0 0 40px ${G}55, 0 8px 30px rgba(0,0,0,0.7)`,
                background: "rgba(10,10,25,0.7)", backdropFilter: "blur(10px)",
              }}>
                <div style={{ position: "relative", height: 460, overflow: "hidden", background: "#05050a" }}>
                  <img src={today.img} alt={today.p} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "contrast(1.08) saturate(1.15)" }} onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.dataset.fb) { el.dataset.fb = "1"; el.style.objectFit = "cover"; el.src = fallback(today.p); } }} />
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 55%, rgba(10,10,25,0.97) 100%)`, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: "#000", letterSpacing: 2, padding: "5px 10px", background: G, fontWeight: 800 }}>◉ LEGEND OF THE DAY</div>
                  <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.7)", border: `1px solid ${G}66` }}>#{String(todayI + 1).padStart(3, "0")}</div>
                  <div style={{ position: "absolute", bottom: 12, left: 14, fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>{today.p}</div>
                </div>
                <div style={{ padding: 18, fontSize: 15, color: "#f0f0f0", lineHeight: 1.7, fontStyle: "italic", borderTop: `1px solid ${G}44` }}>
                  <span style={{ color: G, fontSize: 26, marginRight: 4 }}>"</span>
                  {today.q}
                  <span style={{ color: G, fontSize: 26, marginLeft: 4 }}>"</span>
                </div>
              </div>

              <div style={{ fontSize: 10, letterSpacing: 3, color: "#888", marginBottom: 12, fontWeight: 600 }}>▸ ALL LEGENDS · ONE PER DAY</div>
              {upcoming.map((q, k) => (
                <div key={k} style={{
                  position: "relative", marginBottom: 18, borderRadius: 2, overflow: "hidden",
                  border: `1px solid ${G}66`, borderLeft: `4px solid ${G}`,
                  boxShadow: `0 0 25px ${G}33, 0 6px 20px rgba(0,0,0,0.6)`,
                  background: "rgba(10,10,25,0.7)", backdropFilter: "blur(10px)",
                }}>
                  <div style={{ position: "relative", height: 420, overflow: "hidden", background: "#05050a" }}>
                    <img src={q.img} alt={q.p} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "contrast(1.08) saturate(1.15)" }} onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.dataset.fb) { el.dataset.fb = "1"; el.style.objectFit = "cover"; el.src = fallback(q.p); } }} />
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 55%, rgba(10,10,25,0.97) 100%)`, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.75)", border: `1px solid ${G}66`, fontWeight: 800 }}>DAY +{k + 1}</div>
                    <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.7)", border: `1px solid ${G}66` }}>+{k + 1}D</div>
                    <div style={{ position: "absolute", bottom: 12, left: 14, fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>{q.p}</div>
                  </div>
                  <div style={{ padding: 16, fontSize: 14, color: "#f0f0f0", lineHeight: 1.7, fontStyle: "italic", borderTop: `1px solid ${G}44` }}>
                    <span style={{ color: G, fontSize: 24, marginRight: 4 }}>"</span>
                    {q.q}
                    <span style={{ color: G, fontSize: 24, marginLeft: 4 }}>"</span>
                  </div>
                </div>
              ))}
            </>;
          })()}

          {tab === "zen" && <>
            <div style={{ ...CARD, textAlign: "center", padding: "18px 14px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${G}18, transparent 65%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 10, letterSpacing: 5, color: G, marginBottom: 4 }}>◈ COSMIC STILLNESS ◈</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>ZEN PROTOCOL</div>
                <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginTop: 4, marginBottom: 6 }}>BREATHE · RESET · RETURN STRONGER</div>
              </div>
            </div>

            {/* Duration picker */}
            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> SESSION <span style={{ color: G }}>LENGTH</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {[5, 10, 15, 20].map(m => {
                  const active = medMin === m;
                  return (
                    <button key={m} onClick={() => pickMed(m)} disabled={medRun} style={{
                      padding: "14px 4px", cursor: medRun ? "not-allowed" : "pointer",
                      background: active ? `linear-gradient(135deg, ${G}33, ${G2}22)` : "rgba(0,0,0,0.35)",
                      border: `1px solid ${active ? G : "#2a2a3a"}`,
                      borderLeft: `3px solid ${active ? G : "#2a2a3a"}`,
                      color: active ? "#fff" : "#aaa", fontFamily: "monospace",
                      boxShadow: active ? `0 0 14px ${G}55` : "none",
                      opacity: medRun && !active ? 0.4 : 1,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: active ? G : "#ccc", textShadow: active ? `0 0 10px ${G}` : "none" }}>{m}</div>
                      <div style={{ fontSize: 8, letterSpacing: 2, marginTop: 2 }}>MIN</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Breathing orb */}
            <div style={{ ...CARD, padding: "30px 14px 26px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${G}22, transparent 60%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 2, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* rotating rings */}
                <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px dashed ${G}44`, animation: "ringSpin 20s linear infinite" }} />
                <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: `1px solid ${G2}33`, animation: "ringSpin 30s linear infinite reverse" }} />
                {/* orb */}
                <div style={{
                  width: 160, height: 160, borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 35%, ${G}, ${G2} 60%, #0a0a25 100%)`,
                  animation: medRun
                    ? (medPhase === "inhale" ? "breatheIn 4s ease-in-out forwards" : "breatheOut 4s ease-in-out forwards")
                    : "none",
                  transform: medRun ? undefined : "scale(0.75)",
                  boxShadow: `0 0 80px ${G}, 0 0 160px ${G2}66`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: medRun ? undefined : "transform 0.4s ease",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: "0 0 10px #000" }}>
                    {medRun ? medPhase.toUpperCase() : "READY"}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: 4, marginTop: 6, textShadow: `0 0 18px ${G}`, fontVariantNumeric: "tabular-nums" }}>
                {fmtT(medLeft)}
              </div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: G, marginBottom: 14 }}>
                {medRun ? "◉ IN SESSION" : "○ PAUSED"}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setMedRun(r => !r)} style={{
                  padding: "12px 28px", cursor: "pointer",
                  background: `linear-gradient(135deg, ${G}, ${G2})`,
                  border: "none", color: "#000", fontFamily: "monospace",
                  fontSize: 12, fontWeight: 900, letterSpacing: 3,
                  boxShadow: `0 0 20px ${G}88`,
                }}>
                  {medRun ? "❚❚ PAUSE" : "▶ BEGIN"}
                </button>
                <button onClick={() => { setMedRun(false); setMedLeft(medMin * 60); }} style={{
                  padding: "12px 20px", cursor: "pointer",
                  background: "transparent", border: `1px solid ${G}66`,
                  color: G, fontFamily: "monospace",
                  fontSize: 12, fontWeight: 700, letterSpacing: 3,
                }}>
                  ↻ RESET
                </button>
              </div>
            </div>

            {/* Stats + reward */}
            <div style={CARD}>
              <div style={TITLE}><span style={{ color: G }}>▸</span> STILLNESS <span style={{ color: G }}>LEDGER</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ v: medSessions, l: "SESSIONS" }, { v: `${medTotal}m`, l: "TOTAL" }, { v: `+${medMin * 2}`, l: "NEXT REWARD" }].map((s, i) => (
                  <div key={i} style={{ background: `linear-gradient(135deg, ${G}15, transparent)`, border: `1px solid ${G}33`, padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: G, textShadow: `0 0 10px ${G}77` }}>{s.v}</div>
                    <div style={{ fontSize: 8, letterSpacing: 2, color: "#888", marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 12, background: "rgba(0,0,0,0.35)", border: `1px solid ${G}22`, borderLeft: `2px solid ${G}` }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G, marginBottom: 4 }}>◈ THE STILL MIND</div>
                <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5, fontStyle: "italic" }}>
                  "The quieter you become, the more you can hear. In the storm of the world, silence is your superpower."
                </div>
              </div>
            </div>
          </>}

          {tab === "stats" && <div style={CARD}>
            <div style={TITLE}><span style={{ color: G }}>▸</span> WEEKLY <span style={{ color: G }}>PROGRESS</span></div>
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "TDY"].map((d, i) => {
              const v = weekly[i] ?? 0;

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
              const roster = board.length ? board : [{ n: myName.toUpperCase(), c: coins, s: streak, img: fallbackAvatar(myName), you: true }];
              const [top, second, third] = roster;
              if (!top) return null;

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
                { d: 1,   label: "DAY 1 · THE FIRST STEP",     line: "The first step is the heaviest. Most surrender here — but you did not.", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=90" },
                { d: 7,   label: "DAY 7 · IRON WEEK",           line: "One full week. 95% quit before this line. You crossed it in silence.", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=90" },
                { d: 21,  label: "DAY 21 · NEURAL FORGE",       line: "Twenty-one days. Your brain has begun rewiring. The old you is dying.", img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&q=90" },
                { d: 60,  label: "DAY 60 · STEEL SPINE",        line: "Sixty days of war with yourself — and you kept winning every single dawn.", img: "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=1200&q=90" },
                { d: 90,  label: "DAY 90 · IDENTITY SHIFT",     line: "Ninety days. You are no longer trying to change — you have already changed.", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=90" },
                { d: 120, label: "DAY 120 · FORGED IN FIRE",    line: "Four months of fire. What was once impossible is now your ordinary day.", img: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1200&q=90" },
                { d: 170, label: "DAY 170 · UNBREAKABLE",       line: "One hundred seventy sunrises. You cannot be stopped by weakness anymore.", img: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=1200&q=90" },
                { d: 290, label: "DAY 290 · MASTER OF SELF",    line: "Two hundred ninety days. You command yourself where others still beg themselves.", img: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=1200&q=90" },
                { d: 360, label: "DAY 360 · LEGEND STATUS",     line: "One year. You did not build a habit — you became a different human being.", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=90" },
              ].map((v, i) => {
                const done = streak >= v.d;
                const progress = Math.min(100, Math.round((streak / v.d) * 100));
                return (
                  <div key={i} style={{
                    position: "relative", marginBottom: 18, overflow: "hidden", borderRadius: 4,
                    border: `1px solid ${done ? G + "aa" : "#1a1a2a"}`,
                    borderLeft: `4px solid ${done ? G : "#2a2a3a"}`,
                    background: "#0a0a15",
                    boxShadow: done ? `0 8px 32px ${G}33, 0 0 0 1px ${G}22 inset` : "0 4px 16px rgba(0,0,0,0.5)",
                    backdropFilter: "blur(10px)",
                  }}>
                    <div style={{ position: "relative", height: 420, overflow: "hidden" }}>
                      <img src={v.img} alt={v.label} style={{
                        width: "100%", height: "100%", objectFit: "cover", objectPosition: "center",
                        filter: done ? "contrast(1.12) saturate(1.2)" : "grayscale(0.85) brightness(0.45) contrast(1.1)",
                        transition: "all 0.4s ease",
                      }} />
                      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(5,5,15,0.15) 0%, rgba(5,5,15,0.55) 55%, rgba(5,5,15,0.98) 100%)` }} />

                      {/* Top badge */}
                      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{
                          fontSize: 10, fontWeight: 900, letterSpacing: 3, padding: "6px 10px",
                          background: done ? `${G}dd` : "rgba(0,0,0,0.75)",
                          color: done ? "#000" : G,
                          border: `1px solid ${done ? G : G + "44"}`,
                          borderRadius: 2,
                          boxShadow: done ? `0 0 20px ${G}88` : "none",
                        }}>
                          {done ? "◉ CONQUERED" : "◌ LOCKED"}
                        </div>
                        <div style={{
                          fontSize: 28, fontWeight: 900, color: done ? G : "#4a4a5a",
                          textShadow: done ? `0 0 20px ${G}` : "none",
                          letterSpacing: -1, lineHeight: 1,
                        }}>
                          {v.d}<span style={{ fontSize: 11, letterSpacing: 2, marginLeft: 3 }}>D</span>
                        </div>
                      </div>

                      {/* Bottom text block */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 18px 22px" }}>
                        <div style={{
                          fontSize: 11, fontWeight: 900, letterSpacing: 4,
                          color: done ? G : "#888", marginBottom: 10,
                          textShadow: done ? `0 0 12px ${G}88` : "none",
                        }}>
                          {v.label}
                        </div>
                        <div style={{
                          fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.25,
                          letterSpacing: -0.3, marginBottom: 14,
                          textShadow: "0 2px 20px rgba(0,0,0,0.9)",
                        }}>
                          "{v.line}"
                        </div>

                        {/* Progress bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              width: `${progress}%`, height: "100%",
                              background: done ? G : `linear-gradient(90deg, ${G}66, ${G})`,
                              boxShadow: `0 0 8px ${G}`,
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 900, color: done ? G : "#aaa", letterSpacing: 1, minWidth: 60, textAlign: "right" }}>
                            {done ? "100%" : `${Math.max(0, v.d - streak)}D LEFT`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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

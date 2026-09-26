import { FeatureHelpDot } from "@/components/FeatureHelpDot";
import { StreakBadge } from "@/components/StreakBadge";
import { XP_RULES, topMilestone } from "@/lib/economy";
import { useMemo, useState } from "react";
import {
  Brain, CalendarCheck2, Check, ChevronRight, CircleCheck, Coins, Crown,
  Flame, Flower2, Focus, Gift, Hexagon, Leaf, LockKeyhole, Medal, Mountain,
  Palette, Play, ShieldCheck, Sparkles, Target, Trophy, X,
} from "lucide-react";
import type { ThemeKey } from "@/constants/themes";

export const TIERS = [
  { min: 0, max: 500, name: "Beginner", tone: "silver", icon: Leaf },
  { min: 501, max: 1500, name: "Aspirant", tone: "blue", icon: ChevronRight },
  { min: 1501, max: 3000, name: "Disciplined", tone: "purple", icon: Sparkles },
  { min: 3001, max: 5000, name: "Discipline Rising", tone: "lime", icon: Mountain },
  { min: 5001, max: 9000, name: "Mind Master", tone: "purple", icon: Brain },
  { min: 9001, max: 12000, name: "Legend", tone: "orange", icon: Crown },
  { min: 12001, max: null, name: "The Unshakable", tone: "ice", icon: ShieldCheck },
] as const;

export function tierFor(coins: number) {
  const xp = Math.max(0, coins);
  let idx = TIERS.findIndex(t => t.max === null || xp <= t.max);
  if (idx < 0) idx = TIERS.length - 1;
  const cur = TIERS[idx];
  const topBadge = topMilestone(Math.max(streak, bestStreak));
  const next = TIERS[idx + 1];
  const span = cur.max === null ? 1 : Math.max(1, cur.max - cur.min + 1);
  const pct = cur.max === null ? 100 : Math.min(100, Math.round((xp - cur.min) / span * 100));
  return { idx, cur, next, pct };
}

type Panel =
  | { type: "metric"; title: string; copy: string; value: string; progress?: number }
  | { type: "motivation" }
  | { type: "ranks" }
  | { type: "reward"; reward: Reward }
  | { type: "xp"; title: string; copy: string };

type Reward = {
  name: string;
  requirement: number;
  Icon: typeof Coins;
  theme?: ThemeKey;
};

const REWARDS: Reward[] = [
  { name: "5,000 Coins", requirement: 3001, Icon: Coins },
  { name: "Exclusive Theme Unlock", requirement: 5000, Icon: Palette, theme: "aurora" },
  { name: "Weekly tasks +10%", requirement: 7000, Icon: CalendarCheck2 },
  { name: "Premium Theme / Reward", requirement: 10000, Icon: Hexagon, theme: "plasma" },
  { name: "Profile flair", requirement: 15000, Icon: Sparkles },
  { name: "Legend Theme Unlock", requirement: 20000, Icon: Gift, theme: "ignite" },
];

const MOTIVATIONS = [
  ["Discipline is the bridge between your goals and your dreams.", "Keep going, Champion!"],
  ["The future depends on what you do today.", "Build the proof one habit at a time."],
  ["Success is the sum of small efforts, repeated day in and day out.", "Consistency compounds."],
  ["You do not rise to your goals. You fall to your systems.", "Strengthen the system today."],
] as const;

function dailyMotivation() {
  const day = Math.floor(Date.now() / 86400000);
  return MOTIVATIONS[day % MOTIVATIONS.length];
}

export function RankTab({
  coins, streak, bestStreak = 0, name, avatar, todayDone = 0, todayTotal = 0,
  activeTheme, onApplyTheme, onNavigate,
}: {
  coins: number;
  streak: number;
  bestStreak?: number;
  name: string;
  avatar: string;
  todayDone?: number;
  todayTotal?: number;
  activeTheme: ThemeKey;
  onApplyTheme: (theme: ThemeKey) => void;
  onNavigate: (tab: string) => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const { idx, cur, next, pct } = tierFor(coins);
  const completion = todayTotal ? Math.round(todayDone / todayTotal * 100) : 0;
  const level = Math.max(1, Math.floor(coins / 160) + 1);
  const levelXp = coins % 160;
  const [quote, quoteLine] = useMemo(dailyMotivation, []);

  const metricCards = [
    { title: "Current Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, note: "+1 today", Icon: Flame, tone: "lime", copy: `Your current streak is ${streak} days. Your personal best is ${bestStreak} days.`, progress: Math.min(100, streak / Math.max(7, bestStreak) * 100) },
    { title: "Total Coins", value: String(coins), note: "Earn more", Icon: Coins, tone: "lime", copy: `Your live balance is ${coins} coins. Complete habits, goals, focus sessions and meditation to earn more.`, progress: Math.min(100, coins / 20000 * 100) },
    { title: "Completion Rate", value: `${completion}%`, note: `${todayDone}/${todayTotal} today`, Icon: Target, tone: "lime", copy: `You have completed ${todayDone} of ${todayTotal} active habits today.`, progress: completion },
    { title: "Best Rank", value: cur.name, note: `Level ${level}`, Icon: Crown, tone: "lime", copy: `Your real coin balance places you at ${cur.name}. ${next ? `${next.min - coins} more XP reaches ${next.name}.` : "You hold the highest rank."}`, progress: pct },
  ];

  return (
    <section className={`rank-screen rank-theme-${cur.tone} animate-fade-in`}>
      <header className="rank-profile-strip">
        <img src={avatar} alt={name} />
        <div><h1>{name}{topBadge && <span className="ax-name-badge"><StreakBadge tone={topBadge.tone} size={18} label={`${topBadge.days}-day streak badge`} /></span>}</h1><p>Discipline Seeker</p></div>
        <button className="rank-coin-pill" onClick={() => setPanel({ type: "metric", title: "Total Coins", value: `${coins} coins`, copy: "Your coin balance is your live AXEN XP and unlock progress.", progress: Math.min(100, coins / 20000 * 100) })}><Coins size={18} /><strong>{coins} coins</strong><span>＋</span></button>
      </header>

      <button className="rank-main-card" onClick={() => setPanel({ type: "ranks" })}>
        <div className="rank-main-copy"><span>YOUR RANK</span><h2>{cur.name} <ChevronRight /></h2><p>You’re not just trying.<br />You’re becoming.</p></div>
        <div className="rank-mountain"><i /><Mountain size={48} /></div>
        <div className="rank-level-row"><strong>Level {level}</strong><span>{levelXp} / 160 XP</span></div>
        <div className="rank-progress"><i style={{ width: `${levelXp / 160 * 100}%` }} /></div>
      </button>

      <div className="rank-metrics">{metricCards.map(card => <button key={card.title} className="rank-metric" onClick={() => setPanel({ type: "metric", title: card.title, value: card.value, copy: card.copy, progress: card.progress })}><span><card.Icon size={22} /></span><div><small>{card.title}</small><strong>{card.value}</strong><em>{card.note} <ChevronRight size={12} /></em></div></button>)}</div>

      <button className="rank-motivation" onClick={() => setPanel({ type: "motivation" })}><div className="rank-motivation-mark"><Mountain /><i /></div><blockquote>“{quote}”<span>— {quoteLine}</span></blockquote><b><Play size={12} fill="currentColor" /> Daily Motivation <ChevronRight size={14} /></b></button>

      <article className="rank-section rank-progression">
        <header><div><Crown size={20} /><span><strong>Rank Progress</strong><small>Climb higher. Unlock greater rewards.</small></span></div><button onClick={() => setPanel({ type: "ranks" })}>View All Ranks <ChevronRight size={13} /></button></header>
        <div className="rank-tier-row">{TIERS.map((tier, index) => { const Icon = tier.icon; const unlocked = coins >= tier.min; return <button key={tier.name} className={`rank-tier rank-tone-${tier.tone} ${index === idx ? "is-current" : ""} ${unlocked ? "is-unlocked" : "is-locked"}`} onClick={() => setPanel({ type: "ranks" })}><span><Icon size={22} /></span><strong>{tier.name}</strong><small>{tier.min} – {tier.max ?? "∞"} XP</small>{index === idx && <em>Current</em>}</button>; })}</div>
      </article>

      <article className="rank-section rank-rewards">
        <header><div><Medal size={20} /><span><strong>Current Rank Rewards</strong><small>{cur.name} Rewards</small></span></div></header>
        <div className="rank-reward-row">{REWARDS.map(reward => { const unlocked = coins >= reward.requirement; const applied = reward.theme === activeTheme; return <button key={reward.name} className={`${unlocked ? "is-unlocked" : "is-locked"} ${applied ? "is-applied" : ""}`} onClick={() => setPanel({ type: "reward", reward })}><span>{unlocked ? <reward.Icon size={21} /> : <LockKeyhole size={18} />}</span><strong>{reward.name}</strong><small>{applied ? "Applied" : unlocked ? "Unlocked" : "Locked"}</small></button>; })}</div>
      </article>

      <article className="rank-section rank-earn">
        <header><div><Hexagon size={20} /><span><strong>How to Earn XP & Climb Ranks</strong></span></div><FeatureHelpDot label="XP" content={{ title: "What is XP?", lines: ["XP is your discipline score. It decides your rank and leaderboard place.", ...XP_RULES.map(rule => `${rule.title} ${rule.xp}`), "Verified actions count most. XP can never be bought."], question: "Explain XP and how I climb ranks fastest." }} /></header>
        <div>{[
          { title: "Complete Habits", xp: "+10 XP", Icon: CircleCheck, tab: "home", copy: "Complete your active habits from Home." },
          { title: "Use Focus Mode", xp: "+15 XP", Icon: Focus, tab: "home", copy: "Finish a Deep Focus session from Home." },
          { title: "Achieve Goals", xp: "+20 XP", Icon: Target, tab: "profile", copy: "Create and complete a goal from You." },
          { title: "Meditate", xp: "+10 XP", Icon: Flower2, tab: "zen", copy: "Complete a meditation session in Zen." },
          { title: "Stay Consistent", xp: "+5 XP daily", Icon: CalendarCheck2, tab: "stats", copy: "Keep your weekly consistency active." },
          { title: "Unlock Achievements", xp: "+25 XP", Icon: Trophy, tab: "profile", copy: "Reach streak milestones and achievements." },
        ].map(item => <button key={item.title} onClick={() => onNavigate(item.tab)} aria-label={`${item.title}: ${item.copy}`}><item.Icon size={18} /><span><strong>{item.title}</strong><small>{item.xp}</small></span><ChevronRight size={15} /></button>)}</div>
      </article>

      {panel && <RankSheet panel={panel} coins={coins} tiers={TIERS} activeTheme={activeTheme} onApplyTheme={theme => { onApplyTheme(theme); setPanel(null); }} onClose={() => setPanel(null)} quote={quote} quoteLine={quoteLine} />}
    </section>
  );
}

function RankSheet({ panel, coins, tiers, activeTheme, onApplyTheme, onClose, quote, quoteLine }: { panel: Panel; coins: number; tiers: typeof TIERS; activeTheme: ThemeKey; onApplyTheme: (theme: ThemeKey) => void; onClose: () => void; quote: string; quoteLine: string }) {
  const reward = panel.type === "reward" ? panel.reward : null;
  const unlocked = reward ? coins >= reward.requirement : false;
  return <div className="rank-sheet-backdrop" onClick={onClose}><section className="rank-sheet" onClick={event => event.stopPropagation()}><div className="rank-sheet-handle" /><button className="rank-sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
    {panel.type === "motivation" && <><Sparkles className="rank-sheet-hero-icon" /><small>DAILY MOTIVATION</small><h2>“{quote}”</h2><p>{quoteLine}</p></>}
    {panel.type === "metric" && <><Target className="rank-sheet-hero-icon" /><small>LIVE AXEN DATA</small><h2>{panel.title}</h2><strong className="rank-sheet-value">{panel.value}</strong><p>{panel.copy}</p>{typeof panel.progress === "number" && <div className="rank-sheet-progress"><i style={{ width: `${Math.max(0, Math.min(100, panel.progress))}%` }} /></div>}</>}
    {panel.type === "xp" && <><Trophy className="rank-sheet-hero-icon" /><small>EARN XP</small><h2>{panel.title}</h2><p>{panel.copy}</p></>}
    {panel.type === "reward" && reward && <><reward.Icon className="rank-sheet-hero-icon" /><small>{unlocked ? "UNLOCKED" : "LOCKED"}</small><h2>{reward.name}</h2><p>{unlocked ? "This reward is unlocked by your real coin balance." : `${reward.requirement.toLocaleString()} coins required. You currently have ${coins.toLocaleString()} coins.`}</p><div className="rank-sheet-progress"><i style={{ width: `${Math.min(100, coins / reward.requirement * 100)}%` }} /></div><b>{coins.toLocaleString()} / {reward.requirement.toLocaleString()} coins</b>{reward.theme && unlocked && <button className="rank-sheet-action" onClick={() => onApplyTheme(reward.theme as ThemeKey)}>{activeTheme === reward.theme ? <><Check size={17} /> Applied</> : <>Apply theme <ChevronRight size={17} /></>}</button>}</>}
    {panel.type === "ranks" && <><Crown className="rank-sheet-hero-icon" /><small>COMPLETE PROGRESSION</small><h2>All Ranks</h2><div className="rank-sheet-ranks">{tiers.map(tier => { const reached = coins >= tier.min; return <div key={tier.name} className={reached ? "is-unlocked" : "is-locked"}><span>{reached ? <Check size={15} /> : <LockKeyhole size={14} />}</span><p><strong>{tier.name}</strong><small>{tier.min.toLocaleString()} – {tier.max?.toLocaleString() ?? "∞"} XP</small></p><em>{reached ? "Unlocked" : `${Math.max(0, tier.min - coins).toLocaleString()} XP left`}</em></div>; })}</div></>}
  </section></div>;
}
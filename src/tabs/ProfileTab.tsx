import { useState } from "react";
import {
  Award, BarChart3, Bell, Camera, CheckCircle2, ChevronRight, Coins, Crown,
  Circle, Flame, HeartHandshake, LogOut, Orbit, Settings, Sparkles, Target, Trophy,
} from "lucide-react";
import { ManageSubscriptionCard } from "@/components/ManageSubscriptionCard";
import { SubscriptionTimeline } from "@/components/SubscriptionTimeline";
import { ReferralCard } from "@/components/ReferralCard";
import { AccountabilitySection } from "@/components/verified/AccountabilitySection";
import { useCountUp } from "./HomeTab";
import {
  AchievementsView, GoalsView, HabitsView, JourneyView, RemindersView,
  type ProfileHabit, type ProfileLife, type ProfileView,
} from "./ProfileDetailScreens";

type Props = {
  coins: number; streak: number; myName: string; myAvatar: string; uploading: boolean;
  openCropper: (file: File) => void; fallbackAvatar: (name: string) => string;
  todayDone?: number; todayTotal?: number; weekly: number[]; life?: ProfileLife;
  habits: ProfileHabit[]; userId: string | null;
  onCompleteHabit: (uuid: string) => Promise<void>; onRefresh: () => Promise<void>;
  onOpenStats: () => void; onSignOut?: () => void; referredBy?: string | null;
  onCoins?: (coins: number) => void;
};

const RANKS = [
  { name: "Discipline Seeker", min: 0 }, { name: "Discipline Rising", min: 100 },
  { name: "Iron Mind", min: 300 }, { name: "Unbreakable", min: 700 },
  { name: "Discipline Master", min: 1500 },
];

export function ProfileTab(props: Props) {
  const [view, setView] = useState<ProfileView>("dashboard");
  const done = props.todayDone ?? 0;
  const total = props.todayTotal ?? 0;
  const completion = total ? Math.round(done / total * 100) : 0;
  const coinsShown = useCountUp(props.coins);
  const streakShown = useCountUp(props.streak);
  const rankIndex = Math.max(0, RANKS.reduce((found, item, index) => props.coins >= item.min ? index : found, 0));
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1];
  const level = Math.max(1, Math.floor(props.coins / 160) + 1);
  const levelProgress = props.coins % 160;
  const weekActive = props.weekly.filter(value => value > 0).length;
  const weeklyAverage = props.weekly.length ? Math.round(props.weekly.reduce((sum, value) => sum + value, 0) / props.weekly.length) : 0;
  const back = () => setView("dashboard");

  if (view === "habits") return <HabitsView habits={props.habits} userId={props.userId} onBack={back} onComplete={props.onCompleteHabit} onChanged={props.onRefresh} />;
  if (view === "journey") return <JourneyView life={props.life} streak={props.streak} onBack={back} />;
  if (view === "achievements") return <AchievementsView bestStreak={props.life?.bestStreak ?? props.streak} onBack={back} />;
  if (view === "goals") return <GoalsView userId={props.userId} habits={props.habits} onBack={back} onChanged={props.onRefresh} />;
  if (view === "reminders") return <RemindersView habits={props.habits} userId={props.userId} onBack={back} />;
  if (view === "account") return <div className="you-detail animate-fade-in"><header className="you-detail-header"><button className="you-icon-button" onClick={back} aria-label="Back to profile">←</button><div><h1>Account</h1><p>Identity, membership and invitations.</p></div></header><ReferralCard referredBy={props.referredBy ?? null} onCoins={props.onCoins} /><ManageSubscriptionCard /><SubscriptionTimeline />{props.onSignOut && <button className="you-signout" onClick={props.onSignOut}><LogOut size={17} /> Sign out</button>}</div>;
  if ((view as string) === "accountability") return <div className="you-detail animate-fade-in"><header className="you-detail-header"><button className="you-icon-button" onClick={back} aria-label="Back to profile">←</button><div><h1>Accountability</h1><p>One partner. Only what you choose to share.</p></div></header><AccountabilitySection /></div>;

  const features = [
    { id: "journey", title: "My Journey", copy: "Track your progress", icon: Orbit, tone: "blue" },
    { id: "achievements", title: "Achievements", copy: "Unlock rewards", icon: Trophy, tone: "gold" },
    { id: "stats", title: "Statistics", copy: "See your insights", icon: BarChart3, tone: "cyan" },
    { id: "goals", title: "Goals", copy: "Set & track goals", icon: Target, tone: "pink" },
    { id: "habits", title: "Habits", copy: "Build better habits", icon: CheckCircle2, tone: "green" },
    { id: "reminders", title: "Reminders", copy: "Stay on track", icon: Bell, tone: "violet" },
    { id: "accountability", title: "Accountability", copy: "Partner & privacy", icon: HeartHandshake, tone: "violet" },
  ] as const;

  return <section className="you-screen animate-fade-in">
    <header className="you-profile-hero">
      <label className="you-avatar" aria-label="Change profile photo"><img src={props.myAvatar || props.fallbackAvatar(props.myName)} onError={event => { event.currentTarget.src = props.fallbackAvatar(props.myName); }} alt={props.myName} /><span><Camera size={14} /></span><input type="file" accept="image/*" disabled={props.uploading} onChange={event => { const file = event.target.files?.[0]; if (file) props.openCropper(file); event.currentTarget.value = ""; }} /></label>
      <div className="you-profile-copy"><h1>{props.myName}</h1><div><Crown size={15} /><strong>{rank.name}</strong><span className="you-verified">✓</span></div><p>Better Habits <b>·</b> Stronger Mind <b>·</b> Greater You</p></div>
      <button className="you-account-button" onClick={() => setView("account")} aria-label="Open account settings"><Settings size={18} /></button>
      <div className="you-coin-pill"><Coins size={18} /><strong>{coinsShown} coins</strong></div>
    </header>

    <article className="you-rank-card">
      <div className="you-rank-emblem"><Crown size={36} /><i /></div>
      <div className="you-rank-copy"><span>Your Rank</span><h2>{rank.name}</h2><p>{nextRank ? `${nextRank.min - props.coins} coins to ${nextRank.name}` : "You reached the highest rank."}</p></div>
      <div className="you-rank-level"><strong>Level {level}</strong><ProgressBar value={levelProgress / 160 * 100} /><span>{levelProgress} / 160 XP</span></div>
    </article>

    <div className="you-kpis">
      <Metric icon={<Flame />} title="Current Streak" value={`${streakShown}`} unit="day" tone="pink" />
      <Metric icon={<Coins />} title="Total Coins" value={`${coinsShown}`} unit="earned" tone="gold" />
      <Metric icon={<Target />} title="Completion Rate" value={`${completion}%`} unit={`${done}/${total} today`} tone="cyan" />
      <Metric icon={<Crown />} title="Best Rank" value={rank.name} unit={`Top ${Math.max(1, 100 - Math.min(99, props.life?.bestStreak ?? 0))}%`} tone="violet" />
    </div>

    <button className="you-motivation" onClick={() => setView("journey")}><Sparkles size={23} /><blockquote>“Discipline is the bridge between your goals and your dreams.”<span>— Keep going, Champion!</span></blockquote><b>Daily Motivation</b><ChevronRight size={18} /></button>

    <div className="you-feature-grid">{features.map(item => {
      const Icon = item.icon;
      return <button key={item.id} className={`you-feature-card you-tone-${item.tone}`} onClick={() => item.id === "stats" ? props.onOpenStats() : setView(item.id)}><span><Icon size={25} /></span><div><strong>{item.title}</strong><small>{item.copy}</small></div><ChevronRight size={18} /></button>;
    })}</div>

    <article className="you-week-card">
      <div className="you-week-heading"><div><h2>This Week</h2><p>Your consistency matters</p></div><button onClick={props.onOpenStats}>View Details <ChevronRight size={14} /></button></div>
      <div className="you-week-content"><div className="you-week-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <div key={day}><i className={props.weekly[index] > 0 ? "is-active" : ""}>{props.weekly[index] >= 100 ? <CheckCircle2 size={18} /> : <Circle size={13} />}</i><span>{day}</span></div>)}</div><div className="you-week-summary"><b>{weeklyAverage}%</b><span>Weekly<br />Consistency</span><small>{weekActive}/7 days</small></div></div>
    </article>
    <button className="you-closing-banner" onClick={() => setView("habits")}><Award size={23} /><div><strong>Discipline Today = Freedom Tomorrow</strong><span>Keep going. Your future self is watching.</span></div><ChevronRight size={18} /></button>
  </section>;
}

function ProgressBar({ value }: { value: number }) { return <div className="you-rank-progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }
function Metric({ icon, title, value, unit, tone }: { icon: React.ReactNode; title: string; value: string; unit: string; tone: string }) {
  return <article className={`you-metric you-tone-${tone}`}><span>{icon}</span><small>{title}</small><strong>{value}</strong><em>{unit}</em></article>;
}
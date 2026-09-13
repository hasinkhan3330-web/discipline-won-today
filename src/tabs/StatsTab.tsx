import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Flower2,
  Leaf,
  Medal,
  Star,
  Target,
  TimerReset,
} from "lucide-react";

export type LifeStats = {
  bestStreak: number;
  lifetimeCoins: number;
  heat: { date: string; count: number }[];
  topTask: { icon: string; name: string; count: number } | null;
  medMinutes: number;
  focusMinutes?: number;
  taskTotal?: number;
};

type StatsTabProps = {
  weekly: number[];
  life?: LifeStats;
  coins: number;
  streak: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function smoothPath(values: number[], width: number, height: number, pad = 8) {
  const safe = values.length === 7 ? values.map(clamp) : Array.from({ length: 7 }, (_, index) => clamp(values[index] ?? 0));
  const points = safe.map((value, index) => ({
    x: pad + index * ((width - pad * 2) / 6),
    y: pad + (100 - value) * ((height - pad * 2) / 100),
  }));
  if (points.length < 2) return { line: "", area: "", points };
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const after = points[index + 2] ?? next;
    const firstX = current.x + (next.x - previous.x) / 6;
    const firstY = current.y + (next.y - previous.y) / 6;
    const secondX = next.x - (after.x - current.x) / 6;
    const secondY = next.y - (after.y - current.y) / 6;
    line += ` C ${firstX} ${firstY}, ${secondX} ${secondY}, ${next.x} ${next.y}`;
  }
  return {
    line,
    area: `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`,
    points,
  };
}

function IconTile({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "gold" }) {
  return <span className={`stats-icon stats-icon--${tone}`}>{children}</span>;
}

function WeeklyChart({ values }: { values: number[] }) {
  const { line, area, points } = smoothPath(values, 310, 128, 8);
  return (
    <div className="stats-chart" aria-label="Weekly habit completion chart">
      <div className="stats-chart__scale" aria-hidden="true">
        <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
      </div>
      <div className="stats-chart__plot">
        <svg viewBox="0 0 310 128" role="img" aria-label={`Weekly completion percentages: ${values.map(clamp).join(", ")}`}>
          <defs>
            <linearGradient id="statsArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--stats-violet)" stopOpacity=".48" />
              <stop offset="100%" stopColor="var(--stats-violet)" stopOpacity=".03" />
            </linearGradient>
            <filter id="statsGlow" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {[0, 32, 64, 96, 128].map(y => <line key={y} x1="0" x2="310" y1={y} y2={y} className="stats-chart__grid" />)}
          {points.map(point => <line key={point.x} x1={point.x} x2={point.x} y1="0" y2="128" className="stats-chart__grid stats-chart__grid--vertical" />)}
          <path d={area} fill="url(#statsArea)" className="stats-chart__area" />
          <path d={line} className="stats-chart__line" filter="url(#statsGlow)" />
          {points.map((point, index) => (
            <g key={point.x} className="stats-chart__point" style={{ animationDelay: `${index * 70}ms` }}>
              <circle cx={point.x} cy={point.y} r="7" className="stats-chart__point-glow" />
              <circle cx={point.x} cy={point.y} r="3.25" className="stats-chart__point-core" />
            </g>
          ))}
        </svg>
        <div className="stats-chart__days">{DAYS.map(day => <span key={day}>{day}</span>)}</div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const rating = score >= 85 ? "Excellent" : score >= 65 ? "Strong" : score >= 40 ? "Building" : "Start today";
  return (
    <div className="stats-score">
      <div className="stats-score__ring">
        <svg viewBox="0 0 112 112" aria-hidden="true">
          <circle cx="56" cy="56" r={radius} className="stats-score__track" />
          <circle cx="56" cy="56" r={radius} className="stats-score__progress" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
        </svg>
        <div className="stats-score__copy">
          <Crown size={17} />
          <span>Discipline Score</span>
          <strong>{score}<small>%</small></strong>
          <em>{rating}</em>
        </div>
      </div>
      <p>{score >= 60 ? "You're on the right path.\nKeep going!" : "Every strong streak\nstarts with one day."}</p>
    </div>
  );
}

function KpiCard({ icon, label, value, unit, gold = false }: { icon: React.ReactNode; label: string; value: string; unit: string; gold?: boolean }) {
  return (
    <article className="stats-kpi">
      <div className="stats-kpi__top">
        <IconTile tone={gold ? "gold" : "violet"}>{icon}</IconTile>
        <span>{label}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  );
}

function ProgressRow({ icon, label, detail, value, delta }: { icon: React.ReactNode; label: string; detail: string; value: number; delta?: string }) {
  return (
    <div className="stats-progress-row">
      <span className="stats-progress-row__icon">{icon}</span>
      <div className="stats-progress-row__content">
        <div className="stats-progress-row__meta">
          <span>{label}</span>
          <span>{detail}</span>
          <b className={delta ? "stats-progress-row__delta" : ""}>{delta ?? `${clamp(value)}%`}</b>
        </div>
        <div className="stats-progress-row__track"><i style={{ width: `${clamp(value)}%` }} /></div>
      </div>
    </div>
  );
}

export function StatsTab({ weekly, life, coins, streak }: StatsTabProps) {
  const values = Array.from({ length: 7 }, (_, index) => clamp(weekly[index] ?? 0));
  const activeDays = values.filter(value => value > 0).length;
  const completedDays = values.filter(value => value >= 100).length;
  const score = clamp(values.reduce((sum, value) => sum + value, 0) / values.length);
  const focusMinutes = Math.max(0, life?.focusMinutes ?? 0);
  const focusTarget = 300;
  const focusPercent = clamp((focusMinutes / focusTarget) * 100);
  const meditationPercent = clamp((Math.min(activeDays, 7) / 7) * 100);
  const mindfulPercent = clamp((completedDays / 5) * 100);
  const focusHours = `${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m`;
  const milestoneDays = [3, 7, 14, 30];

  return (
    <section className="stats-screen">
      <header className="stats-header">
        <div><h1>Stats</h1><p>Discipline builds the life you want.</p></div>
        <div className="stats-coin-pill"><IconTile tone="gold"><Coins size={16} /></IconTile><strong>{coins} coins</strong></div>
      </header>

      <article className="stats-card stats-performance">
        <div className="stats-performance__chart">
          <div className="stats-section-title"><IconTile><BarChart3 size={17} /></IconTile><h2>Weekly Performance</h2></div>
          <WeeklyChart values={values} />
        </div>
        <ScoreRing score={score} />
      </article>

      <div className="stats-kpi-grid">
        <KpiCard icon={<Flame size={19} />} label="Current Streak" value={`${streak}`} unit="days" />
        <KpiCard icon={<Coins size={19} />} label="Lifetime Coins" value={`${life?.lifetimeCoins ?? 0}`} unit="coins" gold />
        <KpiCard icon={<Flower2 size={19} />} label="Meditation" value={`${life?.medMinutes ?? 0}m`} unit="stillness" />
      </div>

      <article className="stats-card stats-week">
        <div className="stats-card-heading">
          <div className="stats-section-title"><IconTile><CalendarDays size={18} /></IconTile><div><h2>This Week</h2><p>Daily consistency</p></div></div>
          <div className="stats-mini-pill"><Check size={13} /><strong>{activeDays}/7</strong>&nbsp;days<ChevronRight size={14} /></div>
        </div>
        <div className="stats-days">
          {DAYS.map((day, index) => (
            <div className="stats-day" key={day}>
              <span>{day}</span>
              <div><i style={{ opacity: values[index] > 0 ? Math.max(.42, values[index] / 100) : .14, transform: `scale(${.65 + values[index] * .0035})` }} /></div>
            </div>
          ))}
        </div>
      </article>

      <article className="stats-card stats-focus">
        <div className="stats-card-heading">
          <div className="stats-section-title"><IconTile><Target size={19} /></IconTile><div><h2>Focus &amp; Discipline</h2><p>Track your progress</p></div></div>
          <div className="stats-mini-pill"><CalendarDays size={14} />This Week<ChevronRight size={14} /></div>
        </div>
        <div className="stats-progress-list">
          <ProgressRow icon={<Flower2 />} label="Meditation Consistency" detail={`${activeDays}/7 days`} value={meditationPercent} />
          <ProgressRow icon={<TimerReset />} label="Focus Time" detail={`${focusHours} / 5h`} value={focusPercent} />
          <ProgressRow icon={<Leaf />} label="Mindful Habits" detail={`${completedDays}/5`} value={mindfulPercent} />
          <ProgressRow icon={<Star />} label="Discipline Score" detail={`${score}%`} value={score} delta={score > 0 ? `+${Math.max(1, score - Math.round(values.slice(0, 6).reduce((sum, value) => sum + value, 0) / 6))}% ▲` : "0%"} />
        </div>
        <div className="stats-milestones">
          <div className="stats-milestones__title"><Medal size={20} /><div><strong>Streak Milestones</strong><span>Small steps. Big changes.</span></div></div>
          <div className="stats-milestones__steps">
            {milestoneDays.map(days => <div key={days} className={streak >= days ? "is-reached" : ""}><strong>{days}</strong><span>{days} days</span></div>)}
          </div>
        </div>
      </article>
    </section>
  );
}
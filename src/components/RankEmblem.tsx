import {
  Anvil, BrainCircuit, Castle, Gem, Hourglass, Mountain, Rocket, Shield, Sprout,
  type LucideIcon,
} from "lucide-react";

/** One rank icon system. Glyph + tier detail come from the rank name; colour comes from state only. */
type RankDef = { glyph: LucideIcon; tier: number };

// Every rank name found in the app data (Rank tab TIERS + You page RANKS).
export const RANK_GLYPHS: Record<string, RankDef> = {
  "beginner": { glyph: Sprout, tier: 1 },
  "aspirant": { glyph: Rocket, tier: 2 },
  "disciplined": { glyph: Hourglass, tier: 3 },
  "discipline rising": { glyph: Mountain, tier: 4 },
  "mind master": { glyph: BrainCircuit, tier: 5 },
  "legend": { glyph: Gem, tier: 6 },
  "the unshakable": { glyph: Castle, tier: 7 },
  // You page progression
  "discipline seeker": { glyph: Sprout, tier: 1 },
  "iron mind": { glyph: Anvil, tier: 3 },
  "discipline master": { glyph: BrainCircuit, tier: 5 },
  "unbreakable": { glyph: Castle, tier: 7 },
};

export function rankDef(name: string): RankDef & { known: boolean } {
  const def = RANK_GLYPHS[name.trim().toLowerCase()];
  return def ? { ...def, known: true } : { glyph: Shield, tier: 1, known: false };
}

export function RankGlyph({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const { glyph: Glyph } = rankDef(name);
  return <Glyph size={size} strokeWidth={1.75} strokeLinecap="round" className={className} aria-hidden />;
}

const SIZES = { sm: 28, md: 56, lg: 96 } as const;
const OUTER = "25,4 75,4 98,50 75,96 25,96 2,50";
const INNER = "29,12 71,12 90,50 71,88 29,88 10,50";
const TICKS = ["M18 14 L23 9", "M82 14 L77 9", "M82 86 L77 91", "M18 86 L23 91"];

export function RankEmblem({ name, size = "md", state = "reached", className = "" }: {
  name: string;
  size?: keyof typeof SIZES;
  state?: "reached" | "current" | "locked";
  className?: string;
}) {
  const px = SIZES[size];
  const { glyph: Glyph, tier } = rankDef(name);
  return (
    <span className={`rank-emblem rank-emblem--${size} is-${state} ${className}`} style={{ width: px, height: px }} role="img" aria-label={`${name} rank emblem`}>
      <svg viewBox="0 0 100 100" width={px} height={px} aria-hidden className="rank-emblem__plate">
        <polygon className="rank-emblem__fill" points={OUTER} />
        {tier >= 3 && <polygon className="rank-emblem__inner" points={INNER} />}
        {tier >= 5 && TICKS.map(d => <path key={d} className="rank-emblem__tick" d={d} />)}
      </svg>
      <Glyph className="rank-emblem__glyph" size={Math.round(px * 0.44)} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden />
    </span>
  );
}

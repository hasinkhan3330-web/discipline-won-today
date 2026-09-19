import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Crown, Globe2, Loader2, RefreshCw, ShieldAlert, Sparkles, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeName } from "@/lib/display-name";

type Scope = "india" | "global";
type Period = "weekly" | "alltime";

type Row = {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  country: string;
  points: number;
  consistency: number;
  elite: boolean;
  is_me: boolean;
};

type Position = {
  rank: number;
  total: number;
  percentile: number;
  points: number;
  consistency: number;
  country: string;
  elite: boolean;
  next_milestone: number;
  points_to_next: number;
  in_top100: boolean;
};

const COUNTRIES = [
  ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"],
  ["AU", "Australia"], ["AE", "UAE"], ["DE", "Germany"], ["FR", "France"], ["BR", "Brazil"],
  ["NG", "Nigeria"], ["PK", "Pakistan"], ["BD", "Bangladesh"], ["ID", "Indonesia"],
  ["PH", "Philippines"], ["JP", "Japan"], ["ZA", "South Africa"], ["SG", "Singapore"],
] as const;

function flag(cc: string) {
  const code = (cc || "IN").toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
}

const fallbackAvatar = (n: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(n || "A")}&background=091221&color=20E7F2&size=160&bold=true`;

function EliteCrest({ size = 16 }: { size?: number }) {
  return (
    <span className="lb-crest" title="AXEN ELITE" aria-label="AXEN Elite" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path d="M12 2l7 3.2v5.6c0 4.6-2.9 8.6-7 11.2-4.1-2.6-7-6.6-7-11.2V5.2L12 2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8.2 11.4l2.6 2.7 5-5.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Leaderboard({ myId }: {
  myId: string;
  myName: string;
  onEditPhoto?: (file: File) => void;
  onRemovePhoto?: () => void;
  uploading?: boolean;
}) {
  const reduce = useReducedMotion();
  const [scope, setScope] = useState<Scope>("india");
  const [period, setPeriod] = useState<Period>("weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<Position | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rankUp, setRankUp] = useState<number | null>(null);
  const prevRank = useRef<number | null>(null);
  const podiumRef = useRef<HTMLDivElement | null>(null);
  const podiumFrameRef = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    const [top, pos] = await Promise.all([
      supabase.rpc("leaderboard_top" as never, { _scope: scope, _period: period, _limit: 100, _offset: 0 } as never),
      supabase.rpc("my_leaderboard_position" as never, { _scope: scope, _period: period } as never),
    ]);
    if (top.error || pos.error) { setState("error"); return; }
    const list = ((top.data ?? []) as unknown as Row[]).map(r => ({ ...r, username: safeName(r.username) }));
    const position = ((pos.data ?? []) as unknown as Position[])[0] ?? null;
    setRows(list);
    setMe(position);
    setState("ready");
    if (position && position.rank > 0) {
      const before = prevRank.current;
      if (before !== null && position.rank < before) setRankUp(position.rank);
      prevRank.current = position.rank;
    }
  }, [scope, period, myId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (rankUp === null) return;
    const t = window.setTimeout(() => setRankUp(null), 2600);
    return () => window.clearTimeout(t);
  }, [rankUp]);

  const podium = useMemo(() => rows.filter(r => r.rank <= 3).slice(0, 3), [rows]);
  const list = useMemo(() => rows.filter(r => r.rank >= 4 && r.rank <= 100), [rows]);

  const order = [1, 0, 2]; // visual podium order: 2nd, 1st, 3rd

  const updatePodiumDepth = useCallback(() => {
    const track = podiumRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    track.querySelectorAll<HTMLElement>(".lb-pod").forEach(card => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.max(-1, Math.min(1, (cardCenter - center) / Math.max(card.offsetWidth, 1)));
      card.style.setProperty("--swipe-depth", String(Math.abs(distance)));
      card.style.setProperty("--swipe-shift", String(distance));
    });
  }, []);

  const handlePodiumScroll = useCallback(() => {
    if (reduce || podiumFrameRef.current !== null) return;
    podiumFrameRef.current = requestAnimationFrame(() => {
      podiumFrameRef.current = null;
      updatePodiumDepth();
    });
  }, [reduce, updatePodiumDepth]);

  useEffect(() => {
    const track = podiumRef.current;
    if (!track || podium.length === 0) return;
    const champion = track.querySelector<HTMLElement>(".lb-pod-1");
    if (champion) track.scrollLeft = champion.offsetLeft - (track.clientWidth - champion.offsetWidth) / 2;
    updatePodiumDepth();
    return () => {
      if (podiumFrameRef.current !== null) cancelAnimationFrame(podiumFrameRef.current);
      podiumFrameRef.current = null;
    };
  }, [podium, updatePodiumDepth]);

  return (
    <section className="lb">
      <header className="lb-head">
        <div className="lb-head__mark"><Trophy size={18} /></div>
        <div className="lb-head__copy">
          <span>AXEN // RANKING NETWORK</span>
          <h2>LEADERBOARD</h2>
          <p>Discipline Points · earned, never bought</p>
        </div>
        <button className="lb-refresh" onClick={() => void load()} aria-label="Refresh leaderboard">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="lb-tabs" role="tablist" aria-label="Region">
        {(["india", "global"] as Scope[]).map(s => (
          <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? "is-on" : ""} onClick={() => setScope(s)}>
            <span className="lb-tab-icon">{s === "india" ? "🇮🇳" : <Globe2 size={15} />}</span>
            <span>{s === "india" ? "INDIA" : "GLOBAL"}</span>
            <i aria-hidden />
          </button>
        ))}
      </div>

      <div className="lb-filters" role="tablist" aria-label="Period">
        {(["weekly", "alltime"] as Period[]).map(p => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? "is-on" : ""} onClick={() => setPeriod(p)}>
            {p === "weekly" ? "WEEKLY" : "ALL-TIME"}
          </button>
        ))}
      </div>

      <div className="lb-arena-label" aria-hidden>
        <span>TOP 100 // LIVE STANDINGS</span><i /><Zap size={12} />
      </div>

      {state === "loading" && (
        <div className="lb-state"><Loader2 className="lb-spin" size={20} /> Loading rankings…</div>
      )}

      {state === "error" && (
        <div className="lb-state lb-error">
          <ShieldAlert size={20} /> Rankings could not load.
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        <div className="lb-state">
          <Sparkles size={20} /> No ranked members yet this {period === "weekly" ? "week" : "season"}.
          <span>Complete a habit to put yourself on the board.</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === "ready" && rows.length > 0 && (
          <motion.div
            key={`${scope}-${period}`}
            className="lb-standings"
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -8 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            {podium.length > 0 && (
              <div ref={podiumRef} className="lb-podium" onScroll={handlePodiumScroll} aria-label="Top ranked members. Swipe left or right.">
                {order.map(i => podium[i]).filter(Boolean).map(p => (
                  <motion.div
                    key={p.user_id}
                    className={`lb-pod lb-pod-${p.rank} ${p.is_me ? "is-me" : ""}`}
                    initial={reduce ? false : { opacity: 0, y: 18, scale: .96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 240, damping: 20, delay: reduce ? 0 : p.rank * 0.06 }}
                  >
                    <div className="lb-pod-orbit" aria-hidden><i /><i /><i /></div>
                    <div className="lb-pod-rank">0{p.rank}</div>
                    <div className="lb-pod-avatar">
                      <img src={p.avatar_url || fallbackAvatar(p.username)} alt={p.username} loading="lazy" />
                      {p.rank === 1 && <Crown size={19} className="lb-pod-crown" />}
                    </div>
                    <strong>{p.username}</strong>
                    <span>{flag(p.country)} {p.elite && <EliteCrest size={13} />}</span>
                    <em><b>{p.points.toLocaleString()}</b> DP</em>
                    <div className="lb-pod-base"><i /><span /></div>
                  </motion.div>
                ))}
              </div>
            )}

            {list.length > 0 && (
              <div className="lb-list-shell">
                <header><span>RANK</span><span>CHALLENGER</span><span>DISCIPLINE</span></header>
                <ul className="lb-list">
                  {list.map((r, i) => (
                    <motion.li
                      key={r.user_id}
                      className={r.is_me ? "is-me" : ""}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(i, 12) * 0.015 }}
                    >
                      <span className="lb-rank">{String(r.rank).padStart(2, "0")}</span>
                      <img src={r.avatar_url || fallbackAvatar(r.username)} alt={r.username} loading="lazy" />
                      <div className="lb-who">
                        <strong>{r.username} {r.elite && <EliteCrest size={12} />}</strong>
                        <small>{flag(r.country)} {r.consistency} day streak</small>
                      </div>
                      <b className="lb-pts">{r.points.toLocaleString()}<i>DP</i></b>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rankUp !== null && (
          <motion.div
            className="lb-rankup"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Sparkles size={18} /> RANK UP · now #{rankUp}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, Crown, Globe2, Loader2, RefreshCw, ShieldAlert, Sparkles, Trash2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

export function Leaderboard({
  myId,
  myName,
  onEditPhoto,
  onRemovePhoto,
  uploading = false,
}: {
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
  const [country, setCountry] = useState("IN");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rankUp, setRankUp] = useState<number | null>(null);
  const prevRank = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    const [top, pos, prof] = await Promise.all([
      supabase.rpc("leaderboard_top" as never, { _scope: scope, _period: period, _limit: 100, _offset: 0 } as never),
      supabase.rpc("my_leaderboard_position" as never, { _scope: scope, _period: period } as never),
      supabase.from("profiles").select("country").eq("id", myId).maybeSingle(),
    ]);
    if (top.error || pos.error) { setState("error"); return; }
    const list = ((top.data ?? []) as unknown as Row[]);
    const position = ((pos.data ?? []) as unknown as Position[])[0] ?? null;
    setRows(list);
    setMe(position);
    if (prof.data?.country) setCountry(String(prof.data.country).toUpperCase());
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

  const saveCountry = async (cc: string) => {
    setCountry(cc);
    await supabase.from("profiles").update({ country: cc }).eq("id", myId);
    void load(true);
  };

  const order = [1, 0, 2]; // visual podium order: 2nd, 1st, 3rd

  return (
    <section className="lb">
      <header className="lb-head">
        <div>
          <h2><Trophy size={18} /> LEADERBOARD</h2>
          <p>Discipline Points · earned, never bought</p>
        </div>
        <button className="lb-refresh" onClick={() => void load()} aria-label="Refresh leaderboard">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="lb-tabs" role="tablist" aria-label="Region">
        {(["india", "global"] as Scope[]).map(s => (
          <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? "is-on" : ""} onClick={() => setScope(s)}>
            {s === "india" ? <>🇮🇳 INDIA</> : <><Globe2 size={13} /> GLOBAL</>}
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

      {state === "ready" && podium.length > 0 && (
        <div className="lb-podium">
          {order.map(i => podium[i]).filter(Boolean).map(p => (
            <motion.div
              key={p.user_id}
              className={`lb-pod lb-pod-${p.rank} ${p.is_me ? "is-me" : ""}`}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: reduce ? 0 : p.rank * 0.06 }}
            >
              <div className="lb-pod-avatar">
                <img src={p.avatar_url || fallbackAvatar(p.username)} alt={p.username} loading="lazy" />
                {p.rank === 1 && <Crown size={15} className="lb-pod-crown" />}
                <b>{p.rank}</b>
              </div>
              <strong>{p.username}</strong>
              <span>{flag(p.country)} {p.elite && <EliteCrest size={13} />}</span>
              <em>{p.points.toLocaleString()} DP</em>
            </motion.div>
          ))}
        </div>
      )}

      {state === "ready" && list.length > 0 && (
        <ul className="lb-list">
          {list.map((r, i) => (
            <motion.li
              key={r.user_id}
              className={r.is_me ? "is-me" : ""}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(i, 12) * 0.015 }}
            >
              <span className="lb-rank">{r.rank}</span>
              <img src={r.avatar_url || fallbackAvatar(r.username)} alt={r.username} loading="lazy" />
              <div className="lb-who">
                <strong>{r.username} {r.elite && <EliteCrest size={12} />}</strong>
                <small>{flag(r.country)} {r.consistency} day streak</small>
              </div>
              <b className="lb-pts">{r.points.toLocaleString()}<i>DP</i></b>
            </motion.li>
          ))}
        </ul>
      )}

      {state === "ready" && me && (
        <div className="lb-you">
          <div className="lb-you-photo">
            <img src={fallbackAvatar(myName)} alt="" aria-hidden className="lb-you-ghost" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change profile photo">
              {uploading ? <Loader2 className="lb-spin" size={15} /> : <Camera size={15} />}
            </button>
            {onRemovePhoto && (
              <button onClick={onRemovePhoto} disabled={uploading} aria-label="Remove profile photo"><Trash2 size={15} /></button>
            )}
            <input
              ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onEditPhoto?.(f); }}
            />
          </div>
          <div className="lb-you-main">
            <small>YOUR POSITION</small>
            <strong>{me.rank > 0 ? `#${me.rank}` : "Unranked"}</strong>
            <span>
              {me.rank > 0 ? `Top ${100 - me.percentile}% · ${me.points.toLocaleString()} DP` : "Earn points to enter the board"}
            </span>
            <em>{me.points_to_next.toLocaleString()} DP to {me.next_milestone.toLocaleString()}</em>
          </div>
          <select className="lb-country" value={country} onChange={e => void saveCountry(e.target.value)} aria-label="Your country">
            {COUNTRIES.map(([cc, label]) => <option key={cc} value={cc}>{flag(cc)} {label}</option>)}
          </select>
        </div>
      )}

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

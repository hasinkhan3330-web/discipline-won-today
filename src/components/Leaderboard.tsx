import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Globe2, Loader2, RefreshCw, ShieldAlert, Sparkles, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeName } from "@/lib/display-name";
import { RankCoinAvatar, RankCoinBadge } from "@/components/RankCoinBadge";

type Scope = "india" | "global";
type Period = "weekly" | "alltime";

type Row = {
  rank: number;
  user_id: string;
  username: string;
  display_name?: string | null;
  coins?: number;
  avatar_url: string | null;
  country: string;
  points: number;
  consistency: number;
  elite: boolean;
  is_me: boolean;
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

export function Leaderboard({ myId, onMyBadge }: {
  myId: string;
  myName: string;
  onMyBadge?: (milestone: number | null) => void;
  onEditPhoto?: (file: File) => void;
  onRemovePhoto?: () => void;
  uploading?: boolean;
}) {
  const [scope, setScope] = useState<Scope>("india");
  const [period, setPeriod] = useState<Period>("weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    const request = ++requestRef.current;
    const [top, badgeResult] = await Promise.all([
      supabase.rpc("leaderboard_top" as never, { _scope: scope, _period: period, _limit: 100, _offset: 0 } as never),
      supabase.rpc("rank_verification_badges" as never, { _scope: scope, _period: period } as never),
    ]);
    if (request !== requestRef.current) return;
    if (top.error) { setState("error"); return; }
    const list = ((top.data ?? []) as unknown as Row[]).map(r => ({ ...r, username: safeName(r.username) }));
    const { data: profileNames } = list.length ? await supabase.from("public_profiles").select("id,display_name,coins").in("id", list.map(r => r.user_id)) : { data: [] };
    if (request !== requestRef.current) return;
    const publicNames = new Map((profileNames ?? []).map(p => [p.id, p]));
    const namedList = list.map(r => ({ ...r, display_name: safeName(publicNames.get(r.user_id)?.display_name || r.username), coins: publicNames.get(r.user_id)?.coins ?? undefined }));
    setRows(namedList);
    const earned = badgeResult.error ? [] : (badgeResult.data ?? []) as { user_id: string; milestone: number | null }[];
    const nextBadges = Object.fromEntries(earned.filter(row => row.milestone != null).map(row => [row.user_id, row.milestone as number]));
    setBadges(nextBadges);
    onMyBadge?.(nextBadges[myId] ?? null);
    setState("ready");
  }, [scope, period, myId, onMyBadge]);

  useEffect(() => { void load(); }, [load]);
  const listOpen = selected !== null;
  const closeList = useCallback(() => {
    if (typeof window !== "undefined" && (window.history.state as { axenRankList?: boolean } | null)?.axenRankList) window.history.back();
    else setSelected(null);
  }, []);
  useEffect(() => {
    if (!listOpen) return;
    // Phone Back button / browser back closes the list instead of leaving Rank.
    window.history.pushState({ ...(window.history.state ?? {}), axenRankList: true }, "", window.location.href);
    const onPop = () => setSelected(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeList(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [listOpen, closeList]);


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

      {state === "ready" && rows.length > 0 && (
          <button className="rank-verified-entry" onClick={() => setSelected(rows[0])} aria-label="Open Verified Rank List">
            <span><strong>Verified Rank List</strong><small>{rows.length} members</small></span>
            <ChevronRight size={20} />
          </button>
      )}
      {selected && typeof document !== "undefined" && createPortal(
        <div className="rank-people-backdrop">
          <section className="rank-people" role="dialog" aria-modal="true" aria-label="Verified Rank List">
            <header className="rank-people__header">
              <button onClick={() => setSelected(null)} aria-label="Close Verified Rank List"><X size={24} /></button>
              <strong>Verified Rank List</strong>
              <span />
            </header>
            <div className="rank-people__list">
              {rows.map(r => <div className="rank-people__row" key={r.user_id}>
                <RankCoinAvatar name={r.username} src={r.avatar_url || fallbackAvatar(r.username)} />
                <div className="rank-people__identity"><strong><span>{r.username}</span><RankCoinBadge milestone={badges[r.user_id]} /></strong><small>{safeName(r.display_name || r.username)}</small></div>
              </div>)}
            </div>
          </section>
        </div>, document.body)
      }

    </section>
  );
}

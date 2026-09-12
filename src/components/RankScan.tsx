import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { ScanLine, TrendingUp, Users, CalendarCheck, Trophy, AlertTriangle } from "lucide-react";

type ScanRow = {
  coins: number;
  coin_rank: number;
  total_users: number;
  percentile: number;
  streak: number;
  streak_rank: number;
  longest_streak: number;
  consistency_30d: number;
  completions_30d: number;
  active_habits: number;
  best_habit: string | null;
  best_habit_rate: number | null;
  weakest_habit: string | null;
  weakest_habit_rate: number | null;
};

const PHASES = [
  "Reading habit ledger…",
  "Comparing against every AXEN user…",
  "Measuring 30-day consistency…",
  "Locating your weakest link…",
];

/**
 * Rank Scan — a Pro-only deep analysis of where the user actually stands
 * among every AXEN user. All numbers come from rank_scan() (server-side,
 * premium-gated), never from client state.
 */
export function RankScan() {
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [row, setRow] = useState<ScanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const run = async () => {
    if (scanning) return;
    haptic("tap");
    setScanning(true);
    setError(null);
    setRow(null);
    setPhase(0);
    timers.current.forEach(clearTimeout);
    timers.current = PHASES.map((_, i) => setTimeout(() => setPhase(i), i * 700));

    const started = Date.now();
    const { data, error: err } = await (supabase.rpc as any)("rank_scan");
    const wait = Math.max(0, 2600 - (Date.now() - started));

    timers.current.push(setTimeout(() => {
      if (err) {
        setError(err.message || "The scan could not complete.");
      } else {
        const r = (Array.isArray(data) ? data[0] : data) as ScanRow | undefined;
        if (!r) setError("No scan data yet — complete a habit first.");
        else { setRow(r); haptic("success"); }
      }
      setScanning(false);
    }, wait));
  };

  const CARD = cardStyle();

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <ScanLine size={16} strokeWidth={1.8} color={AX.cyan} />
        Rank Scan
      </div>

      {!row && !scanning && (
        <>
          <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Run a full scan of your discipline record — your exact position among all
            AXEN users, your 30-day consistency and the habit that is dragging you down.
          </div>
          {error && (
            <div style={{ fontSize: 12, color: AX.danger, marginBottom: 12 }}>{error}</div>
          )}
          <button onClick={run} style={{
            width: "100%", minHeight: 46, borderRadius: 12, cursor: "pointer",
            background: AX.cyan, border: `1px solid ${AX.cyan}`, color: "#05131A",
            fontFamily: AX.font, fontSize: 14, fontWeight: 700,
          }}>Start scan</button>
        </>
      )}

      {scanning && (
        <div style={{ padding: "6px 0" }}>
          <style>{`
            @keyframes ax-scanbar { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
          `}</style>
          <div style={{
            position: "relative", height: 92, borderRadius: 12, overflow: "hidden",
            background: "#101018", border: `1px solid ${AX.cyan}44`,
          }}>
            <div style={{
              position: "absolute", left: 0, right: 0, height: 24,
              background: `linear-gradient(180deg, transparent, ${AX.cyan}55, transparent)`,
              animation: "ax-scanbar 1.1s linear infinite",
            }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: AX.cyan, textAlign: "center" }}>
            {PHASES[phase]}
          </div>
        </div>
      )}

      {row && !scanning && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
            background: "#181820", border: `1px solid ${AX.cyan}55`, borderRadius: 14, marginBottom: 12,
          }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: AX.cyan, lineHeight: 1 }}>
              #{row.coin_rank}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: AX.text, fontWeight: 600 }}>
                Top {100 - row.percentile || 1}% of {row.total_users} users
              </div>
              <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>
                {row.coins} coins · streak rank #{row.streak_rank}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              { Ico: CalendarCheck, v: `${row.consistency_30d}%`, l: "30-day" },
              { Ico: TrendingUp, v: `${row.completions_30d}`, l: "Wins" },
              { Ico: Users, v: `${row.active_habits}`, l: "Habits" },
            ].map(s => (
              <div key={s.l} style={{ background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
                <s.Ico size={17} strokeWidth={1.8} color={AX.accent} />
                <div style={{ fontSize: 16, fontWeight: 600, color: AX.text, marginTop: 5 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: AX.muted, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {row.best_habit && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 13px", background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, marginBottom: 8 }}>
              <Trophy size={16} color={AX.success} strokeWidth={1.8} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: AX.text }}>
                Strongest: <strong>{row.best_habit}</strong>
              </div>
              <div style={{ fontSize: 13, color: AX.success, fontWeight: 600 }}>{row.best_habit_rate}%</div>
            </div>
          )}

          {row.weakest_habit && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 13px", background: "#181820", border: `1px solid ${AX.flame}55`, borderRadius: 14 }}>
              <AlertTriangle size={16} color={AX.flame} strokeWidth={1.8} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: AX.text }}>
                Weakest: <strong>{row.weakest_habit}</strong>
              </div>
              <div style={{ fontSize: 13, color: AX.flame, fontWeight: 600 }}>{row.weakest_habit_rate}%</div>
            </div>
          )}

          <button onClick={run} style={{
            marginTop: 14, width: "100%", minHeight: 44, borderRadius: 12, cursor: "pointer",
            background: "transparent", border: `1px solid ${AX.border}`, color: AX.text,
            fontFamily: AX.font, fontSize: 13, fontWeight: 600,
          }}>Scan again</button>
        </>
      )}
    </div>
  );
}

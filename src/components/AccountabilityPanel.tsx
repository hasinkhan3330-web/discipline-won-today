import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { EmptyState } from "@/components/EmptyState";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import { HeartHandshake, Send, ShieldAlert, X } from "lucide-react";

type Status = {
  pact_id: string;
  role: "owner" | "partner";
  daily_target: number;
  stake_coins: number;
  me_done_today: number;
  me_total_today: number;
  me_streak: number;
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  partner_done_today: number;
  partner_total_today: number;
  partner_streak: number;
  last_nudge: string | null;
  last_nudge_at: string | null;
};

type Friend = { friend_id: string; display_name: string | null; username: string | null; status: string };

const QUICK_NUDGES = [
  "Get up. Your habits are waiting.",
  "I'm ahead today. Catch up.",
  "Don't break it now — finish the day.",
];

/**
 * Accountability Mode (PRO) — pair with one friend, commit to a daily habit
 * target, put coins on the line and see each other's live progress every day.
 */
export function AccountabilityPanel({ fallbackAvatar }: { fallbackAvatar: (n: string) => string }) {
  const CARD = cardStyle();
  const [status, setStatus] = useState<Status | null | undefined>(undefined);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [partner, setPartner] = useState("");
  const [target, setTarget] = useState(3);
  const [stake, setStake] = useState(20);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: st }, { data: fr }] = await Promise.all([
      (supabase.rpc as any)("get_pact_status"),
      (supabase.rpc as any)("list_friends"),
    ]);
    const row = (Array.isArray(st) ? st[0] : st) as Status | undefined;
    setStatus(row ?? null);
    setFriends(((fr ?? []) as Friend[]).filter(f => f.status === "accepted"));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`pact_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "pact_nudges" }, () => load())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "accountability_pacts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const create = async () => {
    if (!partner || busy) return;
    setBusy(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const uid = me.user?.id;
      if (!uid) throw new Error("You are signed out.");
      const { error } = await supabase.from("accountability_pacts").insert({
        owner_id: uid, partner_id: partner, daily_target: target, stake_coins: stake,
      } as never);
      if (error) throw error;
      haptic("success");
      toast.success("Accountability pact started");
      await load();
    } catch (e: any) {
      toast.error("Could not start the pact", { description: e?.message });
    } finally { setBusy(false); }
  };

  const end = async () => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("accountability_pacts")
        .update({ status: "ended" } as never)
        .eq("id", status.pact_id);
      if (error) throw error;
      haptic("warn");
      toast.success("Pact ended");
      await load();
    } catch (e: any) {
      toast.error("Could not end the pact", { description: e?.message });
    } finally { setBusy(false); }
  };

  const nudge = async (message: string) => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const uid = me.user?.id;
      if (!uid) throw new Error("You are signed out.");
      const { error } = await supabase.from("pact_nudges").insert({
        pact_id: status.pact_id, from_user: uid, to_user: status.partner_id, message,
      } as never);
      if (error) throw error;
      haptic("success");
      toast.success(`Nudge sent to ${status.partner_name}`);
    } catch (e: any) {
      toast.error("Could not send the nudge", { description: e?.message });
    } finally { setBusy(false); }
  };

  if (status === undefined) {
    return <div style={CARD}><div style={{ fontSize: 13, color: AX.muted }}>Loading accountability…</div></div>;
  }

  if (!status) {
    return (
      <div style={CARD}>
        <div style={titleStyle}>
          <HeartHandshake size={16} strokeWidth={1.8} color={AX.accent} />
          Accountability Mode
        </div>
        <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Pair with one friend. Commit to a daily habit target, put coins on the line,
          and see each other's live progress every single day.
        </div>

        {friends.length === 0 ? (
          <EmptyState
            title="Add a friend first"
            line="Accountability needs a partner — add someone by username below, then come back."
          />
        ) : (
          <>
            <div style={{ fontSize: 12, color: AX.muted, marginBottom: 8 }}>Partner</div>
            <select
              value={partner}
              onChange={e => setPartner(e.target.value)}
              style={{
                width: "100%", minHeight: 46, padding: "10px 12px", borderRadius: 12, marginBottom: 14,
                background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
                fontFamily: AX.font, fontSize: 14, outline: "none",
              }}
            >
              <option value="">Choose a friend…</option>
              {friends.map(f => (
                <option key={f.friend_id} value={f.friend_id}>{f.display_name || f.username || "User"}</option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: AX.muted, marginBottom: 8 }}>Daily target</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setTarget(n)} style={{
                      flex: 1, minHeight: 42, borderRadius: 10, cursor: "pointer",
                      background: target === n ? AX.accent : "#181820",
                      border: `1px solid ${target === n ? AX.accent : AX.border}`,
                      color: target === n ? "#FFFFFF" : AX.muted,
                      fontFamily: AX.font, fontSize: 13, fontWeight: 600,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: AX.muted, marginBottom: 8 }}>Coins at stake</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 20, 50].map(n => (
                    <button key={n} onClick={() => setStake(n)} style={{
                      flex: 1, minHeight: 42, borderRadius: 10, cursor: "pointer",
                      background: stake === n ? AX.accent : "#181820",
                      border: `1px solid ${stake === n ? AX.accent : AX.border}`,
                      color: stake === n ? "#FFFFFF" : AX.muted,
                      fontFamily: AX.font, fontSize: 13, fontWeight: 600,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={create} disabled={!partner || busy} style={{
              width: "100%", minHeight: 46, borderRadius: 12,
              cursor: !partner || busy ? "not-allowed" : "pointer",
              background: !partner || busy ? "#181820" : AX.accent,
              border: `1px solid ${!partner || busy ? AX.border : AX.accent}`,
              color: !partner || busy ? AX.muted : "#FFFFFF",
              fontFamily: AX.font, fontSize: 14, fontWeight: 600,
            }}>{busy ? "Starting…" : "Start pact"}</button>
          </>
        )}
      </div>
    );
  }

  const meHit = status.me_done_today >= status.daily_target;
  const partnerHit = status.partner_done_today >= status.daily_target;

  const Side = ({ name, img, done, total, streak, hit, you }: {
    name: string; img: string; done: number; total: number; streak: number; hit: boolean; you?: boolean;
  }) => (
    <div style={{
      background: "#181820", border: `1px solid ${hit ? AX.success : AX.border}`,
      borderRadius: 14, padding: 14, textAlign: "center",
    }}>
      <img
        src={img}
        alt={name}
        onError={e => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(name); }}
        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `1px solid ${AX.border}` }}
      />
      <div className="ax-ellipsis" style={{ fontSize: 13, fontWeight: 600, color: AX.text, marginTop: 8 }}>
        {you ? "You" : name}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: hit ? AX.success : AX.text, marginTop: 6 }}>
        {done}/{status.daily_target}
      </div>
      <div style={{ fontSize: 11, color: AX.muted, marginTop: 2 }}>
        {total} habits · {streak}d streak
      </div>
      <div style={{ fontSize: 11, color: hit ? AX.success : AX.flame, marginTop: 6, fontWeight: 600 }}>
        {hit ? "Target met" : "Behind target"}
      </div>
    </div>
  );

  return (
    <div style={CARD}>
      <div style={{ ...titleStyle, justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HeartHandshake size={16} strokeWidth={1.8} color={AX.accent} />
          Accountability Mode
        </span>
        {status.role === "owner" && (
          <button onClick={end} aria-label="End pact" style={{
            width: 32, height: 32, borderRadius: 10, cursor: "pointer",
            background: "transparent", border: `1px solid ${AX.border}`, color: AX.muted,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><X size={15} strokeWidth={2} /></button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Side you name="You" img={fallbackAvatar("You")} done={status.me_done_today} total={status.me_total_today} streak={status.me_streak} hit={meHit} />
        <Side
          name={status.partner_name}
          img={status.partner_avatar || fallbackAvatar(status.partner_name)}
          done={status.partner_done_today}
          total={status.partner_total_today}
          streak={status.partner_streak}
          hit={partnerHit}
        />
      </div>

      {status.stake_coins > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: AX.muted, marginBottom: 12 }}>
          <ShieldAlert size={14} color={AX.flame} strokeWidth={1.8} />
          {status.stake_coins} coins on the line each day — miss the target and your partner sees it.
        </div>
      )}

      {status.last_nudge && (
        <div style={{
          padding: "11px 13px", background: "#181820", border: `1px solid ${AX.accent}55`,
          borderRadius: 14, marginBottom: 12, fontSize: 13, color: AX.text, lineHeight: 1.5,
        }}>
          <span style={{ color: AX.accent, fontWeight: 600 }}>{status.partner_name}: </span>
          {status.last_nudge}
        </div>
      )}

      <div style={{ fontSize: 12, color: AX.muted, marginBottom: 8 }}>Send a nudge</div>
      <div style={{ display: "grid", gap: 8 }}>
        {QUICK_NUDGES.map(m => (
          <button key={m} onClick={() => nudge(m)} disabled={busy} style={{
            display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            minHeight: 44, padding: "10px 13px", borderRadius: 12, cursor: busy ? "not-allowed" : "pointer",
            background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
            fontFamily: AX.font, fontSize: 13,
          }}>
            <Send size={14} strokeWidth={1.8} color={AX.accent} />
            <span style={{ flex: 1, minWidth: 0 }}>{m}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

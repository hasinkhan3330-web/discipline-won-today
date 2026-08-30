import { useCallback, useEffect, useState } from "react";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { EmptyState } from "@/components/EmptyState";
import { Users, Check, X } from "lucide-react";

type Friend = {
  friendship_id: string;
  friend_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  coins: number;
  streak: number;
  longest_streak: number;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
};

const REASONS: Record<string, string> = {
  user_not_found: "No user with that name.",
  cannot_add_yourself: "You can't add yourself.",
  already_friends: "You're already connected.",
  request_pending: "A request is already pending.",
  sent: "Request sent.",
};

export function FriendsPanel({ myStreak, myCoins, fallbackAvatar }: {
  myStreak: number;
  myCoins: number;
  fallbackAvatar: (n: string) => string;
}) {
  const CARD = cardStyle();
  const [rows, setRows] = useState<Friend[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)("list_friends");
    if (error) { setRows([]); return; }
    setRows((data || []) as Friend[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const target = name.trim();
    if (!target || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("send_friend_request", { _username: target });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const msg = REASONS[row?.reason] || "Could not send that request.";
      if (row?.ok) { haptic("success"); toast.success(msg); setName(""); await load(); }
      else toast.error(msg);
    } catch (e: any) {
      toast.error("Could not send that request", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const respond = async (id: string, accept: boolean) => {
    if (acting) return;
    setActing(id);
    try {
      const { error } = await (supabase.rpc as any)("respond_friend_request", { _request_id: id, _accept: accept });
      if (error) throw error;
      haptic(accept ? "success" : "warn");
      toast.success(accept ? "Friend added" : "Request declined");
      await load();
    } catch (e: any) {
      toast.error("Could not update that request", { description: e?.message });
    } finally {
      setActing(null);
    }
  };

  const incoming = (rows || []).filter(r => r.status === "pending" && r.direction === "incoming");
  const outgoing = (rows || []).filter(r => r.status === "pending" && r.direction === "outgoing");
  const friends = (rows || []).filter(r => r.status === "accepted");

  const label = (f: Friend) => f.display_name || f.username || "User";

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <Users size={16} strokeWidth={1.8} color={AX.accent} />
        Friends
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Add by username"
          style={{
            flex: 1, minHeight: 44, padding: "10px 14px", borderRadius: 12,
            background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
            fontFamily: AX.font, fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          style={{
            minHeight: 44, padding: "0 16px", borderRadius: 12,
            cursor: busy || !name.trim() ? "not-allowed" : "pointer",
            background: busy || !name.trim() ? "#181820" : AX.accent,
            border: `1px solid ${busy || !name.trim() ? AX.border : AX.accent}`,
            color: busy || !name.trim() ? AX.muted : "#FFFFFF",
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          }}
        >
          {busy ? "…" : "Add"}
        </button>
      </div>

      {rows === null && <div style={{ fontSize: 13, color: AX.muted }}>Loading friends…</div>}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: AX.muted, marginBottom: 8 }}>Requests</div>
          {incoming.map(f => (
            <div key={f.friendship_id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, marginBottom: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: AX.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label(f)}</div>
              <button onClick={() => respond(f.friendship_id, true)} disabled={acting === f.friendship_id} aria-label="Accept" style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer",
                background: "transparent", border: `1px solid ${AX.success}`, color: AX.success,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Check size={17} strokeWidth={2} /></button>
              <button onClick={() => respond(f.friendship_id, false)} disabled={acting === f.friendship_id} aria-label="Decline" style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer",
                background: "transparent", border: `1px solid ${AX.border}`, color: AX.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><X size={17} strokeWidth={2} /></button>
            </div>
          ))}
        </div>
      )}

      {rows !== null && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
        <EmptyState
          title="No friends yet"
          line="Add someone by their username to compare streaks day by day."
        />
      )}

      {friends.map(f => {
        const diff = myStreak - f.streak;
        return (
          <div key={f.friendship_id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, marginBottom: 10,
          }}>
            <img
              src={f.avatar_url || fallbackAvatar(label(f))}
              alt={label(f)}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(label(f)); }}
              style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `1px solid ${AX.border}` }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: AX.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label(f)}</div>
              <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>
                {f.streak}d streak · {f.coins} coins
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: diff >= 0 ? AX.success : AX.flame }}>
                {diff >= 0 ? `+${diff}d` : `${diff}d`}
              </div>
              <div style={{ fontSize: 11, color: AX.muted }}>you ({myStreak}d)</div>
            </div>
          </div>
        );
      })}

      {outgoing.length > 0 && (
        <div style={{ fontSize: 12, color: AX.muted, marginTop: 4 }}>
          {outgoing.length} request{outgoing.length === 1 ? "" : "s"} waiting for a reply.
        </div>
      )}

      {friends.length > 0 && (
        <div style={{ fontSize: 12, color: AX.muted, marginTop: 4 }}>
          Your total: {myCoins} coins.
        </div>
      )}
    </div>
  );
}

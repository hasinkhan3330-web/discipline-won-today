import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Flame, Handshake, HeartHandshake, Send, Siren, Skull, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AX, buttonStyle, cardStyle, subText, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { safeName } from "@/lib/display-name";
import { acceptInvite, createInvite } from "@/lib/verified/accountability.functions";
import { NUDGE_EVENT, NUDGE_SEEN_KEY } from "./NudgeListener";

export type MyAccountability = {
  connection_id: string; partner_name: string; partner_avatar: string | null;
  my_sharing: boolean; partner_sharing: boolean; i_muted: boolean; since: string;
};
type Summary = { title: string; status: string; started_at: string | null };
type Details = {
  my_commitment: string | null; partner_commitment: string | null;
  partner_streak: number; partner_weekly_coins: number; partner_weekly_tasks: number;
  can_check_in: boolean; checked_in_today: boolean;
};

export const NUDGES = [
  "Bhai uth, aaj ka task pending hai 🔥",
  "Tera streak toot raha hai — 1 task kar abhi ⚡",
  "Discipline seeker ya excuse maker? Choice teri 💀",
  "Top 10 mein aana hai? Aaj ka kaam kar 🏆",
  "Main dekh raha hoon — mat chook aaj 🤝",
] as const;
const NUDGE_LABELS = [
  { message: NUDGES[0], label: "Bhai uth, aaj ka task pending hai", Icon: Flame },
  { message: NUDGES[1], label: "Tera streak toot raha hai — 1 task kar abhi", Icon: Zap },
  { message: NUDGES[2], label: "Discipline seeker ya excuse maker? Choice teri", Icon: Skull },
  { message: NUDGES[3], label: "Top 10 mein aana hai? Aaj ka kaam kar", Icon: Trophy },
  { message: NUDGES[4], label: "Main dekh raha hoon — mat chook aaj", Icon: Handshake },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Planning", scheduled: "Not started", active: "Started", proof_pending: "Finishing",
  verified: "Completed", rewarded: "Completed", missed: "Not completed yet",
};

export async function loadMyAccountability(): Promise<MyAccountability | null> {
  const { data, error } = await (supabase.rpc as any)("get_my_accountability");
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return (r ?? null) as MyAccountability | null;
}

function nudgeError(m: string) {
  if (m.includes("muted")) return "Your partner has muted nudges.";
  if (m.includes("contract")) return "Nudge limit reached for this contract.";
  if (m.includes("daily")) return "Daily nudge limit reached.";
  if (m.includes("connection")) return "No active partner.";
  if (m.includes("complete a task")) return "Complete one task before checking in.";
  if (m.includes("already checked")) return "You already checked in today.";
  if (m.includes("too long")) return "Commitment must be 100 characters or less.";
  return "Could not send the nudge.";
}

const toggleRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 14, color: AX.text } as const;

type NudgeRow = { id: string; actor_id: string; kind: string; message: string | null; created_at: string };

function NudgeHistory() {
  const [rows, setRows] = useState<NudgeRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState<number>(0);
  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);
    const { data } = await supabase.from("accountability_events")
      .select("id, actor_id, kind, message, created_at").in("kind", ["nudge", "emergency", "checkin"])
      .order("created_at", { ascending: false }).limit(10);
    setRows((data ?? []) as NudgeRow[]);
  }, []);
  useEffect(() => {
    setSeenAt(Number(localStorage.getItem(NUDGE_SEEN_KEY) ?? 0));
    void load();
    const on = () => void load();
    window.addEventListener(NUDGE_EVENT, on);
    return () => {
      window.removeEventListener(NUDGE_EVENT, on);
      localStorage.setItem(NUDGE_SEEN_KEY, String(Date.now()));
    };
  }, [load]);
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 14 }} aria-label="Recent nudges">
      <div style={subText}>Recent nudges</div>
      {rows.map(r => {
        const mine = r.actor_id === me;
        const unread = !mine && new Date(r.created_at).getTime() > seenAt;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: AX.text, marginTop: 6 }}>
            {unread && <span aria-label="New" style={{ width: 7, height: 7, borderRadius: 99, background: AX.accent, flexShrink: 0 }} />}
             <span style={{ flex: 1 }}>{mine ? "You sent" : "Partner sent"}: {r.message}</span>
            <span style={{ ...subText, fontSize: 11 }}>{new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AccountabilitySection() {
  const CARD = cardStyle();
  const [me, setMe] = useState<MyAccountability | null | undefined>(undefined);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [commitment, setCommitment] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const mkInvite = useServerFn(createInvite);
  const doAccept = useServerFn(acceptInvite);

  const load = useCallback(async () => {
    try {
      const m = await loadMyAccountability();
      if (!mounted.current) return;
      setMe(m); setErr(null);
      if (m) {
        const [{ data }, { data: detailData, error: detailError }] = await Promise.all([
          (supabase.rpc as any)("get_partner_contract_summary"),
          (supabase.rpc as any)("send_accountability_nudge", { _connection_id: m.connection_id, _kind: "details", _message: null }),
        ]);
        if (detailError) throw detailError;
        if (mounted.current) {
          const nextDetails = (detailData ?? null) as Details | null;
          setSummary(((Array.isArray(data) ? data[0] : data) ?? null) as Summary | null);
          setDetails(nextDetails);
          setCommitment(nextDetails?.my_commitment ?? "");
        }
      } else { setSummary(null); setDetails(null); setCommitment(""); }
    } catch {
      if (mounted.current) { setErr("Couldn't load accountability. Try again."); setMe(null); }
    }
  }, []);

  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };

  const invite = () => run(async () => {
    const r = await mkInvite();
    if (r.ok) { setCode(r.code); haptic("success"); } else toast.error(r.message);
  });
  const join = () => run(async () => {
    const r = await doAccept({ data: { code: entry } });
    if (r.ok) { toast.success("Partner connected"); setEntry(""); haptic("success"); await load(); window.dispatchEvent(new Event("axen:contract-changed")); }
    else toast.error(r.message);
  });
  const setPref = (p: { _share?: boolean; _mute?: boolean }) => run(async () => {
    const { error } = await (supabase.rpc as any)("set_accountability_prefs", p);
    if (error) toast.error("Could not save"); else { await load(); window.dispatchEvent(new Event("axen:contract-changed")); }
  });
  const nudge = (msg: string) => run(async () => {
    if (!me) return;
    const { error } = await (supabase.rpc as any)("send_accountability_nudge", { _connection_id: me.connection_id, _kind: "nudge", _message: msg });
    if (error) toast.error(nudgeError(error.message ?? "")); else { toast.success("Nudge sent"); haptic("success"); }
  });
  const sendAction = (kind: "emergency" | "checkin") => run(async () => {
    if (!me) return;
    const { error } = await (supabase.rpc as any)("send_accountability_nudge", { _connection_id: me.connection_id, _kind: kind, _message: null });
    if (error) toast.error(nudgeError(error.message ?? ""));
    else { toast.success(kind === "checkin" ? "Check-in sent" : "Emergency nudge sent"); haptic("success"); await load(); window.dispatchEvent(new Event(NUDGE_EVENT)); }
  });
  const saveCommitment = () => run(async () => {
    if (!me) return;
    const { error } = await (supabase.rpc as any)("send_accountability_nudge", { _connection_id: me.connection_id, _kind: "commitment", _message: commitment });
    if (error) toast.error(nudgeError(error.message ?? ""));
    else { toast.success("Commitment saved"); haptic("success"); await load(); }
  });
  const end = (block: boolean) => run(async () => {
    if (!me) return;
    const q = block ? "Block and report this partner? They lose access immediately and can't nudge you." : "Remove your partner? They lose access immediately.";
    if (!window.confirm(q)) return;
    const { error } = await (supabase.rpc as any)("revoke_accountability_connection", { _connection_id: me.connection_id, _block: block });
    if (error) toast.error("Could not update"); else { toast.success(block ? "Partner blocked" : "Partner removed"); await load(); window.dispatchEvent(new Event("axen:contract-changed")); }
  });

  const head = <div style={titleStyle}><HeartHandshake size={16} strokeWidth={1.8} color={AX.accent} />Accountability</div>;

  if (me === undefined) return <section style={CARD} aria-label="Accountability">{head}<div style={subText} aria-busy="true">Loading…</div></section>;

  if (!me) return (
    <section style={CARD} aria-label="Accountability">{head}
      {err && <div role="alert" style={subText}>{err}</div>}
      <div style={subText}>No partner yet. One partner only. They see just your contract title and whether you started or finished — never notes, proof, coins or history.</div>
      {code ? (
        <div style={{ marginTop: 12 }}>
          <div style={subText}>Share this one-time code (valid 24 hours):</div>
          <div style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 1, color: AX.text, marginTop: 6, wordBreak: "break-all" }} aria-label="Invite code">{code}</div>
          <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={() => { void navigator.clipboard?.writeText(code).then(() => toast.success("Copied")); }}>Copy code</button>
        </div>
      ) : (
        <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={() => void invite()} disabled={busy}>CREATE INVITE</button>
      )}
      <label style={{ ...subText, display: "block", marginTop: 14 }}>Enter partner's code
        <input aria-label="Partner code" value={entry} onChange={e => setEntry(e.target.value)} maxLength={40}
          style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, minHeight: 44, padding: "0 12px", borderRadius: 12, background: "transparent", border: `1px solid ${AX.border}`, color: AX.text }} />
      </label>
      <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={() => void join()} disabled={busy || entry.trim().length < 8}>Join</button>
    </section>
  );

  const name = safeName(me.partner_name, "Partner");
  return (
    <section style={CARD} aria-label="Accountability">{head}
      <div style={{ fontSize: 15, fontWeight: 600, color: AX.text }}>{name}</div>
      <div style={{ ...subText, marginTop: 4 }}>
        {me.partner_sharing
          ? summary ? <>Today: {summary.title} · {STATUS_LABEL[summary.status] ?? summary.status}</> : "No contract today."
          : "Your partner isn't sharing progress."}
      </div>
      <label style={toggleRow}>Share my contract progress
        <input type="checkbox" aria-label="Share my contract progress" checked={me.my_sharing} disabled={busy} onChange={e => void setPref({ _share: e.target.checked })} />
      </label>
      <label style={toggleRow}>Mute nudges
        <input type="checkbox" aria-label="Mute nudges" checked={me.i_muted} disabled={busy} onChange={e => void setPref({ _mute: e.target.checked })} />
      </label>
      <div style={{ ...subText, marginTop: 16 }}>Partner stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 7 }} aria-label="Partner stats">
        {[
          [details?.partner_streak ?? 0, "Current streak"],
          [details?.partner_weekly_coins ?? 0, "Weekly coins"],
          [details?.partner_weekly_tasks ?? 0, "Tasks this week"],
        ].map(([value, label]) => <div key={String(label)} style={{ border: `1px solid ${AX.border}`, padding: "10px 6px", textAlign: "center", minWidth: 0 }}><strong style={{ display: "block", color: AX.text, fontSize: 18 }}>{value}</strong><span style={{ ...subText, display: "block", fontSize: 10 }}>{label}</span></div>)}
      </div>
      <div style={{ ...subText, marginTop: 16 }}>Our Contract</div>
      <label style={{ ...subText, display: "block", marginTop: 7 }}>My commitment
        <textarea aria-label="My commitment" value={commitment} onChange={e => setCommitment(e.target.value)} maxLength={100} rows={2}
          style={{ display: "block", width: "100%", boxSizing: "border-box", resize: "vertical", marginTop: 6, padding: 10, borderRadius: 8, background: "transparent", border: `1px solid ${AX.border}`, color: AX.text }} />
      </label>
      <div style={{ ...subText, textAlign: "right", fontSize: 11 }}>{commitment.length}/100</div>
      <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 6 }} onClick={() => void saveCommitment()} disabled={busy || commitment === (details?.my_commitment ?? "")}>Save commitment</button>
      <div style={{ marginTop: 10, padding: 10, border: `1px solid ${AX.border}`, borderRadius: 8 }}><span style={{ ...subText, display: "block" }}>Partner commitment</span><span style={{ color: AX.text, fontSize: 13 }}>{details?.partner_commitment || "No commitment yet."}</span></div>
      <NudgeHistory />
      <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }} onClick={() => void sendAction("checkin")} disabled={busy || !details?.can_check_in || details.checked_in_today}>
        <CheckCircle2 size={16} />{details?.checked_in_today ? "Checked in today" : "Aaj ka task kiya"}
      </button>
      <div style={{ ...subText, marginTop: 14 }}>Send a nudge</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 6 }}>
        {NUDGE_LABELS.map(({ message, label, Icon }) => (
          <button key={message} aria-label={message} style={{ ...buttonStyle("ghost"), display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }} onClick={() => void nudge(message)} disabled={busy}>
            <Send size={13} strokeWidth={1.8} /><span>{label}</span><Icon size={14} strokeWidth={1.8} />
          </button>
        ))}
      </div>
      <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: AX.danger }} onClick={() => void sendAction("emergency")} disabled={busy}><Siren size={15} />Emergency Nudge</button>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={{ ...buttonStyle("ghost"), flex: 1 }} onClick={() => void end(false)} disabled={busy}>Remove partner</button>
        <button style={{ ...buttonStyle("ghost"), flex: 1, color: AX.danger }} onClick={() => void end(true)} disabled={busy}>Block & report</button>
      </div>
    </section>
  );
}

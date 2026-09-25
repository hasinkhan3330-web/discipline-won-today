import { useCallback, useEffect, useRef, useState } from "react";
import { HeartHandshake, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AX, buttonStyle, cardStyle, subText, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { safeName } from "@/lib/display-name";
import { acceptInvite, createInvite } from "@/lib/verified/accountability.functions";

export type MyAccountability = {
  connection_id: string; partner_name: string; partner_avatar: string | null;
  my_sharing: boolean; partner_sharing: boolean; i_muted: boolean; since: string;
};
type Summary = { title: string; status: string; started_at: string | null };

export const NUDGES = ["You've got this", "Start now", "Great work", "Try the rescue version"] as const;

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
  return "Could not send the nudge.";
}

const toggleRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 14, color: AX.text } as const;

export function AccountabilitySection() {
  const CARD = cardStyle();
  const [me, setMe] = useState<MyAccountability | null | undefined>(undefined);
  const [summary, setSummary] = useState<Summary | null>(null);
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
        const { data } = await (supabase.rpc as any)("get_partner_contract_summary");
        if (mounted.current) setSummary(((Array.isArray(data) ? data[0] : data) ?? null) as Summary | null);
      } else setSummary(null);
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
      <div style={{ ...subText, marginTop: 14 }}>Send a nudge</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        {NUDGES.map(m => (
          <button key={m} style={{ ...buttonStyle("ghost"), display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }} onClick={() => void nudge(m)} disabled={busy}>
            <Send size={13} strokeWidth={1.8} />{m}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={{ ...buttonStyle("ghost"), flex: 1 }} onClick={() => void end(false)} disabled={busy}>Remove partner</button>
        <button style={{ ...buttonStyle("ghost"), flex: 1, color: AX.danger }} onClick={() => void end(true)} disabled={busy}>Block & report</button>
      </div>
    </section>
  );
}

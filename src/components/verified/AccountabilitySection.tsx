import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { safeName } from "@/lib/display-name";
import { acceptInvite, createInvite } from "@/lib/verified/accountability.functions";
import type { ContractRow } from "@/lib/verified/contracts";
import { endContractSession, findActiveSession, startContractSession, type SessionSnapshot } from "@/lib/verified/contract-session";
import { ContractProofSheet } from "./ContractProofSheet";
import { NUDGE_EVENT, NUDGE_SEEN_KEY } from "./NudgeListener";

export type MyAccountability = {
  connection_id: string; partner_name: string; partner_avatar: string | null;
  my_sharing: boolean; partner_sharing: boolean; i_muted: boolean; since: string;
};
type Details = {
  my_commitment: string | null; partner_commitment: string | null;
  partner_streak: number; partner_weekly_coins: number; partner_weekly_tasks: number;
  can_check_in: boolean; checked_in_today: boolean;
};
type Proof = { id: string; contract_id: string; proof_type: string; created_at: string; partner_review_status: string | null; reviewed_at: string | null; review_note: string | null };
type Review = { proof_id: string; owner_name: string; title: string; proof_type: string; evidence: string | null; planned_minutes: number; elapsed_minutes: number; submitted_at: string; review_status: string; asked_once: boolean };
type Trust = { confirmed: number; disputed: number; recoveries: number; abandoned: number; on_time: number; reviewed: number; threshold: number; score: number | null };

export const NUDGES = [
  "Bhai uth, aaj ka task pending hai 🔥",
  "Tera streak toot raha hai — 1 task kar abhi ⚡",
  "Discipline seeker ya excuse maker? Choice teri 💀",
  "Top 10 mein aana hai? Aaj ka kaam kar 🏆",
  "Main dekh raha hoon — mat chook aaj 🤝",
] as const;
const NUDGE_TEXT = ["Bhai uth, aaj ka task pending hai", "Tera streak toot raha hai — 1 task kar abhi", "Discipline seeker ya excuse maker? Choice teri", "Top 10 mein aana hai? Aaj ka kaam kar", "Main dekh raha hoon — mat chook aaj"];

/** Honest labels — a timer or photo is never called "verified" on its own. */
export const PROOF_LABEL: Record<string, { label: string; help: string }> = {
  recorded: { label: "Session recorded", help: "AXEN recorded your session time. This doesn't prove the task itself." },
  pending: { label: "Evidence submitted", help: "Your evidence is in. Partner review is still pending." },
  asked: { label: "More detail requested", help: "Your partner asked once for a little more detail." },
  confirmed: { label: "Partner confirmed", help: "Your partner reviewed and confirmed the evidence." },
  self_reported: { label: "Self-reported", help: "You reported completion. It isn't independently confirmed." },
  disputed: { label: "Disputed", help: "Your partner couldn't confirm this one. You can talk it through and mark it self-reported." },
  recovered: { label: "Recovered", help: "You completed a comeback after a missed window." },
};

export async function loadMyAccountability(): Promise<MyAccountability | null> {
  const { data, error } = await (supabase.rpc as any)("get_my_accountability");
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return (r ?? null) as MyAccountability | null;
}

function friendlyError(m: string) {
  if (m.includes("muted")) return "Your partner has muted nudges.";
  if (m.includes("contract") && m.includes("limit")) return "Nudge limit reached for this pact.";
  if (m.includes("daily")) return "Daily nudge limit reached.";
  if (m.includes("connection")) return "No active partner.";
  if (m.includes("complete a task")) return "Complete one task before checking in.";
  if (m.includes("already checked")) return "You already checked in today.";
  if (m.includes("too long")) return "That's a little too long.";
  if (m.includes("already asked")) return "You can ask for more detail only once.";
  if (m.includes("own proof")) return "You can't review your own proof.";
  if (m.includes("add a short note")) return "Add a short note first.";
  if (m.includes("another local day")) return "This pact is for another day.";
  if (m.includes("window closed")) return "The window for this pact has closed.";
  if (m.includes("recovery")) return "A comeback isn't available for this pact.";
  return "Something didn't go through. Please try again.";
}

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

export type AcctState = "NO_PACT" | "BEFORE_SESSION" | "STARTING" | "SESSION_LIVE" | "ENDING" | "PROOF_REQUIRED" | "PARTNER_REVIEW" | "AWAITING_REVIEW" | "MORE_DETAIL" | "VERIFIED" | "SELF_REPORTED" | "RECOVERED" | "RECOVERY_AVAILABLE" | "DISPUTED" | "CLOSED";

/** Pure derivation from server rows only. */
export function deriveState(c: ContractRow | null, live: boolean, proof: Proof | null, partnerPending: number, pending: "STARTING" | "ENDING" | null): AcctState {
  if (pending) return pending;
  if (live) return "SESSION_LIVE";
  if (c?.status === "proof_pending" && !proof) return "PROOF_REQUIRED";
  if (proof) {
    const r = proof.partner_review_status;
    if (r === "asked") return "MORE_DETAIL";
    if (r === "disputed") return "DISPUTED";
    if (partnerPending > 0) return "PARTNER_REVIEW";
    if (c?.is_recovery && (r === "confirmed" || r === "self_reported" || c.status === "rewarded" || c.status === "verified")) return "RECOVERED";
    if (r === "confirmed") return "VERIFIED";
    if (r === "pending") return "AWAITING_REVIEW";
    return "SELF_REPORTED";
  }
  if (partnerPending > 0) return "PARTNER_REVIEW";
  if (!c) return "NO_PACT";
  if (c.status === "scheduled") return "BEFORE_SESSION";
  if (c.status === "missed") return "RECOVERY_AVAILABLE";
  return "CLOSED";
}

function Ring({ session, now }: { session: SessionSnapshot; now: number }) {
  const total = Math.max(1, (session.expectedEndAt - session.startedAt) / 1000);
  const elapsed = Math.min(total, Math.max(0, (now - session.startedAt) / 1000));
  const remaining = Math.ceil(total - elapsed);
  const r = 70, C = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: "center" }}>
      <svg className="acct-ring" width="168" height="168" viewBox="0 0 168 168" role="img" aria-label={`${mmss(remaining)} remaining`}>
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--acct-line)" strokeWidth="8" />
        <circle className="prog" cx="84" cy="84" r={r} fill="none" stroke="var(--acct-accent)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - elapsed / total)} transform="rotate(-90 84 84)" />
        <text x="84" y="84" textAnchor="middle" fill="var(--acct-text)" style={{ font: "700 30px 'Space Grotesk', sans-serif" }}>{mmss(remaining)}</text>
        <text x="84" y="108" textAnchor="middle" fill="var(--acct-muted)" style={{ font: "600 12px Manrope, sans-serif" }}>remaining</text>
      </svg>
      <div className="acct-status" aria-live="polite">Session live · started {fmtTime(new Date(session.startedAt).toISOString())}</div>
    </div>
  );
}

export function AccountabilitySection() {
  const [me, setMe] = useState<MyAccountability | null | undefined>(undefined);
  const [details, setDetails] = useState<Details | null>(null);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [trust, setTrust] = useState<Trust | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [pending, setPending] = useState<"STARTING" | "ENDING" | null>(null);
  const [open, setOpen] = useState<"checkins" | "proofs" | "recovery" | "review" | null>(null);
  const [menu, setMenu] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [note, setNote] = useState("");
  const [commitment, setCommitment] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const mounted = useRef(false);
  const mkInvite = useServerFn(createInvite);
  const doAccept = useServerFn(acceptInvite);

  const load = useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const day = todayLocal();
      const [m, cRes, pRes, tRes, rRes, prof, recov] = await Promise.all([
        loadMyAccountability(),
        supabase.from("daily_contracts").select("*").eq("user_id", uid).eq("local_day", day).neq("status", "cancelled").order("created_at", { ascending: false }).limit(5),
        supabase.from("proof_submissions").select("id,contract_id,proof_type,created_at,partner_review_status,reviewed_at,review_note").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
        (supabase.rpc as any)("get_trust_summary"),
        (supabase.rpc as any)("get_partner_reviews"),
        supabase.from("profiles").select("streak").eq("id", uid).maybeSingle(),
        supabase.from("recovery_events").select("original_contract_id").eq("user_id", uid).limit(50),
      ]);
      if (!mounted.current) return;
      const list = (cRes.data ?? []) as ContractRow[];
      const c = list.find(x => x.is_recovery && x.status !== "missed") ?? list[0] ?? null;
      setContract(c);
      setProofs((pRes.data ?? []) as Proof[]);
      setTrust((tRes.data ?? null) as Trust | null);
      setReviews(((rRes.data ?? []) as Review[]));
      setStreak(prof.data?.streak ?? 0);
      setHasRecovery(!!c && (recov.data ?? []).some(r => r.original_contract_id === c.id));
      setSession(c && c.status === "active" ? await findActiveSession(c.id) : null);
      setMe(m); setErr(null);
      if (m) {
        const { data: d, error } = await (supabase.rpc as any)("send_accountability_nudge", { _connection_id: m.connection_id, _kind: "details", _message: null });
        if (error) throw error;
        if (mounted.current) { setDetails(d as Details); setCommitment((d as Details)?.my_commitment ?? ""); }
      } else { setDetails(null); }
    } catch {
      if (mounted.current) { setErr("Couldn't load accountability. Pull to refresh or try again."); setMe(m => m ?? null); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true; void load();
    const on = () => void load();
    window.addEventListener(NUDGE_EVENT, on); window.addEventListener("axen:contract-changed", on);
    return () => { mounted.current = false; window.removeEventListener(NUDGE_EVENT, on); window.removeEventListener("axen:contract-changed", on); localStorage.setItem(NUDGE_SEEN_KEY, String(Date.now())); };
  }, [load]);
  useEffect(() => { if (!session) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [session]);

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const changed = async () => { await load(); window.dispatchEvent(new Event("axen:contract-changed")); };

  const myProof = contract ? proofs.find(p => p.contract_id === contract.id) ?? null : null;
  const partnerPending = reviews.filter(r => r.review_status === "pending").length;
  const state = deriveState(contract, !!session, myProof, partnerPending, pending);

  const start = () => run(async () => {
    if (!contract) return;
    setPending("STARTING");
    try {
      const r = await startContractSession(contract);
      if (r.ok) { setSession(r.session); haptic("success"); }
      else {
        const existing = await findActiveSession(contract.id); // repeat tap / other device: reuse the one live session
        if (existing) setSession(existing); else toast.error(friendlyError(r.error));
      }
    } finally { setPending(null); await changed(); }
  });
  const endSession = () => run(async () => {
    if (!session) return;
    const early = Date.now() < session.expectedEndAt;
    if (early && !window.confirm("End early? The session will be saved as incomplete, and you can try again another time.")) return;
    setPending("ENDING");
    try {
      const r = await endContractSession(session.sessionId, early ? "user_ended" : "completed");
      if (!r.ok) toast.error(friendlyError(r.error)); else { setSession(null); haptic("success"); }
    } finally { setPending(null); await changed(); }
  });
  const review = (proofId: string, action: "verify" | "ask" | "cannot_verify") => run(async () => {
    const { error } = await (supabase.rpc as any)("partner_proof_action", { _proof_id: proofId, _action: action, _note: note.trim() || null });
    if (error) toast.error(friendlyError(error.message ?? ""));
    else { toast.success(action === "verify" ? "Confirmed. Thanks for being there." : action === "ask" ? "Asked for more detail" : "Marked as couldn't confirm"); setNote(""); haptic("success"); await changed(); }
  });
  const ownerAction = (action: "resubmit" | "resolve") => run(async () => {
    if (!myProof) return;
    const { error } = await (supabase.rpc as any)("partner_proof_action", { _proof_id: myProof.id, _action: action, _note: action === "resubmit" ? note.trim() : null });
    if (error) toast.error(friendlyError(error.message ?? "")); else { toast.success(action === "resubmit" ? "Detail sent to your partner" : "Marked as self-reported"); setNote(""); await changed(); }
  });
  const comeback = () => run(async () => {
    if (!contract) return;
    const { error } = await (supabase.rpc as any)("start_recovery", { _original_id: contract.id, _reason: null });
    if (error) toast.error(friendlyError(error.message ?? "")); else { toast.success("Comeback ready. Start when you are."); await changed(); }
  });
  const invite = () => run(async () => { const r = await mkInvite(); if (r.ok) { setCode(r.code); haptic("success"); } else toast.error(r.message); });
  const join = () => run(async () => {
    const r = await doAccept({ data: { code: entry } });
    if (r.ok) { toast.success("Partner connected"); setEntry(""); haptic("success"); await changed(); } else toast.error(r.message);
  });
  const setPref = (p: { _share?: boolean; _mute?: boolean }) => run(async () => {
    const { error } = await (supabase.rpc as any)("set_accountability_prefs", p);
    if (error) toast.error("Could not save"); else await changed();
  });
  const send = (kind: "nudge" | "emergency" | "checkin" | "commitment", message: string | null) => run(async () => {
    if (!me) return;
    const { error } = await (supabase.rpc as any)("send_accountability_nudge", { _connection_id: me.connection_id, _kind: kind, _message: message });
    if (error) toast.error(friendlyError(error.message ?? ""));
    else { toast.success(kind === "commitment" ? "Commitment saved" : kind === "checkin" ? "Check-in sent" : "Nudge sent"); haptic("success"); await load(); window.dispatchEvent(new Event(NUDGE_EVENT)); }
  });
  const endPartner = (block: boolean) => run(async () => {
    if (!me) return;
    if (!window.confirm(block ? "Block and report this partner? They lose access right away and can't see future proof." : "Remove your partner? They lose access right away.")) return;
    const { error } = await (supabase.rpc as any)("revoke_accountability_connection", { _connection_id: me.connection_id, _block: block });
    if (error) toast.error("Could not update"); else { setMenu(false); toast.success(block ? "Partner blocked" : "Partner removed"); await changed(); }
  });

  if (me === undefined) return <section className="acct" aria-label="Accountability" aria-busy="true"><h2 className="acct-title">Accountability</h2><div className="acct-sub">Loading…</div></section>;

  const name = me ? safeName(me.partner_name, "Partner") : null;
  const minutes = contract ? Math.round(contract.planned_seconds / 60) : 0;
  const trustChip = trust?.score != null ? { v: String(trust.score), l: "Trust" } : { v: "Building", l: "Trust" };

  let primary: React.ReactNode = null;
  let statusLine: React.ReactNode = null;
  switch (state) {
    case "BEFORE_SESSION": primary = <button className="acct-btn" onClick={() => void start()} disabled={busy}>Start proof session</button>; break;
    case "STARTING": primary = <button className="acct-btn" disabled aria-busy="true">Starting…</button>; break;
    case "SESSION_LIVE": primary = <button className="acct-btn" onClick={() => void endSession()} disabled={busy}>{session && now >= session.expectedEndAt ? "Finish session" : "End session"}</button>; break;
    case "ENDING": primary = <button className="acct-btn" disabled aria-busy="true">Saving…</button>; break;
    case "PROOF_REQUIRED":
      statusLine = <><div className="acct-status">{PROOF_LABEL.recorded.label}</div><div className="acct-sub">{PROOF_LABEL.recorded.help}</div></>;
      primary = <button className="acct-btn" onClick={() => setProofOpen(true)} disabled={busy}>Submit proof</button>; break;
    case "PARTNER_REVIEW": primary = <button className="acct-btn" onClick={() => setOpen("review")}>Review proof</button>; break;
    case "AWAITING_REVIEW": statusLine = <><div className="acct-status">{PROOF_LABEL.pending.label}</div><div className="acct-sub">{PROOF_LABEL.pending.help}</div></>; break;
    case "MORE_DETAIL":
      statusLine = <><div className="acct-status">{PROOF_LABEL.asked.label}</div><div className="acct-sub">{myProof?.review_note ? `“${myProof.review_note}”` : PROOF_LABEL.asked.help}</div>
        <label className="acct-sub" style={{ display: "block", marginTop: 10 }}>Add a short note<textarea className="acct-input" rows={2} maxLength={280} value={note} onChange={e => setNote(e.target.value)} /></label></>;
      primary = <button className="acct-btn" onClick={() => void ownerAction("resubmit")} disabled={busy || note.trim().length < 3}>Send more detail</button>; break;
    case "DISPUTED":
      statusLine = <><div className="acct-status">{PROOF_LABEL.disputed.label}</div><div className="acct-sub">{PROOF_LABEL.disputed.help}</div></>;
      primary = <button className="acct-btn ghost" onClick={() => void ownerAction("resolve")} disabled={busy}>Mark as self-reported</button>; break;
    case "VERIFIED": statusLine = <><div className="acct-status">{PROOF_LABEL.confirmed.label}</div><div className="acct-sub">Confirmed {myProof?.reviewed_at ? fmtWhen(myProof.reviewed_at) : ""}. Nice work today.</div></>; break;
    case "SELF_REPORTED": statusLine = <><div className="acct-status">{PROOF_LABEL.self_reported.label}</div><div className="acct-sub">{PROOF_LABEL.self_reported.help}</div></>; break;
    case "RECOVERED": statusLine = <><div className="acct-status">{PROOF_LABEL.recovered.label}</div><div className="acct-sub">{PROOF_LABEL.recovered.help}</div></>; break;
    case "RECOVERY_AVAILABLE":
      statusLine = <div className="acct-sub">{hasRecovery ? "You already used the comeback for this pact. Tomorrow is a fresh start." : "Missed the window? Make a comeback with a short focused session."}</div>;
      if (!hasRecovery) primary = <button className="acct-btn" onClick={() => void comeback()} disabled={busy}>Start comeback</button>; break;
    case "NO_PACT": statusLine = <div className="acct-sub">No pact today. Set one from Home whenever you're ready.</div>; break;
    default: statusLine = <div className="acct-sub">Today's pact is closed. See you tomorrow.</div>;
  }

  const rowMeta = {
    checkins: details?.checked_in_today ? "Checked in" : me ? "Open" : "No partner",
    proofs: `${proofs.filter(p => p.partner_review_status === "confirmed").length} confirmed`,
    recovery: contract?.status === "missed" && !hasRecovery ? "Available" : "Not needed",
  };

  return (
    <section className="acct" aria-label="Accountability">
      <div className="acct-head" style={{ position: "relative" }}>
        <div>
          <div className="acct-label">AXEN</div>
          <h2 className="acct-title">Accountability</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span className="acct-pill" data-on={!!contract && !["missed", "cancelled"].includes(contract.status)}>{contract ? "Pact active" : "No active pact"}</span>
            {name && <span className="acct-pill">With {name}</span>}
          </div>
        </div>
        {me && <button className="acct-btn ghost" style={{ width: 48, minHeight: 48, marginTop: 0, padding: 0 }} aria-label="More options" aria-expanded={menu} onClick={() => setMenu(v => !v)}><MoreHorizontal size={20} /></button>}
        {menu && me && (
          <div className="acct-menu" role="menu">
            <label>Share my pact progress<input type="checkbox" checked={me.my_sharing} disabled={busy} onChange={e => void setPref({ _share: e.target.checked })} /></label>
            <label>Mute nudges<input type="checkbox" checked={me.i_muted} disabled={busy} onChange={e => void setPref({ _mute: e.target.checked })} /></label>
            <button role="menuitem" onClick={() => void endPartner(false)} disabled={busy}>Remove partner</button>
            <button role="menuitem" style={{ color: "#FF9B9B" }} onClick={() => void endPartner(true)} disabled={busy}>Block & report</button>
          </div>
        )}
      </div>
      {err && <div role="alert" className="acct-sub">{err}</div>}

      <div className="acct-hero">
        <div className="acct-label">{contract?.is_recovery ? "Today's comeback" : "Today's pact"}</div>
        {contract ? <>
          <div className="acct-pact">{contract.title} · {minutes} min</div>
          <div className="acct-sub">{fmtTime(contract.scheduled_at)}{name ? ` · with ${name}` : " · private"}</div>
          {state === "BEFORE_SESSION" && <div className="acct-sub">Success means a {minutes}-minute focused session.</div>}
        </> : <div className="acct-pact" style={{ fontSize: 18 }}>Nothing planned yet</div>}
        {session && state === "SESSION_LIVE" && <Ring session={session} now={now} />}
        {statusLine}
        {primary}
      </div>

      <div className="acct-chips">
        <div className="acct-chip"><strong className="acct-num">{streak > 0 ? streak : "—"}</strong><span>{streak > 0 ? "Day streak" : "Streak building"}</span></div>
        <div className="acct-chip"><strong className="acct-num">{partnerPending}</strong><span>{partnerPending === 1 ? "Pending review" : "Pending reviews"}</span></div>
        <button className="acct-chip" style={{ color: "inherit", cursor: "pointer", font: "inherit" }} onClick={() => setWhyOpen(v => !v)} aria-expanded={whyOpen} aria-label={`Trust ${trustChip.v}. Why?`}>
          <strong className="acct-num">{trustChip.v}</strong><span>{trustChip.l} · why?</span>
        </button>
      </div>
      {whyOpen && trust && (
        <div className="acct-hero" style={{ marginTop: 10 }} aria-live="polite">
          <div className="acct-label">How trust works</div>
          {trust.score == null
            ? <div className="acct-sub">Still building trust — a number appears after {trust.threshold} partner-reviewed sessions ({trust.reviewed} so far).</div>
            : <div className="acct-sub">Based on how many of your reviewed sessions your partner confirmed, with a small bonus for starting on time and a small dip for sessions ended early.</div>}
          <div className="acct-sub">Last 60 days: {trust.confirmed} confirmed · {trust.recoveries} {trust.recoveries === 1 ? "comeback" : "comebacks"} · {trust.disputed} disputed · {trust.on_time} on time. Older history stops counting, so it's always possible to rebuild.</div>
        </div>
      )}

      {open === "review" && (
        <div className="acct-panel" aria-label="Partner review">
          {reviews.filter(r => r.review_status === "pending").map(r => (
            <div key={r.proof_id} className="acct-item">
              <div style={{ fontWeight: 700 }}>{safeName(r.owner_name, "Partner")} · {r.title}</div>
              <div className="acct-sub">{PROOF_LABEL.pending.label} {fmtWhen(r.submitted_at)} · session {r.elapsed_minutes}/{r.planned_minutes} min · {r.proof_type.replace("_", " ")}</div>
              {r.evidence && <div className="acct-sub" style={{ color: "var(--acct-text)" }}>“{r.evidence}”</div>}
              <label className="acct-sub" style={{ display: "block", marginTop: 8 }}>Optional note<input className="acct-input" maxLength={280} value={note} onChange={e => setNote(e.target.value)} /></label>
              <button className="acct-btn" onClick={() => void review(r.proof_id, "verify")} disabled={busy}>Verify</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="acct-btn ghost" onClick={() => void review(r.proof_id, "ask")} disabled={busy || r.asked_once}>{r.asked_once ? "Already asked" : "Ask once"}</button>
                <button className="acct-btn ghost" onClick={() => void review(r.proof_id, "cannot_verify")} disabled={busy}>Can't verify</button>
              </div>
            </div>
          ))}
          {partnerPending === 0 && <div className="acct-sub">Nothing to review right now.</div>}
        </div>
      )}

      {!me && (
        <div className="acct-hero">
          <div className="acct-label">Add a partner</div>
          <div className="acct-sub">One partner, private by default. They review only proof you submit — never your notes, coins or full history.</div>
          {code ? <>
            <div className="acct-sub">Share this one-time code (valid 24 hours):</div>
            <div style={{ fontSize: 15, marginTop: 6, wordBreak: "break-all" }} aria-label="Invite code">{code}</div>
            <button className="acct-btn ghost" onClick={() => { void navigator.clipboard?.writeText(code).then(() => toast.success("Copied")); }}>Copy code</button>
          </> : <button className="acct-btn" onClick={() => void invite()} disabled={busy}>Create invite</button>}
          <label className="acct-sub" style={{ display: "block", marginTop: 14 }}>Enter partner's code<input className="acct-input" aria-label="Partner code" value={entry} onChange={e => setEntry(e.target.value)} maxLength={40} /></label>
          <button className="acct-btn ghost" onClick={() => void join()} disabled={busy || entry.trim().length < 8}>Join</button>
        </div>
      )}

      {([["checkins", "Check-ins"], ["proofs", "Proof history"], ["recovery", "Recovery"]] as const).map(([k, label]) => (
        <div key={k}>
          <button className="acct-row" aria-expanded={open === k} onClick={() => setOpen(o => o === k ? null : k)}>
            <span>{label}</span><small>{rowMeta[k]}</small>
          </button>
          {open === k && k === "checkins" && (
            <div className="acct-panel">
              {!me ? <div className="acct-sub">Connect a partner to check in together.</div> : <>
                <button className="acct-btn ghost" onClick={() => void send("checkin", null)} disabled={busy || !details?.can_check_in || details.checked_in_today}>{details?.checked_in_today ? "Checked in today" : "Aaj ka task kiya"}</button>
                <div className="acct-item">
                  <div className="acct-label">{name}'s week</div>
                  <div className="acct-sub">{details?.partner_streak ?? 0}-day streak · {details?.partner_weekly_coins ?? 0} coins · {details?.partner_weekly_tasks ?? 0} tasks</div>
                </div>
                <div className="acct-item">
                  <div className="acct-label">Our contract</div>
                  <textarea className="acct-input" aria-label="My commitment" rows={2} maxLength={100} value={commitment} onChange={e => setCommitment(e.target.value)} />
                  <div className="acct-sub" style={{ textAlign: "right" }}>{commitment.length}/100</div>
                  <button className="acct-btn ghost" onClick={() => void send("commitment", commitment)} disabled={busy || commitment === (details?.my_commitment ?? "")}>Save commitment</button>
                  <div className="acct-sub">{name}: {details?.partner_commitment || "No commitment yet."}</div>
                </div>
                <div className="acct-item">
                  <div className="acct-label">Send a nudge</div>
                  {NUDGES.map((m, i) => <button key={m} className="acct-btn ghost" aria-label={m} onClick={() => void send("nudge", m)} disabled={busy}>{NUDGE_TEXT[i]}</button>)}
                  <button className="acct-btn ghost danger" onClick={() => void send("emergency", null)} disabled={busy}>Emergency nudge</button>
                </div>
              </>}
            </div>
          )}
          {open === k && k === "proofs" && (
            <div className="acct-panel">
              {proofs.length === 0 && <div className="acct-sub">No proof yet. Your first session will show up here.</div>}
              {proofs.map(p => {
                const l = PROOF_LABEL[p.partner_review_status ?? "self_reported"] ?? PROOF_LABEL.self_reported;
                return <div key={p.id} className="acct-item"><div style={{ fontWeight: 600 }}>{l.label}</div><div className="acct-sub">{fmtWhen(p.created_at)} · {p.proof_type.replace("_", " ")}{p.reviewed_at ? ` · reviewed ${fmtWhen(p.reviewed_at)}` : ""}</div></div>;
              })}
            </div>
          )}
          {open === k && k === "recovery" && (
            <div className="acct-panel"><div className="acct-sub">
              {contract?.status === "missed" && !hasRecovery ? "Missed the window? Start again with a 15 minutes focused session — use the button above." : "Comebacks are 15 minutes and appear here when a pact is missed. They're labelled Recovered, never perfect, and there's no penalty."}
            </div></div>
          )}
        </div>
      ))}

      {proofOpen && contract && <ContractProofSheet contract={contract} onClose={() => setProofOpen(false)} onDone={() => { setProofOpen(false); void changed(); }} />}
    </section>
  );
}

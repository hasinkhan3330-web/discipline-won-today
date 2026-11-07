import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Flame, ChevronRight, Plus, Moon, Sun } from "lucide-react";
import s from "./acct/acct.module.css";
import { ARing, Tree, WeekStrip, SubHeader, weekDays, ymd } from "./acct/AcctUI";
import { CheckinScreen, GardenScreen, MilestoneCelebration, PactCreator, ReportScreen, TrustWhy, type Garden } from "./acct/AcctScreens";
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
  if (c?.is_recovery && c.status === "rewarded") return "RECOVERED";
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
  type View = "home" | "creator" | "review" | "recovery" | "checkin" | "garden" | "report" | "proofs" | "partner";
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [coins, setCoins] = useState(0);
  const [weekMap, setWeekMap] = useState<Record<string, "done" | "missed" | "planned">>({});
  const [garden, setGarden] = useState<Garden | null>(null);
  const [partnerStage, setPartnerStage] = useState<{ stage: number; stage_name: string } | null>(null);
  const [pair, setPair] = useState<{ streak: number; milestone: number | null } | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [partnerCheck, setPartnerCheck] = useState<{ checked_in: boolean; completed: boolean } | null>(null);
  const [todayList, setTodayList] = useState<ContractRow[]>([]);
  const [celebrate, setCelebrate] = useState<number | null>(null);
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
      const { error: comebackError } = await supabase.rpc("check_my_comebacks");
      if (comebackError) throw comebackError;
      const [m, cRes, pRes, tRes, rRes, prof, recov] = await Promise.all([
        loadMyAccountability(),
        supabase.from("daily_contracts").select("*").eq("user_id", uid).eq("local_day", day).neq("status", "cancelled").order("created_at", { ascending: false }).limit(5),
        supabase.from("proof_submissions").select("id,contract_id,proof_type,created_at,partner_review_status,reviewed_at,review_note").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
        (supabase.rpc as any)("get_trust_summary"),
        (supabase.rpc as any)("get_partner_reviews"),
        supabase.from("profiles").select("streak,coins").eq("id", uid).maybeSingle(),
        supabase.from("recovery_events").select("original_contract_id").eq("user_id", uid).limit(50),
      ]);
      if (!mounted.current) return;
      const list = (cRes.data ?? []) as ContractRow[];
      setTodayList(list.filter(x => !x.is_recovery));
      setCoins((prof.data as any)?.coins ?? 0);
      // secondary panels: failures here never block the main screen
      const t = new Date(); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      void Promise.all([
        supabase.from("daily_contracts").select("local_day,status,is_recovery").eq("user_id", uid).gte("local_day", ymd(mon)).lte("local_day", ymd(sun)).neq("status", "cancelled"),
        supabase.rpc("acct_garden_score"), supabase.rpc("acct_partner_garden_stage"), supabase.rpc("acct_pair_streak"),
        supabase.from("acct_settings").select("show_tree").eq("user_id", uid).maybeSingle(), supabase.rpc("acct_partner_checkin_status"),
      ]).then(([wk, g, pg, ps, st, pc]) => {
        if (!mounted.current) return;
        const m: Record<string, "done" | "missed" | "planned"> = {};
        for (const r of (wk.data ?? []) as any[]) {
          const v = ["verified", "rewarded"].includes(r.status) ? "done" : r.status === "missed" ? "missed" : "planned";
          if (m[r.local_day] !== "done") m[r.local_day] = v === "missed" && m[r.local_day] ? m[r.local_day] : v;
        }
        setWeekMap(m);
        setGarden((g.data as any) ?? null); setPartnerStage((pg.data as any) ?? null);
        const p = (ps.data as any) ?? null; setPair(p);
        if (p?.milestone) setCelebrate(p.milestone);
        setShowTree(st.data ? !!st.data.show_tree : true); setPartnerCheck((pc.data as any) ?? null);
      }).catch(() => {});
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
    try {
      if (localStorage.getItem("axen.acct.theme") === "dark") setTheme("dark");
      const q = new URLSearchParams(window.location.search).get("acct_code") ?? sessionStorage.getItem("axen.acct.code");
      if (q) { setEntry(q.replace(/[^0-9A-Fa-f]/g, "").slice(0, 32)); sessionStorage.removeItem("axen.acct.code"); }
    } catch { /* storage unavailable */ }
    const on = () => void load();
    window.addEventListener(NUDGE_EVENT, on); window.addEventListener("axen:contract-changed", on);
    return () => { mounted.current = false; window.removeEventListener(NUDGE_EVENT, on); window.removeEventListener("axen:contract-changed", on); localStorage.setItem(NUDGE_SEEN_KEY, String(Date.now())); };
  }, [load]);
  const dueRef = useRef<string | null>(null);
  useEffect(() => { // comeback timer reached its server end time: let the server finalize it
    const end = contract?.comeback_ends_at ? new Date(contract.comeback_ends_at).getTime() : 0;
    if (contract?.is_recovery && session && end && now >= end && dueRef.current !== contract.id) { dueRef.current = contract.id; void changed(); }
  }, [now, contract, session]);
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

  const [invitePending, setInvitePending] = useState<string | null>(null);
  useEffect(() => {
    if (me !== null) return;
    void supabase.from("accountability_invites").select("expires_at").is("accepted_at", null).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (mounted.current) setInvitePending(data?.[0]?.expires_at ?? null); });
  }, [me, code]);

  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => { rootRef.current?.scrollIntoView?.({ block: "start" }); }, [view]);
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); try { localStorage.setItem("axen.acct.theme", t); } catch { /* ignore */ } };
  const saveShowTree = async (v: boolean) => {
    setShowTree(v);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("acct_settings").upsert({ user_id: u.user?.id, show_tree: v, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { setShowTree(!v); toast.error("Could not save"); }
  };
  const closeMilestone = async () => {
    const m = celebrate; setCelebrate(null);
    if (m) await supabase.from("acct_milestones_seen").insert({ kind: "pair_streak", milestone: m });
  };
  const revokeInvite = () => run(async () => {
    const { error } = await supabase.rpc("acct_revoke_my_invites");
    if (error) toast.error("Could not revoke"); else { setCode(null); setInvitePending(null); toast.success("Invite revoked"); }
  });
  const shareInvite = async () => {
    if (!code) return;
    const link = `${window.location.origin}/dashboard?acct_code=${code}`;
    const text = `Be my AXEN accountability partner. Open You → Accountability and enter code ${code} (valid 24 hours): ${link}`;
    const nav = navigator as any;
    if (nav.share) { try { await nav.share({ text }); } catch { /* cancelled */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const setPaused = (paused: boolean) => run(async () => {
    if (!contract) return;
    const { data, error } = await supabase.from("daily_contracts").update({ paused_at: paused ? new Date().toISOString() : null }).eq("id", contract.id).select("id").maybeSingle();
    if (error || !data) toast.error("This pact can't be paused now."); else { toast.success(paused ? "Pact paused" : "Pact resumed"); await changed(); }
  });
  const endPact = () => run(async () => {
    if (!contract || !window.confirm("End this pact? This can't be undone.")) return;
    const { data, error } = await supabase.from("daily_contracts").update({ status: "cancelled" }).eq("id", contract.id).select("id").maybeSingle();
    if (error || !data) toast.error("This pact can't be ended now."); else { toast.success("Pact ended"); await changed(); }
  });

  const rootStyle = { "--acct-line": "var(--a-border)", "--acct-accent": "var(--a-ring)", "--acct-text": "var(--a-text)", "--acct-muted": "var(--a-muted)" } as React.CSSProperties;
  const shellProps = { ref: rootRef, className: s.root, "data-theme": theme, style: rootStyle, "aria-label": "Accountability" } as const;

  if (me === undefined) return <section {...shellProps}><div className={s.head}><h2 className={s.title}>Accountability</h2></div><div aria-busy="true"><div className={s.skel} style={{ height: 44 }} /><div className={s.skel} style={{ height: 130 }} /><div className={s.skel} /><div className={s.skel} /></div></section>;

  const name = me ? safeName(me.partner_name, "Partner") : null;
  const minutes = contract ? Math.round(contract.planned_seconds / 60) : 0;
  const doneToday = todayList.filter(c => ["verified", "rewarded"].includes(c.status)).length;
  const totalToday = todayList.length;
  const trustLabel = trust?.score == null ? "Building" : trust.score >= 80 ? "Reliable" : trust.score >= 50 ? "Steady" : "Growing";
  const back = () => setView("home");

  let primary: React.ReactNode = null;
  let statusLine: React.ReactNode = null;
  const btn = s.btn, ghost = `${s.btn} ${s.ghost}`;
  switch (state) {
    case "BEFORE_SESSION": primary = <button className={btn} onClick={() => void start()} disabled={busy || !!contract?.paused_at}>Start session</button>; break;
    case "STARTING": primary = <button className={btn} disabled aria-busy="true">Starting…</button>; break;
    case "SESSION_LIVE": primary = <button className={btn} onClick={() => void endSession()} disabled={busy}>{session && now >= session.expectedEndAt ? "Finish session" : "End session"}</button>; break;
    case "ENDING": primary = <button className={btn} disabled aria-busy="true">Saving…</button>; break;
    case "PROOF_REQUIRED":
      statusLine = <div className={s.muted}>{PROOF_LABEL.recorded.label}. {PROOF_LABEL.recorded.help}</div>;
      primary = <button className={btn} onClick={() => setProofOpen(true)} disabled={busy}>Submit proof</button>; break;
    case "PARTNER_REVIEW": primary = <button className={btn} onClick={() => setView("review")}>Review proof</button>; break;
    case "AWAITING_REVIEW": statusLine = <div className={s.muted}>{PROOF_LABEL.pending.label}. {PROOF_LABEL.pending.help} A slow review never counts against you.</div>; break;
    case "MORE_DETAIL":
      statusLine = <><div className={s.muted}>{PROOF_LABEL.asked.label}{myProof?.review_note ? `: “${myProof.review_note}”` : ""}</div>
        <label className={s.field}><span className={s.label}>Add a short note</span><textarea className={s.input} rows={2} maxLength={280} value={note} onChange={e => setNote(e.target.value)} /></label></>;
      primary = <button className={btn} onClick={() => void ownerAction("resubmit")} disabled={busy || note.trim().length < 3}>Send more detail</button>; break;
    case "DISPUTED":
      statusLine = <div className={s.muted}>{PROOF_LABEL.disputed.label}. {PROOF_LABEL.disputed.help}</div>;
      primary = <button className={ghost} onClick={() => void ownerAction("resolve")} disabled={busy}>Mark as self-reported</button>; break;
    case "VERIFIED": statusLine = <div className={s.green}>{PROOF_LABEL.confirmed.label}{myProof?.reviewed_at ? ` · ${fmtWhen(myProof.reviewed_at)}` : ""}</div>; break;
    case "SELF_REPORTED": statusLine = <div className={s.muted}>{PROOF_LABEL.self_reported.label}. {PROOF_LABEL.self_reported.help}</div>; break;
    case "RECOVERED": statusLine = <div className={s.green}>Recovered{contract?.status === "rewarded" && contract.is_recovery ? ` · +${contract.xp_awarded} XP · +${contract.coins_awarded} coins` : ""}</div>; break;
    case "RECOVERY_AVAILABLE":
      statusLine = <div className={s.muted}>Progress isn't perfection. Let's make your next step easier.</div>;
      primary = <button className={btn} onClick={() => setView("recovery")}>See recovery options</button>; break;
    case "NO_PACT": break;
    default: statusLine = <div className={s.muted}>Today's pact is closed. See you tomorrow.</div>;
  }

  const header = (
    <div className={s.head}>
      <h2 className={s.title}>Accountability</h2>
      <div className={s.chips}>
        <span className={s.chip} aria-label={`${streak} day streak`}><Flame size={13} />{streak}</span>
        <button className={s.iconBtn} aria-label="More options" aria-expanded={menu} onClick={() => setMenu(v => !v)}><MoreHorizontal size={16} /></button>
      </div>
      {menu && (
        <div className={s.menu} role="menu">
          <button role="menuitem" onClick={() => { setMenu(false); setView("report"); }}>Weekly report<ChevronRight size={15} /></button>
          <button role="menuitem" onClick={toggleTheme}>{theme === "dark" ? "Light theme" : "Dark theme"}{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
          <label>Show my tree to my partner<input type="checkbox" checked={showTree} onChange={e => void saveShowTree(e.target.checked)} /></label>
          {me && <>
            <label>Share my pact progress<input type="checkbox" checked={me.my_sharing} disabled={busy} onChange={e => void setPref({ _share: e.target.checked })} /></label>
            <label>Mute nudges<input type="checkbox" checked={me.i_muted} disabled={busy} onChange={e => void setPref({ _mute: e.target.checked })} /></label>
            <button role="menuitem" onClick={() => void endPartner(false)} disabled={busy}>Remove partner</button>
            <button role="menuitem" className={s.danger} onClick={() => void endPartner(true)} disabled={busy}>Block & report</button>
          </>}
        </div>
      )}
    </div>
  );

  const proofSheet = proofOpen && contract && <ContractProofSheet contract={contract} onClose={() => setProofOpen(false)} onDone={() => { setProofOpen(false); void changed(); }} />;

  if (view === "creator") return <section {...shellProps}><PactCreator hasPartner={!!me} onBack={back} onSaved={() => { back(); void load(); }} /></section>;
  if (view === "checkin") return <section {...shellProps}><CheckinScreen hasPartner={!!me} onBack={back} onDone={() => { back(); void load(); }} /></section>;
  if (view === "garden") return <section {...shellProps}><GardenScreen garden={garden} partnerStage={partnerStage} showTree={showTree} onToggleShow={v => void saveShowTree(v)} onBack={back} /></section>;
  if (view === "report") return <section {...shellProps}><ReportScreen trust={trust} onBack={back} /></section>;

  if (view === "review") {
    const pend = reviews.filter(r => r.review_status === "pending");
    const hist = reviews.filter(r => r.review_status !== "pending");
    return <section {...shellProps}>
      <SubHeader title="Review center" onBack={back} right={pend.length ? <span className={`${s.chip} ${s.chipWarn}`}>{pend.length} pending</span> : undefined} />
      {!me && <div className={s.card} role="alert">Connect a partner to review proof.</div>}
      {pend.map(r => (
        <div key={r.proof_id} className={s.card}>
          <div className={s.partner}><div className={s.avatar}>{safeName(r.owner_name, "P").slice(0, 1)}</div>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{safeName(r.owner_name, "Partner")}</div><div className={s.muted}>{r.title} · {fmtWhen(r.submitted_at)}</div></div></div>
          <div className={s.evidence}>Session {r.elapsed_minutes}/{r.planned_minutes} min · {r.proof_type.replace("_", " ")}{r.evidence ? <><br />“{r.evidence}”</> : null}</div>
          <div className={s.muted} style={{ marginTop: 6 }}>Hint only — you decide.</div>
          <label className={s.field}><span className={s.label}>Note or clarification question</span><input className={s.input} maxLength={280} value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className={s.stack}>
            <button className={btn} onClick={() => void review(r.proof_id, "verify")} disabled={busy}>Approve</button>
            <div className={s.row2} style={{ marginTop: 0 }}>
              <button className={ghost} onClick={() => void review(r.proof_id, "ask")} disabled={busy || r.asked_once || note.trim().length < 3}>{r.asked_once ? "Already asked" : "Ask clarification"}</button>
              <button className={ghost} onClick={() => void review(r.proof_id, "cannot_verify")} disabled={busy}>Can't verify</button>
            </div>
          </div>
        </div>
      ))}
      {me && pend.length === 0 && <div className={s.card}><div className={s.muted}>Nothing to review right now.</div></div>}
      {hist.length > 0 && <div className={`${s.card} ${s.list}`}>{hist.map(r => <div key={r.proof_id} className={s.listRow} style={{ cursor: "default" }}><span>{r.title}</span><small>{PROOF_LABEL[r.review_status]?.label ?? r.review_status}</small></div>)}</div>}
    </section>;
  }

  if (view === "proofs") return <section {...shellProps}>
    <SubHeader title="Proof history" onBack={back} />
    <div className={`${s.card} ${s.list}`}>
      {proofs.length === 0 && <div className={s.muted} style={{ padding: "13px 0" }}>No proof yet. Your first session will show up here.</div>}
      {proofs.map(p => { const l = PROOF_LABEL[p.partner_review_status ?? "self_reported"] ?? PROOF_LABEL.self_reported;
        return <div key={p.id} className={s.listRow} style={{ cursor: "default" }}><span>{l.label}<div className={s.muted}>{fmtWhen(p.created_at)} · {p.proof_type.replace("_", " ")}</div></span><small>{p.reviewed_at ? "Reviewed" : ""}</small></div>; })}
    </div>
    <div className={s.muted}>Your partner sees only proof you submit.</div>
  </section>;

  if (view === "recovery") return <section {...shellProps}>
    <SubHeader title="Recovery" onBack={back} />
    <div className={s.card}><div className={s.big}>Progress isn't perfection. Let's make your next step easier.</div><div className={s.muted}>Recovered pacts are labelled Recovered and counted separately. Your achievements are safe.</div></div>
    <div className={`${s.card} ${s.list}`}>
      {contract?.status === "missed" && !hasRecovery
        ? <button className={s.listRow} onClick={() => void comeback()} disabled={busy}><span>15-minute Comeback</span><small>Start <ChevronRight size={14} /></small></button>
        : <div className={s.listRow} style={{ cursor: "default" }}><span>15-minute Comeback</span><small>{hasRecovery ? "Used for this pact" : "Not needed"}</small></div>}
      <button className={s.listRow} onClick={() => setView("creator")}><span>Reschedule</span><small>New pact <ChevronRight size={14} /></small></button>
      {contract && ["draft", "scheduled"].includes(contract.status) && <button className={s.listRow} onClick={() => void setPaused(!contract.paused_at)} disabled={busy}><span>{contract.paused_at ? "Resume the pact" : "Pause the pact"}</span><small><ChevronRight size={14} /></small></button>}
    </div>
  </section>;

  if (view === "partner") return <section {...shellProps}>
    <SubHeader title="Check-ins" onBack={back} />
    <button className={btn} onClick={() => setView("checkin")}>Daily check-in</button>
    {me && <div className={s.card} style={{ marginTop: 10 }}>
      <button className={ghost} onClick={() => void send("checkin", null)} disabled={busy || !details?.can_check_in || details.checked_in_today}>{details?.checked_in_today ? "Told partner today" : "Aaj ka task kiya"}</button>
      <div className={s.item} style={{ marginTop: 12 }}><span className={s.label}>{name}'s week</span><div>{details?.partner_streak ?? 0}-day streak · {details?.partner_weekly_tasks ?? 0} tasks</div></div>
      <div className={s.item}><span className={s.label}>Our contract</span>
        <textarea className={s.input} aria-label="My commitment" rows={2} maxLength={100} value={commitment} onChange={e => setCommitment(e.target.value)} />
        <div className={s.muted} style={{ textAlign: "right" }}>{commitment.length}/100</div>
        <button className={ghost} onClick={() => void send("commitment", commitment)} disabled={busy || commitment === (details?.my_commitment ?? "")}>Save commitment</button>
        <div className={s.muted} style={{ marginTop: 6 }}>{name}: {details?.partner_commitment || "No commitment yet."}</div></div>
      <div className={s.item}><span className={s.label}>Send a nudge</span><div className={s.stack} style={{ marginTop: 0 }}>
        {NUDGES.map((m, i) => <button key={m} className={ghost} aria-label={m} onClick={() => void send("nudge", m)} disabled={busy}>{NUDGE_TEXT[i]}</button>)}
        <button className={`${ghost} ${s.danger}`} onClick={() => void send("emergency", null)} disabled={busy}>Emergency nudge</button></div></div>
    </div>}
  </section>;

  return (
    <section {...shellProps}>
      {header}
      {err && <div role="alert" className={s.card}>{err}</div>}
      <WeekStrip days={weekDays(new Date(), weekMap)} />

      <div className={s.card}>
        <div className={s.todayCard}>
          <ARing size={92} stroke={9} value={totalToday ? doneToday / totalToday : 0} label={`${doneToday} of ${totalToday} pacts done`}><span style={{ fontSize: 22, fontWeight: 500 }}>{doneToday}/{totalToday}</span></ARing>
          <div className={s.todayCopy}>
            {contract ? <>
              <div className={s.muted}>{contract.is_recovery ? "Today's comeback" : "Today's pacts"}</div>
              <div className={s.big}>{contract.title}</div>
              <div className={s.chips} style={{ justifyContent: "flex-start" }}>
                <span className={`${s.chip} ${s.chipWarn}`}>{(contract as any).deadline_at ? `Due ${fmtTime((contract as any).deadline_at)}` : "No deadline"}</span>
                {contract.paused_at && <span className={s.chip}>Paused</span>}
                {contract.is_recovery && contract.status === "rewarded" && <span className={`${s.chip} ${s.chipOk}`}>Recovered</span>}
              </div>
            </> : <>
              <div className={s.muted}>Today's pacts</div>
              <div className={s.big}>Nothing planned yet</div>
            </>}
          </div>
        </div>
        {contract && session && state === "SESSION_LIVE" && <Ring session={contract.is_recovery && contract.comeback_started_at && contract.comeback_ends_at ? { ...session, startedAt: new Date(contract.comeback_started_at).getTime(), expectedEndAt: new Date(contract.comeback_ends_at).getTime() } : session} now={now} />}
        {contract?.minimum_version && state === "BEFORE_SESSION" && <div className={s.muted} style={{ marginTop: 8 }}>Minimum version: {contract.minimum_version}</div>}
        {contract && statusLine && <div style={{ marginTop: 8 }}>{statusLine}</div>}
        <div className={s.row2}>
          {!contract ? <button className={btn} onClick={() => setView("creator")}>Create a pact</button>
            : primary ?? <button className={btn} disabled>Start session</button>}
          <button className={ghost} onClick={() => setView("checkin")}>Check in</button>
        </div>
        {contract && ["draft", "scheduled"].includes(contract.status) && !contract.is_recovery && <div className={s.row2}><button className={ghost} onClick={() => void setPaused(!contract.paused_at)} disabled={busy}>{contract.paused_at ? "Resume" : "Pause"}</button><button className={ghost} onClick={() => void endPact()} disabled={busy}>End pact</button></div>}
      </div>

      <div className={s.row3}>
        <div className={s.mini}><ARing size={44} stroke={10} value={me ? Math.min(1, (pair?.streak ?? 0) / 7) : 0} /><span className={s.miniNum}>{me ? pair?.streak ?? 0 : "—"}</span><span className={s.muted}>Pair streak</span></div>
        <button className={s.mini} onClick={() => setView("review")}><ARing size={44} stroke={10} value={partnerPending ? 1 : 0} /><span className={s.miniNum}>{partnerPending}</span><span className={s.muted}>Pending</span></button>
        <button className={s.mini} onClick={() => setWhyOpen(v => !v)} aria-expanded={whyOpen} aria-label={`Trust ${trustLabel}. Why?`}><ARing size={44} stroke={10} value={(trust?.score ?? 0) / 100} /><span className={s.miniNum}>{trustLabel}</span><span className={s.muted}>Trust</span></button>
      </div>
      {whyOpen && <div className={s.card} aria-live="polite"><span className={s.label}>Trust — why?</span><TrustWhy trust={trust} /></div>}

      <button className={s.card} style={{ width: "100%", textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer" }} onClick={() => setView("garden")}>
        <div className={s.garden}>
          <Tree stage={garden?.stage ?? 1} width={64} height={72} />
          <div style={{ minWidth: 0 }}>
            <div className={s.muted}>Focus garden</div>
            <div className={s.big}>{garden?.stage_name ?? "Seed"}</div>
            <div className={s.muted}>{garden ? `Score ${garden.score}. ${garden.points_to_next ? `${garden.points_to_next} points to next stage.` : "Top stage reached."}` : "Loading…"}</div>
          </div>
        </div>
        {partnerStage && <div className={s.gardenSquad}><Tree stage={partnerStage.stage} width={34} /><span className={s.muted}>Partner's garden</span></div>}
      </button>

      {me ? (
        <button className={s.card} style={{ width: "100%", textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer" }} onClick={() => setView("partner")}>
          <div className={s.partner}>
            <div className={s.avatar}>{me.partner_avatar ? <img src={me.partner_avatar} alt="" /> : (name ?? "P").slice(0, 1)}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 500 }}>{name}</div>
              <div className={s.muted}>{partnerCheck?.checked_in ? (partnerCheck.completed ? "Task done today" : "Working on today's task") : `Partner since ${new Date(me.since).toLocaleDateString([], { month: "short", day: "numeric" })}`}</div></div>
            <span className={`${s.chip} ${partnerCheck?.checked_in ? s.chipOk : s.chipMuted}`}>{partnerCheck?.checked_in ? "Checked in" : "Not checked in yet"}</span>
          </div>
        </button>
      ) : (
        <div className={s.card}>
          <div className={s.big}>Pick your partner</div>
          <div className={s.muted}>Private by default. A partner reviews only proof you submit — never notes, coins or full history.</div>
          <div className={`${s.list}`} style={{ padding: 0, marginTop: 6 }}>
            <div className={`${s.listRow} ${s.selected}`} style={{ border: 0, cursor: "default" }}><span>Invite a friend</span><small>{code || invitePending ? "Invitation pending" : "No partner"}</small></div>
          </div>
          {code ? <>
            <div className={s.evidence} aria-label="Invite code" style={{ wordBreak: "break-all", fontSize: 14 }}>{code}</div>
            <div className={s.muted} style={{ marginTop: 6 }}>One-time code, valid 24 hours.</div>
            <div className={s.row2}><button className={ghost} onClick={() => { void navigator.clipboard?.writeText(code).then(() => toast.success("Copied")); }}>Copy</button><button className={btn} onClick={() => void shareInvite()}>Share</button></div>
            <button className={`${ghost} ${s.danger}`} style={{ marginTop: 8 }} onClick={() => void revokeInvite()} disabled={busy}>Revoke invite</button>
          </> : invitePending ? <>
            <div className={s.muted} style={{ marginTop: 6 }}>Invitation pending · expires {fmtWhen(invitePending)}. Codes are shown once; revoke to make a new one.</div>
            <button className={`${ghost} ${s.danger}`} style={{ marginTop: 8 }} onClick={() => void revokeInvite()} disabled={busy}>Revoke invite</button>
          </> : <div className={s.stack}><button className={btn} onClick={() => void invite()} disabled={busy}>Create invite</button></div>}
          <label className={s.field}><span className={s.label}>Enter partner's code</span><input className={s.input} aria-label="Partner code" value={entry} onChange={e => setEntry(e.target.value)} maxLength={40} /></label>
          <div className={s.stack}><button className={ghost} onClick={() => void join()} disabled={busy || entry.trim().length < 8}>Join</button></div>
          <div className={s.listRow} style={{ borderBottom: 0, marginTop: 6 }}><span>Go solo</span><button className={`${s.seg}`} onClick={() => setView("creator")}>Solo pact</button></div>
        </div>
      )}

      <div className={`${s.card} ${s.list}`}>
        <button className={s.listRow} onClick={() => setView("partner")}><span>Check-ins</span><small>{details?.checked_in_today ? "Done today" : me ? "Open" : "No partner"} <ChevronRight size={14} /></small></button>
        <button className={s.listRow} onClick={() => setView("proofs")}><span>Proof history</span><small>{proofs.filter(p => p.partner_review_status === "confirmed").length} confirmed <ChevronRight size={14} /></small></button>
        <button className={s.listRow} onClick={() => setView("recovery")}><span>Recovery</span><small>{contract?.status === "missed" && !hasRecovery ? "Available" : hasRecovery ? "Recovered" : "Not needed"} <ChevronRight size={14} /></small></button>
      </div>

      <button className={s.fab} onClick={() => setView("creator")}><Plus size={16} /> New pact</button>
      {proofSheet}
      {celebrate && <MilestoneCelebration milestone={celebrate} onClose={() => void closeMilestone()} />}
    </section>
  );
}

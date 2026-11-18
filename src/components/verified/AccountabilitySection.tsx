import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Flame, ChevronRight, Plus, Moon, Sun, ArrowLeft, Target, Clock, Hourglass, ShieldCheck, Sprout, MessageCircle, Zap, ClipboardCheck, History, LifeBuoy, BarChart3, UserMinus, Ban, Eye, Check, AlertTriangle, Camera, Flower2, FileText, Timer, Play, Lock, CalendarClock, Share2, UserPlus, Heart, RotateCcw } from "lucide-react";
import { CoinBadge } from "@/components/CoinBadge";
import s from "./acct/acct.module.css";
import { ARing, Tree, WeekStrip, SubHeader, SectionHead, Switch, Counter, weekDays, ymd } from "./acct/AcctUI";
import { CheckinScreen, GardenScreen, PactCreator, ReportScreen, TrustWhy, type Garden, type PactPreset } from "./acct/AcctScreens";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { safeName } from "@/lib/display-name";
import { acceptInvite, createInvite } from "@/lib/verified/accountability.functions";
import type { ContractRow } from "@/lib/verified/contracts";
import { endContractSession, findActiveSession, startContractSession, type SessionSnapshot } from "@/lib/verified/contract-session";
import { PartnerHistory, loadUnreadPartnerEvents } from "./acct/PartnerHistory";
import { ContractProofSheet } from "./ContractProofSheet";
import { NUDGE_EVENT, NUDGE_SEEN_KEY } from "./NudgeListener";
import { useTheme } from "@/lib/theme/theme";
import { InviteActions, MilestoneSheet, ShareSheet } from "./acct/Batch4UI";
import { firstName, isStageUp, pickHomePriority, shouldShowMilestone } from "./acct/home-priority";
import { deviceGet, deviceSet, type CardData } from "./acct/share-card";

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

export function AccountabilitySection({ onBack }: { onBack?: () => void } = {}) {
  const [me, setMe] = useState<MyAccountability | null | undefined>(undefined);
  const [details, setDetails] = useState<Details | null>(null);
  const [unread, setUnread] = useState(0);
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
  const [proofFilter, setProofFilter] = useState<"all" | "confirmed" | "pending">("all");
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  type View = "home" | "creator" | "review" | "recovery" | "checkin" | "garden" | "report" | "proofs" | "partner";
  const [view, setView] = useState<View>("home");
  useEffect(() => {
    if (view !== "home") return;
    let alive = true;
    const refresh = () => { void loadUnreadPartnerEvents().then(n => { if (alive) setUnread(n); }); };
    refresh();
    window.addEventListener("axen:partner-events-seen", refresh);
    return () => { alive = false; window.removeEventListener("axen:partner-events-seen", refresh); };
  }, [view]);
  const { theme: appTheme, setTheme: setAppTheme } = useTheme();
  const theme: "dark" | "light" = appTheme === "dark" ? "dark" : "light";
  const [coins, setCoins] = useState(0);
  const [weekMap, setWeekMap] = useState<Record<string, "done" | "missed" | "planned">>({});
  const [garden, setGarden] = useState<Garden | null>(null);
  const [partnerStage, setPartnerStage] = useState<{ stage: number; stage_name: string } | null>(null);
  const [pair, setPair] = useState<{ streak: number; milestone: number | null } | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [partnerCheck, setPartnerCheck] = useState<{ checked_in: boolean; completed: boolean } | null>(null);
  const [todayList, setTodayList] = useState<ContractRow[]>([]);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [stageUp, setStageUp] = useState<{ stage: number; name: string } | null>(null);
  const [shareData, setShareData] = useState<CardData | null>(null);
  const [preset, setPreset] = useState<PactPreset | null>(null);
  const [daySel, setDaySel] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<null | "remove" | "block">(null);
  const [confirmEmerg, setConfirmEmerg] = useState(false);
  const [fabOn, setFabOn] = useState(false);
  const ctaRef = useRef<HTMLDivElement | null>(null);
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
        if (shouldShowMilestone(p?.milestone, k => deviceGet(`axen.acct.ms.${k}`) === "1")) setCelebrate(p.milestone);
        const gd = (g.data as any) as Garden | null;
        if (gd?.stage) { // garden stage-up: once per stage, remembered on this device
          const prevRaw = deviceGet("axen.acct.gstage"); const prev = prevRaw ? Number(prevRaw) : null;
          if (isStageUp(prev, gd.stage) && deviceGet(`axen.acct.ms.stage.${gd.stage}`) !== "1") setStageUp({ stage: gd.stage, name: gd.stage_name });
          if (prev == null || gd.stage > prev) deviceSet("axen.acct.gstage", String(gd.stage));
        }
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
  const deadlineIso = (contract as any)?.deadline_at as string | undefined;
  useEffect(() => { if (session || !deadlineIso) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [session, deadlineIso]);
  useEffect(() => { // floating New pact appears only once the hero CTA has scrolled away
    const el = ctaRef.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFabOn(!e.isIntersecting)); io.observe(el); return () => io.disconnect();
  });
  useEffect(() => { if (!menu && !confirmEnd) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setConfirmEnd(null); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [menu, confirmEnd]);

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
  const endPartner = (block: boolean, confirmed = false) => run(async () => {
    if (!me) return;
    if (!confirmed && !window.confirm(block ? "Block and report this partner? They lose access right away and can't see future proof." : "Remove your partner? They lose access right away.")) return;
    const { error } = await (supabase.rpc as any)("revoke_accountability_connection", { _connection_id: me.connection_id, _block: block });
    if (error) toast.error("Could not update"); else { setMenu(false); setConfirmEnd(null); toast.success(block ? "Partner blocked" : "Partner removed"); await changed(); }
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
  const toggleTheme = () => setAppTheme(theme === "dark" ? "simple" : "dark");
  const saveShowTree = async (v: boolean) => {
    setShowTree(v);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("acct_settings").upsert({ user_id: u.user?.id, show_tree: v, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { setShowTree(!v); toast.error("Could not save"); }
  };
  const closeMilestone = async () => {
    const m = celebrate; setCelebrate(null);
    if (m) deviceSet(`axen.acct.ms.pair.${m}`, "1");
    if (m) await supabase.from("acct_milestones_seen").insert({ kind: "pair_streak", milestone: m });
  };
  const revokeInvite = () => run(async () => {
    const { error } = await supabase.rpc("acct_revoke_my_invites");
    if (error) toast.error("Could not revoke"); else { setCode(null); setInvitePending(null); toast.success("Invite revoked"); }
  });
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

  if (me === undefined) return <section {...shellProps}>{onBack && <div className={s.headTop}><button className={s.round} onClick={onBack} aria-label="Back to profile"><ArrowLeft size={18} /></button></div>}<div className={s.headRow}><h2 className={s.title}>Accountability</h2></div><div aria-busy="true"><div className={s.skel} style={{ height: 44 }} /><div className={s.skel} style={{ height: 130 }} /><div className={s.skel} /><div className={s.skel} /></div></section>;

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
    <>
      <div className={s.headTop}>
        {onBack && <button className={s.round} onClick={onBack} aria-label="Back to profile"><ArrowLeft size={18} /></button>}
        <span className={s.eyebrow} style={{ flex: 1, minWidth: 0 }}>You · Partner</span>
        <button className={s.round} aria-label="More options" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}><MoreHorizontal size={18} /></button>
        <CoinBadge amount={coins} variant="balance" surface={theme === "dark" ? "dark" : "light"} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <h2 className={s.title}>Accountability</h2>
        <div className={s.muted} style={{ fontSize: 13, marginTop: 4 }}>Pacts, proof and your partner, in one place.</div>
      </div>
    </>
  );
  const menuSheet = menu && (
    <div className={s.scrim} onClick={() => setMenu(false)}>
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Accountability options" onClick={e => e.stopPropagation()}>
        <div className={s.grab} />
        <div className={s.group} style={{ marginTop: 4 }}>Reports</div>
        <button className={s.sheetRow} onClick={() => { setMenu(false); setView("report"); }}><span className={s.iconTile}><BarChart3 size={16} /></span><span>Weekly report</span><ChevronRight size={16} /></button>
        <div className={s.group}>Appearance</div>
        <button className={s.sheetRow} onClick={toggleTheme}><span className={s.iconTile}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</span><span>{theme === "dark" ? "Light theme" : "Dark theme"}</span><span className={s.pill}>{theme === "dark" ? "Dark" : "Simple"}</span></button>
        <div className={s.group}>Privacy</div>
        <Switch label="Show my tree to my partner" help="Your partner sees your garden stage, nothing else." checked={showTree} onChange={v => void saveShowTree(v)} />
        {me && <>
          <Switch label="Share my pact progress" help="Your partner sees whether today's pacts are done." checked={me.my_sharing} disabled={busy} onChange={v => void setPref({ _share: v })} />
          <Switch label="Mute nudges" help="Stop nudge alerts from your partner." checked={me.i_muted} disabled={busy} onChange={v => void setPref({ _mute: v })} />
          <div className={s.dangerZone}>
            <div className={s.group} style={{ color: "var(--a-danger)" }}>Danger zone</div>
            <button className={`${s.sheetRow} ${s.danger}`} onClick={() => setConfirmEnd("remove")} disabled={busy}><span className={s.iconTile}><UserMinus size={16} /></span><span>Remove partner</span><ChevronRight size={16} /></button>
            <button className={`${s.sheetRow} ${s.danger}`} onClick={() => setConfirmEnd("block")} disabled={busy}><span className={s.iconTile}><Ban size={16} /></span><span>Block & report</span><ChevronRight size={16} /></button>
          </div>
        </>}
      </div>
    </div>
  );
  const confirmDialog = confirmEnd && (
    <div className={`${s.scrim} ${s.scrimCenter}`} onClick={() => setConfirmEnd(null)}>
      <div className={s.dialog} role="alertdialog" aria-modal="true" aria-labelledby="acct-confirm-t" onClick={e => e.stopPropagation()}>
        <div className={s.secTitle} id="acct-confirm-t" style={{ fontSize: 18 }}>{confirmEnd === "block" ? "Block and report this partner?" : "Remove your partner?"}</div>
        <p className={s.muted} style={{ fontSize: 13, margin: "8px 0 0" }}>{confirmEnd === "block" ? "They lose access right away and can't see future proof." : "They lose access right away."}</p>
        <div className={s.ctaCol}>
          <button className={btn} style={{ background: "var(--a-danger)", color: "var(--a-on-primary)" }} onClick={() => void endPartner(confirmEnd === "block", true)} disabled={busy}>{confirmEnd === "block" ? "Block & report" : "Remove partner"}</button>
          <button className={ghost} onClick={() => setConfirmEnd(null)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  const proofSheet = proofOpen && contract && <ContractProofSheet contract={contract} onClose={() => setProofOpen(false)} onDone={() => { setProofOpen(false); void changed(); }} />;

  if (view === "creator") return <section {...shellProps}><PactCreator hasPartner={!!me} preset={preset} onBack={() => { setPreset(null); back(); }} onSaved={() => { setPreset(null); back(); void load(); }} /></section>;
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

  if (view === "proofs") {
    const st = (p: (typeof proofs)[number]) => p.partner_review_status ?? "self_reported";
    const shown = proofs.filter(p => proofFilter === "all" ? true : proofFilter === "confirmed" ? st(p) === "confirmed" : ["pending", "asked", "self_reported", "recorded"].includes(st(p)));
    const typeIcon = (t: string) => /photo|image|selfie/.test(t) ? <Camera size={16} /> : /zen|meditat/.test(t) ? <Flower2 size={16} /> : /note|text/.test(t) ? <FileText size={16} /> : <Timer size={16} />;
    return <section {...shellProps}>
    <SubHeader title="Proof history" onBack={back} />
    {proofs.length === 0 ? <div className={`${s.card} ${s.emptyBig}`}>
      <span className={s.emptyIcon} aria-hidden="true"><ShieldCheck size={44} strokeWidth={1.4} /></span>
      <div className={s.muted}>Proof is the session time AXEN records, plus any photo or note you submit for a pact.</div>
      <button className={s.limeBtn} onClick={back}><Play size={16} /> Start a session</button>
    </div> : <>
      <div className={s.filterRow} role="group" aria-label="Filter proof">
        {(["all", "confirmed", "pending"] as const).map(f => <button key={f} className={`${s.filterChip} ${proofFilter === f ? s.filterOn : ""}`} aria-pressed={proofFilter === f} onClick={() => setProofFilter(f)}>{f === "all" ? "All" : f === "confirmed" ? "Confirmed" : "Pending"}</button>)}
      </div>
      <div className={s.timeline}>
        {shown.length === 0 && <div className={s.card}><div className={s.muted}>Nothing here yet.</div></div>}
        {shown.map(p => { const l = PROOF_LABEL[st(p)] ?? PROOF_LABEL.self_reported;
          return <div key={p.id} className={`${s.card} ${s.tlCard}`}>
            <span className={s.iconTile} aria-hidden="true">{typeIcon(p.proof_type)}</span>
            <div style={{ minWidth: 0, flex: 1 }}><b className={s.tlTitle}>{p.proof_type.replace(/_/g, " ")}</b><div className={s.muted}>{fmtWhen(p.created_at)}{p.reviewed_at ? " · Reviewed" : ""}</div></div>
            <span className={`${s.pillMono} ${st(p) === "disputed" ? s.pillMonoCoral : ""}`}>{l.label}</span>
          </div>; })}
      </div>
    </>}
    <div className={s.privacyNote}><Lock size={14} aria-hidden="true" /> Your partner sees only proof you submit.</div>
  </section>;
  }

  if (view === "recovery") {
    const canComeback = contract?.status === "missed" && !hasRecovery;
    return <section {...shellProps}>
    <SubHeader title="Recovery" onBack={back} />
    <div className={s.card}><div className={s.big}>Progress isn't perfection. Let's make your next step easier.</div><div className={s.muted}>Recovered pacts are labelled Recovered and counted separately. Your achievements are safe.</div>
      <div className={s.gardenBarRow} style={{ marginTop: 10 }}><span className={s.muted} style={{ flex: "none" }}>Recovered counts</span><div className={s.neonBar} aria-hidden="true"><i style={{ width: "60%" }} /></div><span className={s.pillMono}>60%</span></div>
    </div>
    <div className={`${s.card} ${s.recCard}`}>
      <div className={s.recTop}><span className={s.iconTile} aria-hidden="true"><Zap size={16} /></span><b>15-minute Comeback</b><span className={`${s.pillMono} ${canComeback ? "" : s.pillMonoMuted}`}>{canComeback ? "Available" : hasRecovery ? "Used" : "Not needed"}</span></div>
      <div className={s.muted}>Unlocks when today's pact is missed. One per pact.</div>
      {canComeback && <button className={s.limeBtn} style={{ marginTop: 10 }} onClick={() => void comeback()} disabled={busy}>Start comeback <ChevronRight size={16} /></button>}
    </div>
    <div className={`${s.card} ${s.recCard}`}>
      <div className={s.recTop}><span className={s.iconTile} aria-hidden="true"><CalendarClock size={16} /></span><b>Reschedule</b><span className={s.pillMono}>Available</span></div>
      <div className={s.muted}>Always open. Starts a new pact with today's details filled in.</div>
      <button className={ghost} style={{ marginTop: 10 }} onClick={() => { setPreset(contract && !contract.is_recovery ? { title: contract.title, category: contract.category, minutes: Math.max(5, Math.min(240, Math.round((contract.planned_seconds ?? 1800) / 60))) } : null); setView("creator"); }}>New pact <ChevronRight size={16} /></button>
    </div>
    {contract && ["draft", "scheduled"].includes(contract.status) && <div className={`${s.card} ${s.list}`}><button className={s.listRow} onClick={() => void setPaused(!contract.paused_at)} disabled={busy}><span>{contract.paused_at ? "Resume the pact" : "Pause the pact"}</span><small><ChevronRight size={14} /></small></button></div>}
  </section>;
  }

  if (view === "partner") {
    const toldToday = !!details?.checked_in_today;
    const canTell = !!details?.can_check_in && !toldToday;
    const groups = [
      { id: "Gentle", icon: <Eye size={13} />, idx: [4, 0] },
      { id: "Push", icon: <Zap size={13} />, idx: [1, 3] },
      { id: "Hard", icon: <Flame size={13} />, idx: [2] },
    ];
    return <section {...shellProps}>
    <SubHeader title="Check-ins" onBack={back} />
    <button className={s.limeBtn} onClick={() => setView("checkin")}><ClipboardCheck size={18} /> Daily check-in</button>
    {me && <>
      <div className={s.card} style={{ marginTop: 12 }}>
        <span className={s.tlLabel} style={{ paddingTop: 0 }}>Today</span>
        <div className={s.statusPair} style={{ marginTop: 8 }}>
          <div className={s.who}><span className={`${s.whoAv} ${s.whoMe}`} aria-hidden="true">Me{toldToday && <Check size={14} strokeWidth={3} />}</span>
            <span className={s.whoTxt}><b>You</b><span>{toldToday ? "Told partner" : "Not yet"}</span></span></div>
          <div className={s.who}><span className={`${s.whoAv} ${s.whoP}`} aria-hidden="true">{(name ?? "P").slice(0, 1)}{partnerCheck?.checked_in && <Check size={14} strokeWidth={3} />}</span>
            <span className={s.whoTxt}><b>{name}</b><span>{partnerCheck == null ? "—" : partnerCheck.checked_in ? (partnerCheck.completed ? "Task done" : "Checked in") : "Not yet"}</span></span></div>
        </div>
        <button className={`${s.actBtn} ${toldToday ? s.actDone : ""}`} style={{ marginTop: 10 }} onClick={() => void send("checkin", null)} disabled={busy || !canTell} aria-label={toldToday ? "Told partner today" : "Aaj ka task kiya"}>
          <span className={s.iconTile} aria-hidden="true">{toldToday ? <Check size={16} /> : <ClipboardCheck size={16} />}</span>
          <span>{toldToday ? "Told partner today" : "Aaj ka task kiya"}</span>
          {!toldToday && <ChevronRight size={16} color="var(--a-muted)" />}
        </button>
        {!toldToday && !details?.can_check_in && <div className={s.whyLine}>Complete a task today to tell your partner.</div>}
        <div className={s.item} style={{ marginTop: 12, borderTop: "1px solid var(--a-border)", paddingTop: 12 }}>
          <span className={s.tlLabel} style={{ paddingTop: 0 }}>{name}'s week</span>
          <div className={s.sumLine} style={{ fontSize: 14 }}><Flame size={14} color="var(--a-violet)" /> {details?.partner_streak ?? 0}-day streak · {details?.partner_weekly_tasks ?? 0} tasks</div>
        </div>
      </div>
      <div className={s.contractCard}>
        <div className={s.fRow}><span className={s.monoTag}>Our contract</span><Counter n={commitment.length} max={100} /></div>
        <textarea className={s.fInput} style={{ marginTop: 8, resize: "none" }} aria-label="My commitment" rows={2} maxLength={100} value={commitment} onChange={e => setCommitment(e.target.value)} placeholder="e.g. I'll study 2 hours before 9 PM every day" />
        {(() => { const dirty = commitment !== (details?.my_commitment ?? ""); const saved = !dirty && !!details?.my_commitment; return <button className={saved ? `${s.chipBtn} ${s.chipBtnOn}` : s.limeBtn} style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={() => void send("commitment", commitment)} disabled={busy || !dirty}>{saved ? <><Check size={15} /> Saved</> : "Save commitment"}</button>; })()}
        <div className={s.bubble}><b>{name}</b>{details?.partner_commitment || "No commitment yet."}</div>
      </div>
      <div className={s.card}>
        <span className={s.tlLabel} style={{ paddingTop: 0 }}>Send a nudge</span>
        {groups.map(g => <div key={g.id} className={s.nGroup}>
          <div className={s.nGroupHead}>{g.icon}{g.id}</div>
          {g.idx.map(i => <button key={i} className={s.nudgeBtn} aria-label={NUDGES[i]} onClick={() => void send("nudge", NUDGES[i])} disabled={busy}><span className={s.iconTile} aria-hidden="true">{g.icon}</span><span>{NUDGE_TEXT[i]}</span></button>)}
        </div>)}
        <button className={`${s.nudgeBtn} ${s.nudgeEmerg}`} onClick={() => setConfirmEmerg(true)} disabled={busy}><span className={`${s.iconTile} ${s.iconTileCoral}`} aria-hidden="true"><AlertTriangle size={16} /></span><span>Emergency nudge</span></button>
        <PartnerHistory partnerName={name ?? "Partner"} />
      </div>
    </>}
    {confirmEmerg && typeof document !== "undefined" && createPortal(
      <div className={s.portal} data-theme={theme}>
        <div className={`${s.scrim} ${s.scrimCenter}`} onClick={() => setConfirmEmerg(false)}>
          <div className={s.dialog} role="alertdialog" aria-modal="true" aria-labelledby="acct-emerg-t" onClick={e => e.stopPropagation()}>
            <div className={s.secTitle} id="acct-emerg-t" style={{ fontSize: 18 }}>Send an emergency nudge?</div>
            <p className={s.muted} style={{ fontSize: 13, margin: "8px 0 0" }}>{name} gets an urgent alert right away.</p>
            <div className={s.ctaCol}>
              <button className={btn} style={{ background: "var(--a-danger)", color: "var(--a-on-primary)" }} onClick={() => { setConfirmEmerg(false); void send("emergency", null); }} disabled={busy}>Send emergency nudge</button>
              <button className={ghost} onClick={() => setConfirmEmerg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </div>, document.body)}
  </section>;
  }

  const days = weekDays(new Date(), weekMap);
  const selDay = daySel != null ? days[daySel] : null;
  const selText = selDay ? `${selDay.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${(() => { const v = weekMap[ymd(selDay.date)]; return v === "done" ? "Pact done" : v === "missed" ? "Missed" : v === "planned" ? "Pact planned" : "No pacts"; })()}` : null;
  const dl = deadlineIso ? new Date(deadlineIso).getTime() : 0;
  const left = dl ? dl - now : 0;
  const countdown = !dl ? "No deadline" : left <= 0 ? "Past due" : left >= 3600_000 ? `${Math.floor(left / 3600_000)}h ${Math.floor((left % 3600_000) / 60_000)}m` : `${Math.max(1, Math.floor(left / 60_000))}m`;
  const pairStreak = pair?.streak ?? 0;
  const trustStep = trust?.score == null ? 1 : trust.score >= 80 ? 4 : trust.score >= 50 ? 3 : 2;
  const stageProg = (pts: number, stage: number) => stage >= 5 ? 1 : Math.max(0, Math.min(1, (20 - pts) / 20));
  const confirmedCount = proofs.filter(p => p.partner_review_status === "confirmed").length;
  const TEMPLATES: PactPreset[] = [{ title: "Study 30 min", minutes: 30, category: "study" }, { title: "Workout 20 min", minutes: 20, category: "workout" }, { title: "Read 15 min", minutes: 15, category: "reading" }];
  const openCreator = (p: PactPreset | null = null) => { setPreset(p); setView("creator"); };
  const openWeekShare = async () => {
    const { data, error } = await supabase.rpc("acct_weekly_report");
    if (error || !data) { toast.error("Couldn't load your week. Try again."); return; }
    const r = data as any; const stats = [{ label: "Pacts done", value: `${r.completed ?? 0}/${r.total ?? 0}` }];
    if (me) stats.push({ label: "Pair streak", value: `${pairStreak} days` });
    stats.push({ label: "Your streak", value: `${streak} days` });
    if (garden) stats.push({ label: "Garden", value: garden.stage_name });
    setShareData({ kind: "weekly", headline: `${r.completed ?? 0} pacts done`, stats, partnerFirst: null });
  };
  const missed = !!contract && contract.status === "missed" && !hasRecovery && !contract.is_recovery;
  const dueToday = !!contract && !missed && ["draft", "scheduled", "active", "proof_pending"].includes(contract.status as string);
  const prio = pickHomePriority({ missed, dueToday, checkinDue: !!me && !!details && !details.checked_in_today, partnerCheer: !!me && !me.i_muted && unread > 0, hasGarden: !!garden });
  const prioRow = (icon: React.ReactNode, title: string, sub: string, action: React.ReactNode, coral = false) => <div className={`${s.card} ${coral ? s.prioCoral : s.prio}`} aria-label="Next up">
    <div className={s.prioHead}><span className={`${s.iconTile} ${coral ? s.iconTileCoral : ""}`} aria-hidden="true">{icon}</span><div><div className={s.secTitle}>{title}</div><div className={s.muted}>{sub}</div></div></div>
    <div className={s.ctaCol}>{action}</div></div>;
  const prioCard = prio === "missed" && contract ? prioRow(<LifeBuoy size={16} />, "Missed pact — no stress", contract.title,
      <div className={s.row2} style={{ marginTop: 0 }}><button className={s.limeBtn} onClick={() => void comeback()} disabled={busy}><RotateCcw size={16} /> Comeback</button>
        <button className={ghost} onClick={() => openCreator({ title: contract.title, minutes: Math.max(5, Math.round((contract.planned_seconds || 1800) / 60)), category: contract.category })}><CalendarClock size={16} /> Reschedule</button></div>, true)
    : prio === "due" && contract ? prioRow(<Target size={16} />, "Due today", `${contract.title}${deadlineIso ? ` · ${fmtTime(deadlineIso)}` : ""}`, <button className={s.limeBtn} onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>Open pact</button>)
    : prio === "checkin" ? prioRow(<ClipboardCheck size={16} />, "Check-in due", "30 seconds. Your partner will see it.", <button className={s.limeBtn} onClick={() => setView("checkin")}>Daily check-in</button>)
    : prio === "cheer" ? prioRow(<Heart size={16} />, `${name ?? "Partner"} sent you something`, `${unread > 9 ? "9+" : unread} new`, <button className={s.limeBtn} onClick={() => setView("partner")}>See it</button>)
    : prio === "garden" ? null
    : prioRow(<Plus size={16} />, "Start with one pact", "Small and doable today.", <button className={s.limeBtn} onClick={() => openCreator()}>Create a pact</button>);

  return (
    <section {...shellProps}>
      {header}
      {err && <div role="alert" className={s.card} style={{ borderColor: "var(--a-danger)" }}>{err} <button className={s.pill} style={{ marginLeft: 6, cursor: "pointer" }} onClick={() => void load()}>Try again</button></div>}
      <WeekStrip days={days} selected={daySel} onSelect={i => setDaySel(daySel === i ? null : i)} />
      <div className={s.dayInfo} aria-live="polite">{selText ?? "This week"}</div>
      {prioCard}

      <div className={`${s.card} ${s.hero}`}>
        <div className={s.heroTop}>
          <div style={{ minWidth: 0 }}>
            <div className={s.heroLabel}>{contract?.is_recovery ? "Today's comeback" : "Today's pacts"}</div>
            <div className={s.heroNum}>{doneToday}/{totalToday}<small>done</small></div>
          </div>
          <div className={s.heroRing}><ARing size={88} stroke={10} value={totalToday ? doneToday / totalToday : 0} label={`${doneToday} of ${totalToday} pacts done`}><Target size={26} color="var(--a-ring)" /></ARing></div>
        </div>
        <div className={s.cells}>
          <div><div className={s.tileLabel}>Your streak</div><div className={s.cellNum}><Flame size={16} color="var(--a-ring)" />{streak}<span className={s.muted}>days</span></div></div>
          <div><div className={s.tileLabel}>Next deadline</div><div className={s.cellNum}><Clock size={16} color="var(--a-ring)" />{contract ? countdown : "—"}</div></div>
        </div>
        {contract ? <div className={s.nextDue}>
          <div style={{ minWidth: 0 }}><div className={s.big} style={{ margin: 0 }}>{contract.title}</div>
            <div className={s.muted}>{deadlineIso ? `Due ${fmtTime(deadlineIso)}` : "No deadline"}</div></div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {contract.paused_at && <span className={`${s.pill} ${s.pillMuted}`}>Paused</span>}
            {contract.is_recovery && contract.status === "rewarded" && <span className={s.pill}>Recovered</span>}
            {dl > 0 && left <= 0 && <span className={`${s.pill} ${s.pillCoral}`}>Past due</span>}
          </div>
        </div> : <>
          <div className={s.muted} style={{ marginTop: 12 }}>Nothing planned yet. Pick a quick start:</div>
          <div className={s.templates}>{TEMPLATES.map(t => <button key={t.title} className={`${s.tpl} ${s.press}`} onClick={() => openCreator(t)}>{t.title}</button>)}</div>
        </>}
        {contract && session && state === "SESSION_LIVE" && <Ring session={contract.is_recovery && contract.comeback_started_at && contract.comeback_ends_at ? { ...session, startedAt: new Date(contract.comeback_started_at).getTime(), expectedEndAt: new Date(contract.comeback_ends_at).getTime() } : session} now={now} />}
        {contract?.minimum_version && state === "BEFORE_SESSION" && <div className={s.muted} style={{ marginTop: 8 }}>Minimum version: {contract.minimum_version}</div>}
        {contract && statusLine && <div style={{ marginTop: 8 }}>{statusLine}</div>}
        <div className={s.ctaCol} ref={ctaRef}>
          {!contract ? <button className={btn} onClick={() => openCreator()}><Plus size={18} /> Create a pact</button>
            : primary ?? <button className={btn} disabled>Start session</button>}
          <button className={ghost} onClick={() => setView("checkin")}><ClipboardCheck size={16} /> Check in</button>
        </div>
        {contract && ["draft", "scheduled"].includes(contract.status) && !contract.is_recovery && <div className={s.row2}><button className={ghost} onClick={() => void setPaused(!contract.paused_at)} disabled={busy}>{contract.paused_at ? "Resume" : "Pause"}</button><button className={ghost} onClick={() => void endPact()} disabled={busy}>End pact</button></div>}
      </div>

      <div className={s.tiles3}>
        <div className={s.statTile}>
          <div className={s.statTop}><span className={s.iconTile}><Flame size={16} /></span></div>
          <div className={s.tileLabel}>Pair streak</div>
          <div className={s.tileNum}>{me ? pairStreak : "—"}{me && <span className={s.muted} style={{ fontWeight: 400, fontSize: 11 }}> days</span>}</div>
          {me && pair && <div className={s.dots7} aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <span key={i} className={i < Math.min(7, pairStreak) ? s.on : ""} />)}</div>}
        </div>
        <button className={`${s.statTile} ${partnerPending ? s.pulse : ""}`} onClick={() => setView("review")} aria-label={`${partnerPending} pending reviews`}>
          <div className={s.statTop}><span className={s.iconTile}><Hourglass size={16} /></span><ChevronRight size={14} /></div>
          <div className={s.tileLabel}>Pending</div>
          <div className={s.tileNum}>{partnerPending}</div>
        </button>
        <button className={s.statTile} onClick={() => setWhyOpen(v => !v)} aria-expanded={whyOpen} aria-label={`Trust ${trustLabel}. Why?`}>
          <div className={s.statTop}><span className={s.iconTile}><ShieldCheck size={16} /></span><ChevronRight size={14} /></div>
          <div className={s.tileLabel}>Trust</div>
          <div className={s.tileNum} style={{ fontSize: 16 }}>{trustLabel}</div>
          {trust && <div className={s.steps} aria-hidden="true">{[1, 2, 3, 4].map(i => <span key={i} className={i <= trustStep ? s.on : ""} />)}</div>}
        </button>
      </div>
      {whyOpen && <div className={s.card} aria-live="polite"><span className={s.label}>Trust — why?</span><TrustWhy trust={trust} /></div>}

      <button className={`${s.card} ${s.cardBtn}`} onClick={() => setView("garden")}>
        <SectionHead icon={<Sprout size={16} />} title="Focus garden" sub={garden ? `Score ${garden.score}` : "Loading…"} right={<ChevronRight size={16} color="var(--a-muted)" />} />
        <div className={s.trees} style={partnerStage ? undefined : { gridTemplateColumns: "1fr" }}>
          <div className={`${s.treeBox} ${s.treeMe}`}>
            <Tree stage={garden?.stage ?? 1} width={56} height={62} />
            <div className={s.secTitle} style={{ fontSize: 14 }}>You · {garden?.stage_name ?? "Seed"}</div>
            {garden && <div className={s.bar}><div className={s.barLime} style={{ width: `${stageProg(garden.points_to_next, garden.stage) * 100}%` }} /></div>}
            {garden && <span className={s.pill}>{garden.points_to_next ? `${garden.points_to_next} pts to ${["Seed", "Sapling", "Young", "Lush", "Ancient"][Math.min(4, garden.stage)]}` : "Top stage"}</span>}
          </div>
          {partnerStage && <div className={`${s.treeBox} ${s.treeP}`}>
            <Tree stage={partnerStage.stage} width={56} height={62} />
            <div className={s.secTitle} style={{ fontSize: 14 }}>Partner · {partnerStage.stage_name}</div>
            <span className={`${s.pill} ${s.pillViolet}`}>Stage {partnerStage.stage}</span>
          </div>}
        </div>
      </button>

      {me ? (
        <div className={s.card}>
          <button className={s.cardBtn} style={{ background: "none", border: 0, padding: 0 }} onClick={() => setView("partner")} aria-label={`Open partner ${name}`}>
            <div className={s.pRow}>
              <div className={`${s.pAvatar} ${partnerCheck?.checked_in ? s.on : ""}`}><div>{me.partner_avatar ? <img src={me.partner_avatar} alt="" /> : (name ?? "P").slice(0, 1)}</div>{!me.i_muted && unread > 0 && <span className={s.unreadBadge} aria-label={`${unread} unread nudges and cheers`}>{unread > 9 ? "9+" : unread}</span>}</div>
              <div style={{ minWidth: 0 }}>
                <div className={s.secTitle} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div className={s.muted}>{partnerCheck?.checked_in ? (partnerCheck.completed ? "Task done today" : "Working on today's task") : `Partner since ${new Date(me.since).toLocaleDateString([], { month: "short", day: "numeric" })}`}</div>
              </div>
            </div>
          </button>
          <div className={s.pActs}>
            <span className={`${s.pill} ${partnerCheck?.checked_in ? "" : s.pillMuted}`}>{partnerCheck?.checked_in ? "Checked in" : "Not checked in yet"}</span>
            <span style={{ flex: 1 }} />
            <button className={s.round} aria-label={NUDGES[3]} title={NUDGE_TEXT[3]} onClick={() => void send("nudge", NUDGES[3])} disabled={busy}><Zap size={17} color="var(--a-violet)" /></button>
            <button className={s.round} aria-label={NUDGES[0]} title={NUDGE_TEXT[0]} onClick={() => void send("nudge", NUDGES[0])} disabled={busy}><MessageCircle size={17} color="var(--a-violet)" /></button>
          </div>
        </div>
      ) : (
        <div className={s.card}>
          <div className={s.prioHead}><span className={s.iconTile} aria-hidden="true"><UserPlus size={16} /></span><div className={s.big} style={{ margin: 0 }}>Invite a partner</div></div>
          <div className={s.muted}>Private by default. A partner reviews only proof you submit — never notes, coins or full history.</div>
          <div className={`${s.list}`} style={{ padding: 0, marginTop: 6 }}>
            <div className={`${s.listRow} ${s.selected}`} style={{ border: 0, cursor: "default" }}><span>Invite a friend</span><small>{code || invitePending ? "Invitation pending" : "No partner"}</small></div>
          </div>
          {code ? <>
            <div className={s.evidence} aria-label="Invite code" style={{ wordBreak: "break-all", fontSize: 14 }}>{code}</div>
            <div className={s.muted} style={{ marginTop: 6 }}>One-time code, valid 24 hours.</div>
            <InviteActions code={code} />
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

      <div className={s.rows}>
        <button className={s.navRow} onClick={() => setView("partner")}><span className={`${s.iconTile} ${me && !details?.checked_in_today ? s.navDot : ""}`}><ClipboardCheck size={16} /></span><b>Check-ins</b><span className={`${s.pill} ${me ? "" : s.pillMuted}`}>{details?.checked_in_today ? "Done today" : me ? "Open" : "No partner"}</span><ChevronRight size={16} color="var(--a-muted)" /></button>
        <button className={s.navRow} onClick={() => setView("proofs")}><span className={s.iconTile}><History size={16} /></span><b>Proof history</b><span className={s.pill}>{confirmedCount} confirmed</span><ChevronRight size={16} color="var(--a-muted)" /></button>
        <button className={s.navRow} onClick={() => void openWeekShare()}><span className={s.iconTile}><Share2 size={16} /></span><b>Share my week</b><span className={s.pill}>Card</span><ChevronRight size={16} color="var(--a-muted)" /></button>
        <button className={s.navRow} onClick={() => setView("recovery")}><span className={s.iconTile}><LifeBuoy size={16} /></span><b>Recovery</b><span className={`${s.pill} ${contract?.status === "missed" && !hasRecovery ? s.pillCoral : hasRecovery ? "" : s.pillMuted}`}>{contract?.status === "missed" && !hasRecovery ? "Available" : hasRecovery ? "Recovered" : "Not needed"}</span><ChevronRight size={16} color="var(--a-muted)" /></button>
      </div>

      {typeof document !== "undefined" && createPortal( // overlays escape the tab's transformed wrapper so they sit above the bottom nav
        <div className={s.portal} data-theme={theme}>
          <button className={`${s.fab} ${fabOn && !menu ? "" : s.fabHidden}`} onClick={() => openCreator()} aria-hidden={!fabOn} tabIndex={fabOn ? 0 : -1}><Plus size={18} /> New pact</button>
          {menuSheet}
          {confirmDialog}
        </div>, document.body)}
      {proofSheet}
      {celebrate && <MilestoneSheet theme={theme} badge={String(celebrate)} title={`${celebrate}-day pair streak`} sub={`You and your partner both showed up ${celebrate} days in a row.`}
        onShare={() => { const n = celebrate; void closeMilestone(); setShareData({ kind: "streak", headline: `${n}-day streak`, stats: [{ label: "Pair streak", value: `${n} days` }, { label: "Your streak", value: `${streak} days` }], partnerFirst: null }); }}
        onClose={() => void closeMilestone()} />}
      {!celebrate && stageUp && <MilestoneSheet theme={theme} badge={String(stageUp.stage)} title={`Your tree grew: ${stageUp.name}`} sub="Your focus garden reached a new stage."
        onClose={() => { deviceSet(`axen.acct.ms.stage.${stageUp.stage}`, "1"); setStageUp(null); }} />}
      {shareData && <ShareSheet theme={theme} data={shareData} partnerName={me ? firstName(me.partner_name) : null} onClose={() => setShareData(null)} />}
    </section>
  );
}

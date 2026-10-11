import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ContractButton, ContractRing, ContractStats, contractStyles as cs } from "./ContractVisuals";
import { CoinBadge } from "@/components/CoinBadge";
import { useDailyCoinRewards } from "@/hooks/useDailyCoinRewards";
import { haptic } from "@/lib/haptics";
import { ContractSheet } from "./ContractSheet";
import { ContractProofSheet } from "./ContractProofSheet";
import { loadMyAccountability, type MyAccountability } from "./AccountabilitySection";
import { safeName } from "@/lib/display-name";
import { cancelContractReminders, scheduleContractReminders } from "@/lib/verified/contract-reminders";
import {
  PROOF_METHODS, REMINDER_PREFS, deviceTimezone, emptyForm, fmtWhen, formFromRow, friendlyError, toPayload,
  type ContractForm, type ContractRow,
} from "@/lib/verified/contracts";

const READ_ONLY: Record<string, string> = {
  proof_pending: "Session done — submit proof", verified: "Verified",
  rewarded: "Completed", missed: "Missed",
};

const REASONS = [
  { id: "time_conflict", label: "Time conflict" },
  { id: "task_too_large", label: "Task too large" },
  { id: "low_energy", label: "Low energy" },
  { id: "forgot", label: "Forgot" },
  { id: "distraction", label: "Distraction" },
  { id: "other", label: "Other" },
];

function localToday(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function ContractCard({ onStart, onResume }: {
  onStart?: (row: ContractRow) => Promise<void> | void;
  onResume?: (row: ContractRow) => void;
} = {}) {
  const { daily, refresh: refreshRewards } = useDailyCoinRewards();
  const [awardId, setAwardId] = useState<string | undefined>();
  const tz = deviceTimezone();
  const [row, setRow] = useState<ContractRow | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([]);
  const [sheet, setSheet] = useState<null | "create" | "edit">(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [hasRecovery, setHasRecovery] = useState(false);
  const [partner, setPartner] = useState<MyAccountability | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);

  const load = useCallback(async (): Promise<ContractRow | null> => {
    const today = localToday(tz);
    await (supabase.rpc as any)("check_my_comebacks").then(() => {}, () => {});
    const { data, error } = await supabase.from("daily_contracts")
      .select("*").eq("is_recovery", false).gte("local_day", today).neq("status", "cancelled")
      .order("scheduled_at", { ascending: true }).limit(1);
    if (!mounted.current) return null;
    if (error) { setLoadErr(friendlyError(error)); return null; }
    let fresh = (data?.[0] ?? null) as ContractRow | null;
    let recovered = false;
    if (fresh && fresh.status === "missed") {
      const { data: rec, error: recErr } = await supabase.from("daily_contracts")
        .select("*").eq("recovery_of_id", fresh.id).eq("is_recovery", true).limit(1);
      if (!mounted.current) return null;
      if (recErr) { setLoadErr(friendlyError(recErr)); return null; }
      if (rec?.[0]) { fresh = rec[0] as ContractRow; recovered = true; }
    }
    setLoadErr(null);
    setHasRecovery(recovered);
    loadMyAccountability().then(p => { if (mounted.current) setPartner(p); }).catch(() => {});
    setRow(fresh);
    // reminders only make sense for a scheduled contract — clean up anything stale
    if (fresh && fresh.status !== "scheduled") void cancelContractReminders(fresh.id);
    return fresh;
  }, [tz]);

  useEffect(() => {
    mounted.current = true;
    void load();
    supabase.from("goals").select("id,title").eq("completed", false).order("created_at")
      .then(({ data }) => { if (mounted.current) setGoals((data ?? []) as any); });
    const on = () => { void load(); };
    window.addEventListener("online", on);
    window.addEventListener("axen:contract-changed", on);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", on); window.removeEventListener("axen:contract-changed", on);
    };
  }, [load]);

  const save = async (f: ContractForm, asDraft: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setSaveErr(null);
    try {
      const payload = { ...toPayload(f, tz), status: (asDraft ? "draft" : "scheduled") as ContractRow["status"] };
      if (sheet === "edit" && row) {
        const { data, error } = await supabase.from("daily_contracts").update(payload).eq("id", row.id).select().maybeSingle();
        if (error) throw error;
        if (!data) throw { code: "42501", message: "not owner" };
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw { code: "42501", message: "JWT" };
        const { error } = await supabase.from("daily_contracts").insert({ ...payload, user_id: u.user.id, local_day: f.local.slice(0, 10) /* server recomputes */ });
        if (error) throw error;
      }
      haptic("success");
      toast.success(asDraft ? "Draft saved" : "Contract set");
      setSheet(null);
      const fresh = await load();
      if (fresh && fresh.status === "scheduled" && !asDraft) {
        const r = await scheduleContractReminders(fresh);
        if (r === "denied" || r === "unsupported" || r === "browser") {
          toast.info("Reminders are off here — we'll keep your contract visible in the app.");
        }
      }
    } catch (e) {
      setSaveErr(friendlyError(e));
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const cancel = async () => {
    if (!row || lock.current) return;
    if (!window.confirm("Cancel this contract? This can't be undone.")) return;
    lock.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.from("daily_contracts").update({ status: "cancelled" }).eq("id", row.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw { code: "42501", message: "not owner" };
      await cancelContractReminders(row.id);
      toast.success("Contract cancelled");
      await load();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const start = async () => {
    if (!row || !onStart || lock.current) return;
    lock.current = true; setBusy(true);
    try { await onStart(row); await load(); }
    finally { lock.current = false; setBusy(false); }
  };

  const claim = async () => {
    if (!row || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("finalize_contract_and_award", { _contract_id: row.id });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.result === "awarded") {
        if (Number(r.coins) > 0) { setAwardId(row.id); toast.success(`+${r.xp} XP · +${r.coins} coins`); }
        else toast.success(`+${r.xp} XP · Today's coin reward was already earned.`);
        void refreshRewards(); window.dispatchEvent(new Event("axen:coin-reward"));
      }
      else toast.info("Reward already claimed");
      await load();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const recover = async () => {
    if (!row || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase.rpc("start_recovery", { _original_id: row.id, _reason: (reason || null) as any });
      if (error) {
        const m = `${error.message ?? ""}`;
        if (m.includes("already_exists")) toast.info("Recovery already started for this contract");
        else if (/expired|window|local day|closed/i.test(m)) toast.info("Today's recovery window has closed");
        else throw error;
      } else {
        haptic("success");
        toast.success("Recovery mode activated");
      }
      await load();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const openCreate = () => { setSaveErr(null); setSheet("create"); };
  const completed = row?.status === "rewarded" || row?.status === "verified";
  const status = row ? ({ scheduled: "Active", active: "Active", draft: "Draft", proof_pending: "Proof pending", verified: "Verified", rewarded: row.is_recovery ? "Recovered" : "Completed", missed: "Missed", cancelled: "Cancelled" }[row.status] ?? row.status) : null;
  let body: React.ReactNode;
  if (loadErr) {
    body = <><div role="alert" className={cs.error}>{loadErr}</div><ContractButton secondary onClick={load}>Try again</ContractButton></>;
  } else if (row === undefined) {
    body = <div aria-busy="true" aria-label="Loading contract"><div className={cs.summary}><div className={`${cs.skeleton} ${cs.skeletonRing}`} /><div><div className={`${cs.skeleton} ${cs.skeletonLine}`} /><div className={`${cs.skeleton} ${cs.skeletonTitle}`} /></div></div><div className={cs.stats}>{[0, 1, 2].map(n => <div key={n} className={`${cs.tile} ${cs.skeleton}`} />)}</div><div className={`${cs.skeleton} ${cs.skeletonButton}`} /></div>;
  } else if (row === null) {
    body = <><div className={cs.empty}><ShieldCheck aria-hidden="true" /><p className={cs.note}>Choose one action that makes today a win.</p></div><ContractButton onClick={openCreate}>CREATE CONTRACT</ContractButton></>;
  } else {
    const goal = goals.find(g => g.id === row.goal_id)?.title;
    const details = <>
      <div className={cs.summary}><ContractRing duration={Math.round(row.planned_seconds / 60)} completed={completed} /><div><div className={`${cs.mono} ${cs.category}`}>{row.category} · {fmtWhen(row)}</div><h3 className={cs.title}>{row.title}</h3></div></div>
      <ContractStats duration={Math.round(row.planned_seconds / 60)} rescue={Math.round(row.rescue_seconds / 60)} level={row.difficulty} />
      <div className={cs.chips}><span className={`${cs.mono} ${cs.chip}`}>{PROOF_METHODS.find(p => p.id === row.proof_method)?.label ?? row.proof_method}</span><span className={`${cs.mono} ${cs.chip} ${cs.reminder}`}>{REMINDER_PREFS.find(p => p.id === row.reminder_pref)?.label}</span></div>
      {goal && <div className={cs.note}>Goal: {goal}</div>}
      {row.accountability_enabled && partner && partner.my_sharing && <div className={cs.note}>{safeName(partner.partner_name, "Partner")} · Partner can see your progress</div>}
    </>;
    let actions: React.ReactNode;
    if (row.status === "draft") {
      actions = <><div className={cs.note}>Draft — not confirmed yet</div><ContractButton onClick={() => { setSaveErr(null); setSheet("edit"); }} disabled={busy}>REVIEW & CONFIRM</ContractButton><div className={cs.actions}><ContractButton secondary onClick={cancel} disabled={busy}>Cancel</ContractButton></div></>;
    } else if (row.status === "scheduled") {
      const todayInTz = new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const notYet = row.local_day > todayInTz;
      actions = <><ContractButton onClick={() => void start()} disabled={busy || !onStart || notYet}>{busy ? "STARTING…" : "START CONTRACT"}</ContractButton>
        {notYet && <div className={cs.note}>Unlocks on the contract's day ({row.local_day}).</div>}
        {!row.is_recovery ? <div className={cs.actions}><ContractButton secondary onClick={() => { setSaveErr(null); setSheet("edit"); }} disabled={busy}>Reschedule</ContractButton><ContractButton secondary onClick={cancel} disabled={busy}>Cancel</ContractButton></div> : <div className={cs.note}>Recovery mode activated · small win still counts</div>}</>;
    } else if (row.status === "active") {
      actions = <><div className={`${cs.note} ${cs.success}`}>In progress</div>{onResume && <ContractButton onClick={() => onResume(row)} disabled={busy}>RETURN TO SESSION</ContractButton>}</>;
    } else if (row.status === "proof_pending") {
      actions = <><div className={cs.note}>{READ_ONLY.proof_pending}</div><ContractButton onClick={() => setProofOpen(true)} disabled={busy}>SUBMIT PROOF</ContractButton></>;
    } else if (row.status === "verified") {
      actions = <><div className={`${cs.note} ${cs.success}`}>{READ_ONLY.verified}</div><ContractButton onClick={() => void claim()} disabled={busy}>{busy ? "CLAIMING…" : "CLAIM REWARD"}</ContractButton></>;
    } else if (row.status === "missed" && !row.is_recovery && !hasRecovery) {
      const mins = 15;
      actions = <><div className={cs.note}>You still have today. Start your rescue version.</div><label className={cs.fieldLabel}>What got in the way? (optional)<div className={cs.fieldWrap}><select className={cs.field} aria-label="Recovery reason" value={reason} onChange={e => setReason(e.target.value)}><option value="">Skip</option>{REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select><ChevronDown className={cs.fieldIcon} aria-hidden="true" /></div></label><ContractButton onClick={() => void recover()} disabled={busy}>{busy ? "STARTING…" : `START ${mins}-MINUTE RECOVERY`}</ContractButton></>;
    } else if (row.status === "rewarded" && row.is_recovery) {
      actions = <><div className={`${cs.note} ${cs.success}`}>Recovered</div><div className={cs.note}>Small win still counts · {row.xp_awarded} XP · <CoinBadge amount={row.coins_awarded} state="earned" /></div></>;
    } else {
      actions = <div className={`${cs.note} ${row.status === "missed" ? cs.error : cs.success}`}>{READ_ONLY[row.status] ?? row.status}</div>;
    }
    body = <>{details}{actions}</>;
  }

  return (
    <div className="home-command-block">
      <section className={`${cs.scope} ${cs.card} ${completed ? cs.completed : ""} ${row?.status === "missed" ? cs.missed : ""}`} aria-label="Today’s Contract">
        <header className={cs.header}><span className={cs.shield}><ShieldCheck size={22} strokeWidth={1.8} /></span><span className={`${cs.mono} ${cs.headerLabel}`}>TODAY’S CONTRACT</span>{status && <span className={`${cs.mono} ${cs.status}`}><i aria-hidden="true" />{status}</span>}<CoinBadge amount={row?.status === "rewarded" && row.coins_awarded > 0 ? row.coins_awarded : row?.is_recovery ? 2 : 10} state={row?.status === "rewarded" && row.coins_awarded > 0 || daily?.contract_claimed && !row?.is_recovery ? "earned" : !daily ? "disabled" : "available"} awardId={awardId} /></header>
        {!row?.is_recovery && <p className={cs.note}>{daily?.contract_claimed ? "Daily reward claimed · resets at midnight" : "Complete the full contract to earn"}</p>}{body}
      </section>
      {sheet && (
        <ContractSheet
          title={sheet === "create" ? "New contract" : "Edit contract"}
          initial={sheet === "edit" && row ? formFromRow(row) : emptyForm()}
          goals={goals} busy={busy} serverError={saveErr} hasPartner={!!partner}
          onClose={() => setSheet(null)} onConfirm={save}
        />
      )}
      {proofOpen && row && (
        <ContractProofSheet contract={row} onClose={() => setProofOpen(false)}
          onDone={() => { setProofOpen(false); void load(); }} />
      )}
    </div>
  );
}

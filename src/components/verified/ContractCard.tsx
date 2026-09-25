import { useCallback, useEffect, useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AX, buttonStyle, cardStyle, subText, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { ContractSheet } from "./ContractSheet";
import { cancelContractReminders, scheduleContractReminders } from "@/lib/verified/contract-reminders";
import {
  PROOF_METHODS, REMINDER_PREFS, deviceTimezone, emptyForm, fmtWhen, formFromRow, friendlyError, toPayload,
  type ContractForm, type ContractRow,
} from "@/lib/verified/contracts";

const READ_ONLY: Record<string, string> = {
  proof_pending: "Session done — proof step comes next", verified: "Verified",
  rewarded: "Completed", missed: "Missed",
};

function localToday(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function ContractCard({ onStart, onResume }: {
  onStart?: (row: ContractRow) => Promise<void> | void;
  onResume?: (row: ContractRow) => void;
} = {}) {
  const tz = deviceTimezone();
  const [row, setRow] = useState<ContractRow | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([]);
  const [sheet, setSheet] = useState<null | "create" | "edit">(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async (): Promise<ContractRow | null> => {
    setLoadErr(null);
    const today = localToday(tz);
    const { data, error } = await supabase.from("daily_contracts")
      .select("*").eq("is_recovery", false).gte("local_day", today).neq("status", "cancelled")
      .order("scheduled_at", { ascending: true }).limit(1);
    if (error) { setLoadErr(friendlyError(error)); return null; }
    const fresh = (data?.[0] ?? null) as ContractRow | null;
    setRow(fresh);
    // reminders only make sense for a scheduled contract — clean up anything stale
    if (fresh && fresh.status !== "scheduled") void cancelContractReminders(fresh.id);
    return fresh;
  }, [tz]);

  useEffect(() => {
    load();
    supabase.from("goals").select("id,title").eq("completed", false).order("created_at")
      .then(({ data }) => setGoals((data ?? []) as any));
    const on = () => { void load(); };
    window.addEventListener("online", on);
    window.addEventListener("axen:contract-changed", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("axen:contract-changed", on); };
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

  const CARD = cardStyle();
  const head = <div style={titleStyle}><FileCheck2 size={16} strokeWidth={1.8} color={AX.accent} />Today’s Contract</div>;
  const openCreate = () => { setSaveErr(null); setSheet("create"); };

  let body: React.ReactNode;
  if (loadErr) {
    body = <><div role="alert" style={subText}>{loadErr}</div><button style={{ ...buttonStyle("ghost"), marginTop: 12 }} onClick={load}>Try again</button></>;
  } else if (row === undefined) {
    body = <div style={subText} aria-busy="true">Loading…</div>;
  } else if (row === null) {
    body = <><div style={subText}>Choose one action that makes today a win.</div>
      <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={openCreate}>CREATE CONTRACT</button></>;
  } else {
    const goal = goals.find(g => g.id === row.goal_id)?.title;
    const details = (
      <div style={{ ...subText, marginTop: 6 }}>
        {fmtWhen(row)} · {Math.round(row.planned_seconds / 60)} min · {PROOF_METHODS.find(p => p.id === row.proof_method)?.label ?? row.proof_method}
        {" · "}Difficulty {row.difficulty}/3 · {REMINDER_PREFS.find(p => p.id === row.reminder_pref)?.label}
        {goal && <div>Goal: {goal}</div>}
      </div>
    );
    const title = <div style={{ fontSize: 15, fontWeight: 600, color: AX.text }}>{row.title}</div>;
    if (row.status === "draft") {
      body = <>{title}<div style={{ fontSize: 12, color: AX.flame, marginTop: 4 }}>Draft — not confirmed yet</div>{details}
        <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={() => { setSaveErr(null); setSheet("edit"); }} disabled={busy}>REVIEW & CONFIRM</button>
        <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={cancel} disabled={busy}>Cancel</button></>;
    } else if (row.status === "scheduled") {
      body = <>{title}{details}
        <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={() => void start()} disabled={busy || !onStart}>{busy ? "STARTING…" : "START CONTRACT"}</button>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button style={{ ...buttonStyle("ghost"), flex: 1 }} onClick={() => { setSaveErr(null); setSheet("edit"); }} disabled={busy}>Reschedule</button>
          <button style={{ ...buttonStyle("ghost"), flex: 1 }} onClick={cancel} disabled={busy}>Cancel</button>
        </div></>;
    } else if (row.status === "active") {
      body = <>{title}<div style={{ fontSize: 12, color: AX.success, marginTop: 4 }}>In progress</div>{details}
        {onResume && <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={() => onResume(row)} disabled={busy}>RETURN TO SESSION</button>}</>;
    } else {
      body = <>{title}<div style={{ fontSize: 12, color: row.status === "missed" ? AX.danger : AX.success, marginTop: 4 }}>{READ_ONLY[row.status] ?? row.status}</div>{details}</>;
    }
  }

  return (
    <div className="home-command-block">
      <section style={CARD} aria-label="Today’s Contract">{head}{body}</section>
      {sheet && (
        <ContractSheet
          title={sheet === "create" ? "New contract" : "Edit contract"}
          initial={sheet === "edit" && row ? formFromRow(row) : emptyForm()}
          goals={goals} busy={busy} serverError={saveErr}
          onClose={() => setSheet(null)} onConfirm={save}
        />
      )}
    </div>
  );
}

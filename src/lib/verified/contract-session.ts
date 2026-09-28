import { supabase } from "@/integrations/supabase/client";
import type { ContractRow } from "@/lib/verified/contracts";
import { cancelContractReminders } from "@/lib/verified/contract-reminders";

/**
 * Contract focus session client. Thin wrapper over the existing Phase 1 RPCs
 * (start_contract_session / end_contract_session). No new database objects.
 * Time is always derived from timestamps (expected_end_at), never interval ticks.
 */

export type SessionSnapshot = {
  contractId: string;
  sessionId: string;
  startedAt: number;
  expectedEndAt: number;
  clientInstanceId: string;
};

const KEY = "axen_contract_session";

export function readCheckpoint(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.contractId || !s?.sessionId || !s?.expectedEndAt) return null;
    return s as SessionSnapshot;
  } catch { return null; }
}

export function clearCheckpoint() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

function writeCheckpoint(s: SessionSnapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export type StartResult = { ok: true; session: SessionSnapshot } | { ok: false; error: string };

export async function startContractSession(contract: ContractRow): Promise<StartResult> {
  const clientInstanceId = crypto.randomUUID();
  const { data, error } = await supabase.rpc("start_contract_session", {
    _contract_id: contract.id,
    _client_instance: clientInstanceId,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't start the session. Try again." };
  const session: SessionSnapshot = {
    contractId: contract.id,
    sessionId: data.id,
    startedAt: new Date(data.started_at).getTime(),
    expectedEndAt: new Date(data.expected_end_at).getTime(),
    clientInstanceId,
  };
  writeCheckpoint(session);
  await cancelContractReminders(contract.id);
  return { ok: true, session };
}

/** Resume after reload: find the still-active session for this contract server-side. */
export async function findActiveSession(contractId: string): Promise<SessionSnapshot | null> {
  const { data } = await supabase.from("contract_sessions")
    .select("id,contract_id,started_at,expected_end_at,client_instance_id")
    .eq("contract_id", contractId).eq("session_status", "active")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const session: SessionSnapshot = {
    contractId: data.contract_id,
    sessionId: data.id,
    startedAt: new Date(data.started_at).getTime(),
    expectedEndAt: new Date(data.expected_end_at).getTime(),
    clientInstanceId: data.client_instance_id ?? "",
  };
  writeCheckpoint(session);
  return session;
}

const ending = new Set<string>();

export async function endContractSession(sessionId: string, reason: string) {
  if (ending.has(sessionId)) return { ok: true as const }; // idempotent end
  ending.add(sessionId);
  try {
    const { error } = await supabase.rpc("end_contract_session", { _session_id: sessionId, _reason: reason });
    if (!error) clearCheckpoint();
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  } finally {
    ending.delete(sessionId);
  }
}

/** After app reload/resume: "resume" if time remains, "finish" if it ended while away. */
export function reconcileCheckpoint(): { kind: "resume" | "finish"; session: SessionSnapshot } | null {
  const s = readCheckpoint();
  if (!s) return null;
  return s.expectedEndAt > Date.now() ? { kind: "resume", session: s } : { kind: "finish", session: s };
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProofResult =
  | { ok: true; status: "verified" | "retry_requested" | "needs_review" | "unavailable" | "submitted"; message: string }
  | { ok: false; code: string; message: string };

type Input = { contractId: string; recall?: string; checklist?: boolean[]; imageBase64?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_CONFIDENCE = 0.4;
const MAX_RETRIES = 3;
const VERIFIER = "p4-v1";

const MESSAGES: Record<string, string> = {
  verified: "Proof accepted — contract verified.",
  retry_requested: "Not enough yet — please try again.",
  needs_review: "Your proof is waiting for review.",
  unavailable: "The photo check is unavailable right now. Try again later.",
  submitted: "Your proof was received.",
};

/** Private copy of the habit photo check call (same key, model, timeout). Image is never stored. */
async function detectPhoto(base64: string): Promise<{ ok: boolean; top: number; label: string }> {
  const apiKey = process.env["ROBOFLOW_API_KEY"];
  const model = process.env["ROBOFLOW_MODEL"] || "coco/9";
  if (!apiKey) return { ok: false, top: 0, label: "" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(apiKey)}&confidence=30&overlap=30&format=json`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: base64, signal: controller.signal,
    });
    if (!res.ok) { console.error("[contract-proof] detector http", res.status); return { ok: false, top: 0, label: "" }; }
    const json = (await res.json()) as { predictions?: { class?: string; confidence?: number }[] };
    const best = (json.predictions ?? []).map(p => ({ c: Number(p.confidence ?? 0), l: String(p.class ?? "") })).sort((a, b) => b.c - a.c)[0];
    return { ok: true, top: best?.c ?? 0, label: best?.l ?? "" };
  } catch {
    return { ok: false, top: 0, label: "" };
  } finally {
    clearTimeout(timer);
  }
}

function recallOk(t: string) {
  const s = t.trim();
  if (s.length < 40) return false;
  if (s.split(/\s+/).filter(Boolean).length < 8) return false;
  if (/(.)\1{7,}/.test(s)) return false;
  return new Set(s.toLowerCase().replace(/\s/g, "")).size >= 8;
}

export const submitContractProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input): Input => {
    if (!input || typeof input.contractId !== "string" || !UUID.test(input.contractId)) throw new Error("Invalid contract");
    const recall = typeof input.recall === "string" ? input.recall.slice(0, 600) : undefined;
    const checklist = Array.isArray(input.checklist) ? input.checklist.slice(0, 10).map(Boolean) : undefined;
    let imageBase64: string | undefined;
    if (typeof input.imageBase64 === "string" && input.imageBase64) {
      const raw = input.imageBase64;
      imageBase64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      if (imageBase64.length > 11_000_000) throw new Error("Image is too large — use a smaller photo");
    }
    return { contractId: input.contractId, recall, checklist, imageBase64 };
  })
  .handler(async ({ data, context }): Promise<ProofResult> => {
    const sb = context.supabase;
    const { data: c } = await sb.from("daily_contracts").select("id,status,proof_method").eq("id", data.contractId).maybeSingle();
    if (!c) return { ok: false, code: "not_found", message: "Contract not found." };

    const { data: prior } = await sb.from("proof_submissions").select("id,status").eq("contract_id", c.id).order("created_at", { ascending: false });
    const existing = (prior ?? []).find(p => p.status === "verified" || p.status === "submitted" || p.status === "needs_review");
    if (existing) return { ok: true, status: existing.status as "verified", message: MESSAGES[existing.status] };
    if (c.status !== "proof_pending") return { ok: false, code: "not_pending", message: "This contract isn't waiting for proof." };

    const { data: sess } = await sb.from("contract_sessions").select("id,session_status,started_at")
      .eq("contract_id", c.id).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (!sess || sess.session_status !== "completed") return { ok: false, code: "no_session", message: "Finish the focus session first." };

    const retries = (prior ?? []).filter(p => p.status === "retry_requested").length;
    let status: "verified" | "retry_requested" | "needs_review" | "unavailable" = "retry_requested";
    let confidence = 0; let reason = "";

    switch (c.proof_method) {
      case "timer": status = "verified"; confidence = 1; reason = "session_completed"; break;
      case "timer_recall":
        if (recallOk(data.recall ?? "")) { status = "verified"; confidence = 1; reason = "recall_ok"; } else reason = "recall_too_short";
        break;
      case "checklist": {
        const l = data.checklist ?? [];
        if (l.length > 0 && l.every(Boolean)) { status = "verified"; confidence = 1; reason = "checklist_complete"; } else reason = "checklist_incomplete";
        break;
      }
      case "photo": {
        if (!data.imageBase64 || data.imageBase64.length < 32) return { ok: false, code: "no_image", message: "Add a photo first." };
        const r = await detectPhoto(data.imageBase64);
        if (!r.ok) { status = "unavailable"; reason = "detector_unavailable"; }
        else { confidence = Math.round(r.top * 1000) / 1000; if (r.top >= MIN_CONFIDENCE) { status = "verified"; reason = "photo_match"; } else reason = "photo_low_confidence"; }
        break;
      }
      case "zen_session": {
        const { data: z } = await sb.from("focus_sessions").select("id").eq("tier", "zen").gte("created_at", sess.started_at).limit(1);
        if (z && z.length) { status = "verified"; confidence = 1; reason = "zen_completed"; } else reason = "zen_missing";
        break;
      }
      default: return { ok: false, code: "method", message: "Unsupported proof method." };
    }
    if (status === "retry_requested" && retries >= MAX_RETRIES) status = "needs_review";

    const { data: ins, error: insErr } = await sb.from("proof_submissions").insert({
      contract_id: c.id, session_id: sess.id, user_id: context.userId, proof_type: c.proof_method,
      text_evidence: c.proof_method === "timer_recall" ? (data.recall ?? "").trim() || null : null,
      private_storage_path: null,
    }).select("id").single();
    if (insErr || !ins) { console.error("[contract-proof] insert", insErr?.code); return { ok: false, code: "insert", message: "Couldn't save your proof. Please retry." }; }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: vErr } = await supabaseAdmin.rpc("verify_contract_proof", {
      _proof_id: ins.id, _status: status, _confidence: confidence, _reason: reason, _verifier: VERIFIER,
    });
    if (vErr) { console.error("[contract-proof] verify", vErr.code); return { ok: true, status: "submitted", message: MESSAGES.submitted }; }

    const msg = reason === "zen_missing" ? "Finish a Zen session first, then submit again."
      : reason === "recall_too_short" ? "Write at least a couple of sentences about what you did."
      : reason === "checklist_incomplete" ? "Tick every item to confirm." : MESSAGES[status];
    return { ok: true, status, message: msg };
  });

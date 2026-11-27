import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const WORKOUT_PROOF_COINS = 10;
export const WORKOUT_DAILY_COIN_CAP = 50;
export const WORKOUT_RETRY_WINDOW_MS = 60_000;
export const WORKOUT_MAX_ATTEMPTS_PER_WINDOW = 2; // 1 initial + 1 retry within 60s

export const buildWorkoutAuditPrompt = (workoutType: string) =>
  `You are a strict fitness discipline auditor. Verify if this live photo genuinely shows proof of completing the workout: "${workoutType}". Accept valid proof such as fitness equipment, gym environment, workout mat, running shoes outdoors, or a post-workout sweaty face/shirt. Immediately REJECT blank walls, pitch-black or blurry photos, ceiling fans, or photos taken of another phone/monitor screen. Return ONLY a JSON object: {"verified": true/false, "reason": "short 1-sentence feedback"}.`;

export function parseAuditVerdict(raw: string): { verified: boolean; reason: string } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { verified?: unknown; reason?: unknown };
    const verified = parsed.verified === true;
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim().slice(0, 240)
        : verified
          ? "Workout proof verified."
          : "Photo did not show clear workout proof.";
    return { verified, reason };
  } catch {
    return { verified: false, reason: "Could not verify photo. Please take a clear live photo." };
  }
}

export function computeWorkoutReward(earnedToday: number, alreadyCompletedToday: boolean): number {
  if (alreadyCompletedToday) return 0;
  const room = Math.max(WORKOUT_DAILY_COIN_CAP - Math.max(earnedToday, 0), 0);
  return Math.min(WORKOUT_PROOF_COINS, room);
}

const verifyInputSchema = z.object({
  taskId: z.string().uuid(),
  workoutType: z.string().trim().min(1).max(80),
  imageBase64: z.string().min(64).max(1_500_000),
});

export type VerifyWorkoutProofResult = {
  verified: boolean;
  reason: string;
  coins?: number;
  streak?: number;
  awarded?: number;
  retryAllowed: boolean;
  retryAfterSec?: number;
};

export const verifyWorkoutProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verifyInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<VerifyWorkoutProofResult> => {
    const apiKey = process.env["AXEN_PROOF_ENGINE"];
    if (!apiKey) {
      return {
        verified: false,
        reason: "Workout proof engine is not configured yet.",
        retryAllowed: true,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sinceIso = new Date(Date.now() - WORKOUT_RETRY_WINDOW_MS).toISOString();

    const { data: recent, error: recentErr } = await supabaseAdmin
      .from("workout_proof_attempts")
      .select("id, created_at, verified")
      .eq("user_id", context.userId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(WORKOUT_MAX_ATTEMPTS_PER_WINDOW);

    if (recentErr) {
      console.error("[workout-proof] recent check error:", recentErr.message);
    }

    const recentCount = recent?.length ?? 0;
    if (recentCount >= WORKOUT_MAX_ATTEMPTS_PER_WINDOW) {
      const oldest = recent?.[recent.length - 1];
      const elapsedMs = oldest ? Date.now() - new Date(oldest.created_at).getTime() : 0;
      const retryAfterSec = Math.max(1, Math.ceil((WORKOUT_RETRY_WINDOW_MS - elapsedMs) / 1000));
      return {
        verified: false,
        reason: `Retry limit reached. Wait ${retryAfterSec}s before trying again.`,
        retryAllowed: false,
        retryAfterSec,
      };
    }

    const cleanBase64 = data.imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    let verdict: { verified: boolean; reason: string };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: buildWorkoutAuditPrompt(data.workoutType) },
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 120,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        console.error("[workout-proof] gemini status:", res.status);
        return {
          verified: false,
          reason: "Verification service is busy. Please try again.",
          retryAllowed: true,
        };
      }

      const body = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      verdict = parseAuditVerdict(text);
    } catch (err) {
      console.error("[workout-proof] gemini fetch failed:", err);
      return {
        verified: false,
        reason: "Could not reach verification service. Try again.",
        retryAllowed: true,
      };
    }

    await supabaseAdmin.from("workout_proof_attempts").insert({
      user_id: context.userId,
      task_id: data.taskId,
      workout_type: data.workoutType,
      verified: verdict.verified,
      reason: verdict.reason,
    });

    if (!verdict.verified) {
      const usedRetries = recentCount + 1;
      return {
        verified: false,
        reason: verdict.reason,
        retryAllowed: usedRetries < WORKOUT_MAX_ATTEMPTS_PER_WINDOW,
        retryAfterSec: usedRetries < WORKOUT_MAX_ATTEMPTS_PER_WINDOW ? 0 : 60,
      };
    }

    const { data: rewardRows, error: rpcErr } = await supabaseAdmin.rpc(
      "complete_workout_with_proof",
      {
        _uid: context.userId,
        _task_id: data.taskId,
        _workout_type: data.workoutType,
      },
    );

    if (rpcErr) {
      console.error("[workout-proof] reward rpc error:", rpcErr.message);
      return {
        verified: false,
        reason: rpcErr.message || "Verified, but could not save completion.",
        retryAllowed: true,
      };
    }

    const row = Array.isArray(rewardRows) ? rewardRows[0] : rewardRows;
    return {
      verified: true,
      reason: verdict.reason,
      coins: row?.coins ?? 0,
      streak: row?.streak ?? 0,
      awarded: row?.awarded ?? 0,
      retryAllowed: false,
    };
  });
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCoachContext, type CoachContext } from "@/utils/coach-context.functions";

/**
 * Live-audio model. The requested "gemini-2.5-flash-native-audio-preview" alias
 * is not served by bidiGenerateContent; "-latest" is the current live alias.
 */
export const LIVE_MODEL = "models/gemini-2.5-flash-native-audio-latest";

/** Best-effort per-user throttle (per server instance). */
const starts = new Map<string, number[]>();
const MAX_STARTS_PER_HOUR = 30;

function rateLimit(userId: string) {
  const now = Date.now();
  const recent = (starts.get(userId) ?? []).filter((at) => now - at < 3_600_000);
  if (recent.length >= MAX_STARTS_PER_HOUR) {
    throw new Error("Too many voice sessions in the last hour. Try again shortly.");
  }
  recent.push(now);
  starts.set(userId, recent);
}

/**
 * Mints a short-lived Gemini ephemeral auth token. Returns null when the
 * account/key does not serve ephemeral tokens for BidiGenerateContent, so the
 * existing working session path stays available.
 */
async function mintEphemeralToken(apiKey: string): Promise<string | null> {
  try {
    const now = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(now + 30 * 60_000).toISOString(),
          newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
        }),
      },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { name?: string };
    return typeof json?.name === "string" && json.name.length > 0 ? json.name : null;
  } catch {
    // Never surface the permanent key or the upstream error detail.
    return null;
  }
}

/**
 * Returns what the browser needs to open one Gemini Live socket:
 * a short-lived credential (ephemeral token when available), the model, and the
 * authenticated user's verified AXEN coaching snapshot.
 *
 * The permanent key is never logged and is only handed out — scoped to one
 * in-memory session for an authenticated AXEN PRO user — when Google rejects
 * ephemeral tokens for this key.
 */
export const getLiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Voice coach is not configured yet.");

    const { data: premium } = await context.supabase.rpc("has_premium_access", {
      _user_id: context.userId,
    });
    if (!premium) throw new Error("Voice Coach is part of AXEN PRO.");

    rateLimit(context.userId);

    const [ephemeral, coachContext] = await Promise.all([
      mintEphemeralToken(apiKey),
      buildCoachContext(context.supabase, context.userId).catch(
        () => null as CoachContext | null,
      ),
    ]);

    return {
      apiKey: ephemeral ?? apiKey,
      ephemeral: ephemeral !== null,
      model: LIVE_MODEL,
      context: coachContext,
    };
  });

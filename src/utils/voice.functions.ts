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
 * Mints a short-lived Gemini ephemeral auth token scoped to exactly one live
 * audio session on LIVE_MODEL. Returns null when the key/project does not serve
 * ephemeral tokens, so the working session path stays available.
 */
async function mintEphemeralToken(apiKey: string): Promise<string | null> {
  try {
    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        bidiGenerateContentSetup: {
          model: LIVE_MODEL,
          generationConfig: { responseModalities: ["AUDIO"] },
        },
      }),
    });
    if (!response.ok) {
      console.error("[voice] ephemeral token request failed", response.status);
      return null;
    }
    const json = (await response.json()) as { name?: string };
    return typeof json?.name === "string" && json.name.length > 0 ? json.name : null;
  } catch {
    // Never surface the permanent key or the upstream error detail.
    return null;
  }
}

/**
 * Some Google projects mint ephemeral tokens that the Live endpoint then
 * refuses ("unregistered callers" / "API key not valid"). Probing once per
 * instance means a browser is never handed a credential Google will reject.
 */
let ephemeralSupported: boolean | null = null;
let probedAt = 0;

async function ephemeralTokenAccepted(token: string): Promise<boolean> {
  const SocketClass = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!SocketClass) return false;
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    };
    const socket = new SocketClass(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?access_token=${encodeURIComponent(token)}`,
    );
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          setup: { model: LIVE_MODEL, generationConfig: { responseModalities: ["AUDIO"] } },
        }),
      );
    socket.onmessage = () => done(true);
    socket.onerror = () => done(false);
    socket.onclose = () => done(false);
    setTimeout(() => done(false), 8_000);
  });
}

/**
 * Returns what the browser needs to open one Gemini Live socket:
 * a short-lived credential (ephemeral token when Google actually accepts one),
 * the query parameter it must be sent as, the model, and the authenticated
 * user's verified AXEN coaching snapshot.
 *
 * The permanent key is never logged and is only handed out — scoped to one
 * in-memory session for an authenticated AXEN PRO user — when Google rejects
 * ephemeral tokens for this key.
 */
export const getLiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["GEMINI_API_KEY"]?.trim();
    if (!apiKey) throw new Error("AI Coach is temporarily unavailable. Please try again shortly.");

    const { data: premium } = await context.supabase.rpc("has_premium_access", {
      _user_id: context.userId,
    });
    if (!premium) throw new Error("Voice Coach is part of AXEN PRO.");

    rateLimit(context.userId);

    const [minted, coachContext] = await Promise.all([
      ephemeralSupported === false && Date.now() - probedAt < 30 * 60_000
        ? Promise.resolve(null)
        : mintEphemeralToken(apiKey),
      buildCoachContext(context.supabase, context.userId).catch(
        () => null as CoachContext | null,
      ),
    ]);

    let ephemeral: string | null = null;
    if (minted) {
      if (ephemeralSupported === null || Date.now() - probedAt >= 30 * 60_000) {
        ephemeralSupported = await ephemeralTokenAccepted(minted);
        probedAt = Date.now();
        // The probe consumes the single-use token; mint a fresh one for the client.
        ephemeral = ephemeralSupported ? await mintEphemeralToken(apiKey) : null;
      } else if (ephemeralSupported) {
        ephemeral = minted;
      }
    }

    return {
      apiKey: ephemeral ?? apiKey,
      credentialParam: ephemeral ? ("access_token" as const) : ("key" as const),
      ephemeral: ephemeral !== null,
      model: LIVE_MODEL,
      context: coachContext,
    };
  });

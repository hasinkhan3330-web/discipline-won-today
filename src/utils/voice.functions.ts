import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LIVE_MODEL = "models/gemini-2.5-flash-native-audio-preview";

/**
 * Mints a short-lived ephemeral token for the Gemini Live API so the browser
 * can open the WebSocket directly WITHOUT ever seeing GEMINI_API_KEY.
 */
export const getLiveToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Voice coach is not configured yet.");

    const { data: premium } = await context.supabase.rpc("has_premium_access", { _user_id: context.userId });
    if (!premium) throw new Error("Voice Coach is part of AXEN PRO.");

    const now = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model: LIVE_MODEL,
            config: { responseModalities: ["AUDIO"] },
          },
        }),
      },
    );

    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Voice session could not start (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = JSON.parse(body) as { name?: string };
    if (!json.name) throw new Error("Voice session token was empty.");
    return { token: json.name, model: LIVE_MODEL };
  });

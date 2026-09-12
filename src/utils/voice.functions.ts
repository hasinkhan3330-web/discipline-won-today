import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Live-audio model. The requested "gemini-2.5-flash-native-audio-preview" alias
 * is not served by bidiGenerateContent; "-latest" is the current live alias.
 */
export const LIVE_MODEL = "models/gemini-2.5-flash-native-audio-latest";

/**
 * Returns the credentials the browser needs to open the Gemini Live socket.
 *
 * Google's ephemeral auth_tokens are rejected by the BidiGenerateContent
 * socket for this key, so the raw key is handed out — but only to an
 * authenticated AXEN PRO user, never bundled into client code, and only held
 * in memory for the length of one voice session.
 */
export const getLiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Voice coach is not configured yet.");

    const { data: premium } = await context.supabase.rpc("has_premium_access", { _user_id: context.userId });
    if (!premium) throw new Error("Voice Coach is part of AXEN PRO.");

    return { apiKey, model: LIVE_MODEL };
  });

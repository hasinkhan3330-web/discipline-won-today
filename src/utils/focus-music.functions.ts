import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const completeFocusMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    sessionToken: z.string().uuid(),
    minutes: z.union([z.literal(25), z.literal(45), z.literal(60), z.literal(90)]),
    intensity: z.enum(["calm", "steady", "intense"]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("complete_focus_music_session", {
      _session_token: data.sessionToken,
      _minutes: data.minutes,
      _intensity: data.intensity,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return { coins: Number(row?.coins ?? 0), awarded: Number(row?.awarded ?? 0), minutes: data.minutes };
  });
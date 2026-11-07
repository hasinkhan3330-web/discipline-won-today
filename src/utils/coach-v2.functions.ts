import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runCoachTool, materializeToday, setTimezone, getCoachProfile, COACH_TOOL_NAMES } from "@/lib/coach-tools";
import { profileConfidence, lowestSlot, type Slots } from "@/lib/coach-plan-rules";

const tzSchema = z.object({ timezone: z.string().min(1).max(64) });

/** Coach panel state: confidence, draft/confirmed plan. Also saves the user's timezone. */
export const getCoachV2State = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tzSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = { supabase: context.supabase, userId: context.userId };
    await setTimezone(ctx, data.timezone);
    const profile = await getCoachProfile(ctx);
    const { data: plans } = await context.supabase.from("coach_plans").select("id,status,days,plan,start_date").eq("user_id", context.userId).in("status", ["draft", "confirmed"]).order("created_at", { ascending: false }).limit(5);
    const rows = (plans ?? []) as any[];
    return {
      confidence: profileConfidence(profile.slots as Slots),
      nextSlot: lowestSlot(profile.slots as Slots),
      onboardingDone: profile.onboarding_done,
      timezone: profile.timezone,
      draft: rows.find((r) => r.status === "draft") ?? null,
      confirmed: rows.find((r) => r.status === "confirmed") ?? null,
    };
  });

/** Called on app open: adds today's plan tasks once (user's timezone). */
export const materializeCoachToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tzSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = { supabase: context.supabase, userId: context.userId };
    await setTimezone(ctx, data.timezone);
    return materializeToday(ctx);
  });

/** Runs one Coach tool as the signed-in user (used by the plan card buttons and VoiceCoach). */
export const runCoachToolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().refine((n) => COACH_TOOL_NAMES.includes(n)), args: z.record(z.string(), z.any()).default({}) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: premium } = await context.supabase.rpc("has_premium_access", { _user_id: context.userId });
    if (!premium) throw new Error("AI Coach is part of AXEN PRO.");
    const result = await runCoachTool({ supabase: context.supabase, userId: context.userId }, data.name, data.args);
    return JSON.parse(JSON.stringify(result ?? null)) as Record<string, any> | null;
  });

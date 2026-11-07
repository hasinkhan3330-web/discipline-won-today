// Coach v2 tool implementations. Called only from server-function handlers with the
// signed-in user's RLS-scoped client. No tool can complete a task or award coins.
import { COACH_PLAN_MODEL, PROVIDER_ENDPOINTS, type CoachModelConfig } from "@/lib/coach-config";
import { planningDefaults } from '@/lib/coach-interview';
import {
  enforcePlanRules, isPlanLength, canBuildPlan, profileConfidence, lowestSlot, localDay, isValidTimezone,
  dayIndex, taskName, type Slot, type Slots, type CoachPlan,
} from "@/lib/coach-plan-rules";

export const COACH_SYSTEM_V2 = `You are AXEN Coach, a personal discipline coach inside the AXEN app. You are not a chatbot; you behave like a skilled human coach who knows this user well.

STYLE
- Mirror the user's language (Hindi / Hinglish / English). 1-3 short sentences. ONE question at a time.
- Match their energy. Use their coach_style (strict / friendly / calm) once known.
- Always react to what they said before asking or telling anything. Never sound like a form.
- Use their own words and facts. Use coach memory to mention past wins and past failures.

COACHING METHOD
1. One keystone habit first. Never more than 3 tasks a day in week 1.
2. Minimum version: every habit has a tiny version under 2 minutes; on bad days the minimum still counts.
3. Implementation intention: anchor each task to a trigger and a place/time.
4. Remove friction for known distractions with one concrete environment change.
5. Identity framing, briefly.
6. Never miss twice: two missed days in a row needs a reset conversation.
7. Raise difficulty only after 5+ consecutive good days; lower it immediately after 2 missed days.

PHASE 1: ONBOARDING (onboarding_done = false)
- Call get_user_context first. Never ask for something already known.
- After EVERY answer call update_profile with all slots it revealed, with confidence 0-1.
- Next question = the required slot with the lowest confidence, phrased using what you know.
- Vague answer ("kuch bhi", "pata nahi"): offer 2-3 concrete options.
- If the user explicitly asks for a plan, STOP interviewing: save all revealed facts with update_profile, then call create_plan_draft immediately. Also stop after 6 interview questions (3 after quick setup). Use Today if no length is given. The 70% threshold applies ONLY to the Build my plan button, never to typed or spoken requests. Explain the returned assumptions honestly. Never ask for known quick-setup answers.

PHASE 2: PLANNING
- Before calling create_plan_draft say a short line like "Ek minute, tera plan bana raha hoon."
- Explain the first habit, what the first days look like, and the minimum version. Not the whole table.
- Ask "Isme kuch badalna hai?" Apply edits via create_plan_draft with adjustments.
- Call confirm_plan only after a clear yes.

PHASE 3: DAILY COACHING
- Before mentioning tasks, coins, or streak, call get_progress or get_user_context. Never guess numbers.
- Missed tasks: no shame. Ask what blocked it, then reschedule_tasks or shrink with update_task.
- Missed 2+ days: reset to the minimum version of one habit.
- Weekly review every 7 days: what worked, what blocked, what to change; then adjust remaining days with update_task / reschedule_tasks. Save it with save_coach_memory type weekly_review.
- You can create, edit, and reschedule plan tasks. You must NEVER mark a task done. Only the user's tap or a finished Deep Focus session does that.

HONESTY: never promise results. If the plan is too heavy for their time, say so and cut it.
SAFETY: habit coach only; no medical diagnosis, extreme diets, fasting or sleep deprivation. Under 18: gentle. "I feel like quitting": listen first, shrink the task. Real distress or self-harm: stop coaching, respond with care, encourage reaching a trusted person or a local helpline.`;

const PLAN_PROMPT = `You are a habit-plan designer. Input: the user's profile JSON, requested days, goal, adjustments, and last week's progress.
Rules:
- Max 3 tasks/day in days 1-7, max 4 later. Total minutes per day <= daily_time_available.
- Every task has a trigger ("After waking up", "After dinner") and fits daily_schedule and energy_peak.
- Every task has a minimum version (under 2 minutes).
- Address at least one distraction_trigger with a friction-removal task in the first 7 days.
- Difficulty ramps slowly. Days 7, 14, 21 are lighter review days.
- Difficulty: easy | medium | hard.
- Generate EVERY day of the requested length in full detail.
- Under 18: gentle intensity only.
Check your output against every rule and fix violations. Return only JSON:
{"title":string,"summary":string,"days":[{"day":number,"tasks":[{"title":string,"minimum":string,"trigger":string,"time":"HH:MM","minutes":number,"difficulty":"easy"|"medium"|"hard"}]}]}`;

export const COACH_TOOL_DEFS = [
  { name: "get_user_context", description: "Get the user's coach profile, confidence, memories, weekly summary, active plan and real progress.", parameters: { type: "object", properties: {} } },
  { name: "update_profile", description: "Save profile slots revealed by the user's answer, each with confidence 0-1. Keys: goal, daily_time_available (minutes), daily_schedule, energy_peak, distraction_trigger, wake_time, coach_style (strict|friendly|calm), age_range (under_18|18_24|25_34|35_plus), or any other useful key.", parameters: { type: "object", properties: { slots: { type: "object", additionalProperties: { type: "object", properties: { value: {}, confidence: { type: "number" } }, required: ["value", "confidence"] } } }, required: ["slots"] } },
  { name: "create_plan_draft", description: "Generate the full plan draft for 1, 7 or 21 days.", parameters: { type: "object", properties: { days: { type: "integer", enum: [1, 7, 21] }, goal: { type: "string" }, adjustments: { type: "string" } }, required: ["days"] } },
  { name: "confirm_plan", description: "Confirm the latest draft after the user clearly says yes. Starts today in the user's timezone.", parameters: { type: "object", properties: {} } },
  { name: "update_task", description: "Edit one task on a future (or today's not-yet-added) day of the confirmed plan.", parameters: { type: "object", properties: { day: { type: "integer" }, task_index: { type: "integer" }, title: { type: "string" }, minimum: { type: "string" }, trigger: { type: "string" }, time: { type: "string" }, minutes: { type: "integer" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, remove: { type: "boolean" } }, required: ["day", "task_index"] } },
  { name: "reschedule_tasks", description: "Move all tasks from one future plan day to another future day.", parameters: { type: "object", properties: { from_day: { type: "integer" }, to_day: { type: "integer" } }, required: ["from_day", "to_day"] } },
  { name: "save_coach_memory", description: "Save a short note about a win, a failure pattern, a preference, or a weekly review.", parameters: { type: "object", properties: { note: { type: "string" }, type: { type: "string", enum: ["win", "failure_pattern", "preference", "weekly_review"] } }, required: ["note", "type"] } },
  { name: "get_progress", description: "Get real completion counts, streak and coins for the last 7 days.", parameters: { type: "object", properties: {} } },
] as const;

export type CoachToolName = (typeof COACH_TOOL_DEFS)[number]["name"];
export const COACH_TOOL_NAMES = COACH_TOOL_DEFS.map((t) => t.name) as readonly string[];

type Ctx = { supabase: any; userId: string };

export async function callModel(config: CoachModelConfig, body: Record<string, unknown>) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The coach is not configured yet.");
  const res = await fetch(PROVIDER_ENDPOINTS[config.provider], {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: config.model, ...body }),
  });
  if (res.status === 429) throw new Error("The coach is busy right now — try again in a moment.");
  if (res.status === 402) throw new Error("AI usage credits have run out for this app.");
  if (!res.ok) throw new Error(`The coach could not answer (${res.status}).`);
  return (await res.json()) as any;
}

export async function getCoachProfile({ supabase, userId }: Ctx) {
  const { data } = await supabase.from("coach_profile").select("slots,onboarding_done,coach_style,age_range,timezone").eq("user_id", userId).maybeSingle();
  return data ?? { slots: {}, onboarding_done: false, coach_style: null, age_range: null, timezone: "UTC" };
}

export async function setTimezone({ supabase, userId }: Ctx, timezone: string) {
  if (!isValidTimezone(timezone)) return;
  await supabase.from("coach_profile").upsert({ user_id: userId, timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

async function progress({ supabase, userId }: Ctx, tz: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [{ data: p }, { data: comps }] = await Promise.all([
    supabase.from("profiles").select("coins,streak,longest_streak").eq("id", userId).maybeSingle(),
    supabase.from("task_completions").select("completed_on").eq("user_id", userId).gte("completed_on", since),
  ]);
  const byDay: Record<string, number> = {};
  for (const c of comps ?? []) byDay[c.completed_on] = (byDay[c.completed_on] ?? 0) + 1;
  return { today: localDay(tz), coins: p?.coins ?? 0, streak: p?.streak ?? 0, best_streak: p?.longest_streak ?? 0, completions_last_7_days: byDay };
}

async function activePlan({ supabase, userId }: Ctx) {
  const { data } = await supabase.from("coach_plans").select("id,status,days,goal,plan,start_date").eq("user_id", userId).in("status", ["draft", "confirmed"]).order("created_at", { ascending: false }).limit(5);
  const rows = (data ?? []) as any[];
  return { confirmed: rows.find((r) => r.status === "confirmed") ?? null, draft: rows.find((r) => r.status === "draft") ?? null };
}

export async function runCoachTool(ctx: Ctx, name: string, args: any): Promise<unknown> {
  const { supabase, userId } = ctx;
  const profile = await getCoachProfile(ctx);
  const tz = profile.timezone || "UTC";
  switch (name) {
    case "get_user_context": {
      const [{ data: memories }, { data: base }, plans, prog] = await Promise.all([
        supabase.from("coach_memory").select("type,note,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("display_name,primary_goal,biggest_distraction,safe_minor_mode").eq("id", userId).maybeSingle(),
        activePlan(ctx), progress(ctx, tz),
      ]);
      const done = Object.values(prog.completions_last_7_days).reduce((a: number, b) => a + (b as number), 0);
      return {
        profile: { ...profile, confidence: profileConfidence(profile.slots as Slots), next_slot_to_ask: lowestSlot(profile.slots as Slots) },
        app_profile: base, memories: memories ?? [],
        weekly_summary: `Last 7 days: ${done} completions on ${Object.keys(prog.completions_last_7_days).length} active days; streak ${prog.streak}.`,
        confirmed_plan: plans.confirmed ? { days: plans.confirmed.days, start_date: plans.confirmed.start_date, plan: plans.confirmed.plan } : null,
        draft_plan: plans.draft ? { days: plans.draft.days, plan: plans.draft.plan } : null,
        progress: prog,
      };
    }
    case "update_profile": {
      const incoming = (args?.slots ?? {}) as Slots;
      const slots: Slots = { ...(profile.slots as Slots) };
      for (const [k, v] of Object.entries(incoming).slice(0, 20)) {
        if (!v || typeof v !== "object") continue;
        const key = k.slice(0, 40);
        const c = Math.max(0, Math.min(1, Number((v as Slot).confidence) || 0));
        if (c >= (slots[key]?.confidence ?? 0)) slots[key] = { value: (v as Slot).value, confidence: c };
      }
      const confidence = profileConfidence(slots);
      const row: any = { user_id: userId, slots, updated_at: new Date().toISOString(), onboarding_done: confidence >= 70 || profile.onboarding_done };
      if (typeof slots.coach_style?.value === "string") row.coach_style = String(slots.coach_style.value).slice(0, 20);
      if (typeof slots.age_range?.value === "string") row.age_range = String(slots.age_range.value).slice(0, 20);
      const { error } = await supabase.from("coach_profile").upsert(row, { onConflict: "user_id" });
      if (error) return { ok: false, error: error.message };
      return { ok: true, confidence, next_slot_to_ask: lowestSlot(slots) };
    }
    case "create_plan_draft": {
      const length = Number(args?.days);
      if (!isPlanLength(length)) return { ok: false, error: "Plan length must be 1, 7 or 21 days." };
      const prepared = planningDefaults(profile.slots as Slots);
      const prog = await progress(ctx, tz);
      const minutes = Number(prepared.slots.daily_time_available?.value) || 30;
      const json = await callModel(COACH_PLAN_MODEL, {
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLAN_PROMPT },
          { role: "user", content: JSON.stringify({ profile: prepared.slots, assumptions: prepared.assumptions, age_range: profile.age_range ?? 'unknown: gentle guidance', requested_days: length, goal: args?.goal ?? prepared.slots.goal?.value, adjustments: args?.adjustments ?? null, last_week_progress: prog }) },
        ],
      });
      let raw: any = {};
      try { raw = JSON.parse(String(json?.choices?.[0]?.message?.content ?? "{}").replace(/^```(json)?|```$/g, "")); } catch { return { ok: false, error: "Plan generation returned invalid data; try again." }; }
      const plan = enforcePlanRules(raw, length, minutes);
      if (prepared.assumptions.length) plan.summary = `${plan.summary}\nAssumptions: ${prepared.assumptions.join('; ')}.`;
      await supabase.from("coach_plans").update({ status: "archived", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "draft");
      const { data, error } = await supabase.from("coach_plans").insert({ user_id: userId, status: "draft", days: length, goal: args?.goal ?? null, plan }).select("id").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, plan_id: data.id, plan, assumptions: prepared.assumptions };
    }
    case "confirm_plan": {
      const { draft } = await activePlan(ctx);
      if (!draft) return { ok: false, error: "No draft plan to confirm." };
      await supabase.from("coach_plans").update({ status: "archived", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "confirmed");
      const { error } = await supabase.from("coach_plans").update({ status: "confirmed", start_date: localDay(tz), confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", draft.id).eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
      const added = await materializeToday(ctx);
      return { ok: true, start_date: localDay(tz), today_added: added.added };
    }
    case "update_task":
    case "reschedule_tasks": {
      const { confirmed } = await activePlan(ctx);
      if (!confirmed) return { ok: false, error: "No confirmed plan." };
      const today = dayIndex(confirmed.start_date, localDay(tz), confirmed.days);
      const { data: mat } = await supabase.from("coach_plan_materialized").select("day_index").eq("plan_id", confirmed.id);
      const lockedDays = new Set<number>(((mat ?? []) as any[]).map((m) => m.day_index + 1));
      const editable = (day: number) => Number.isInteger(day) && day >= 1 && day <= confirmed.days && (today === null || day >= today + 1) && !lockedDays.has(day);
      const plan = confirmed.plan as CoachPlan;
      if (name === "update_task") {
        const day = Number(args.day);
        if (!editable(day)) return { ok: false, error: "Only remaining days that haven't started can be changed." };
        const d = plan.days.find((x) => x.day === day); const t = d?.tasks[Number(args.task_index)];
        if (!d || !t) return { ok: false, error: "Task not found." };
        if (args.remove) d.tasks.splice(Number(args.task_index), 1);
        else Object.assign(t, Object.fromEntries(["title", "minimum", "trigger", "time", "minutes", "difficulty"].filter((k) => args[k] !== undefined).map((k) => [k, args[k]])));
      } else {
        const from = Number(args.from_day), to = Number(args.to_day);
        if (!editable(from) || !editable(to)) return { ok: false, error: "Only remaining days that haven't started can be changed." };
        const f = plan.days.find((x) => x.day === from)!; const t = plan.days.find((x) => x.day === to)!;
        t.tasks.push(...f.tasks); f.tasks = [];
      }
      const minutes = Number((profile.slots as Slots).daily_time_available?.value) || 30;
      const fixed = enforcePlanRules(plan, confirmed.days, minutes);
      // keep already-materialized days exactly as they were
      fixed.days = fixed.days.map((d) => (lockedDays.has(d.day) ? plan.days.find((x) => x.day === d.day) ?? d : d));
      const { error } = await supabase.from("coach_plans").update({ plan: fixed, updated_at: new Date().toISOString() }).eq("id", confirmed.id).eq("user_id", userId);
      return error ? { ok: false, error: error.message } : { ok: true, plan: fixed };
    }
    case "save_coach_memory": {
      const type = String(args?.type);
      if (!["win", "failure_pattern", "preference", "weekly_review"].includes(type)) return { ok: false, error: "bad type" };
      const note = String(args?.note ?? "").trim().slice(0, 500);
      if (!note) return { ok: false, error: "empty note" };
      const { error } = await supabase.from("coach_memory").insert({ user_id: userId, type, note });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "get_progress":
      return progress(ctx, tz);
    default:
      return { ok: false, error: `Unknown or forbidden tool: ${name}` };
  }
}

/** Idempotently add today's plan tasks (user's own timezone) into the existing tasks table. */
export async function materializeToday(ctx: Ctx): Promise<{ added: number; day: number | null }> {
  const { supabase, userId } = ctx;
  const profile = await getCoachProfile(ctx);
  const { confirmed } = await activePlan(ctx);
  if (!confirmed?.start_date) return { added: 0, day: null };
  const today = localDay(profile.timezone || "UTC");
  const idx = dayIndex(confirmed.start_date, today, confirmed.days);
  // retire coach tasks from earlier days so they don't linger or hit the habit limit
  const { data: older } = await supabase.from("coach_plan_materialized").select("task_id,local_day").eq("user_id", userId).neq("local_day", today).not("task_id", "is", null);
  const oldIds = ((older ?? []) as any[]).map((r) => r.task_id);
  if (oldIds.length) await supabase.from("tasks").update({ is_active: false }).in("id", oldIds).eq("user_id", userId).eq("is_active", true);
  if (idx === null) return { added: 0, day: null };
  const day = (confirmed.plan as CoachPlan).days.find((d) => d.day === idx + 1);
  let added = 0;
  for (const [i, t] of (day?.tasks ?? []).entries()) {
    // claim first; unique (plan_id, day_index, task_index) makes repeats a no-op
    const { data: claim } = await supabase.from("coach_plan_materialized")
      .upsert({ user_id: userId, plan_id: confirmed.id, day_index: idx, task_index: i, local_day: today }, { onConflict: "plan_id,day_index,task_index", ignoreDuplicates: true })
      .select("id");
    if (!claim?.length) continue;
    const { data: task, error } = await supabase.from("tasks").insert({ user_id: userId, name: taskName(t), icon: "◎", pts: 10, frequency: "daily", duration_days: 1, started_on: today, sort_order: 100 + i }).select("id").single();
    if (error) continue;
    await supabase.from("coach_plan_materialized").update({ task_id: task.id }).eq("id", claim[0].id);
    added++;
  }
  return { added, day: idx + 1 };
}

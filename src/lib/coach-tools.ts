// Coach v2 tool implementations. Called only from server-function handlers with the
// signed-in user's RLS-scoped client. No tool can complete a task or award coins.
import { COACH_PLAN_MODEL, PROVIDER_ENDPOINTS, type CoachModelConfig } from "@/lib/coach-config";
import { planningDefaults } from '@/lib/coach-interview';
import {
  enforcePlanRules, isPlanLength, canBuildPlan, profileConfidence, getProfileCompleteness, PROFILE_LABELS, lowestSlot, localDay, isValidTimezone,
  dayIndex, taskName, type Slot, type Slots, type CoachPlan,
} from "@/lib/coach-plan-rules";
import { validatePlan, addDays, MAX_PLAN_DAYS, type ValidTask } from "@/lib/plan-tasks";

export const COACH_SYSTEM_V2 = `You are the Axon Habit coach. Stay strictly on the goal and habit plan in <user_profile>. No nutrition, gym or meditation advice unless it is the user's goal. Never say you have no details if percent > 0. Ask only missing fields, one at a time.

PROFILE TOOLS (mandatory)
- You MUST call get_profile_status before answering "what do you know about me", "how much is filled", "how much of my details do you have" or "make my plan". Answer with its exact percent, list every filled value and every missing field.
- Save each new answer with update_profile (field, value), then say the new percent it returns.

You are a personal discipline coach inside the AXEN app. You are not a chatbot; you behave like a skilled human coach who knows this user well.

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

PROFILE KNOWLEDGE (from the <user_profile> block, loaded by the server for this session)
- When asked how much you know, answer from <user_profile>: the exact percent, what you know, and what is missing. NEVER say 0% or "I haven't taken any details" when percent > 0.
- If percent < 100, ask ONLY the missing fields, one short question at a time. After each answer call update_profile, then tell the user the new percent returned by the tool.
- If the user asks for today's plan, do not block: build it from known fields, state assumptions for missing ones, then ask one missing question to refine it.
- Always respect intensity and the daily time limit. If age is unknown, keep guidance gentle and age-safe.

PHASE 1: ONBOARDING (onboarding_done = false)
- Call get_user_context first. Never ask for something already known.
- After EVERY answer call update_profile with all slots it revealed, with confidence 0-1.
- Next question = the required slot with the lowest confidence, phrased using what you know.
- Vague answer ("kuch bhi", "pata nahi"): offer 2-3 concrete options.
- If the user explicitly asks for a plan, STOP interviewing: save all revealed facts with update_profile, then build the plan and call save_plan immediately. Also stop after 6 interview questions (3 after quick setup). Use Today if no length is given. The 70% threshold applies ONLY to the Build my plan button, never to typed or spoken requests. Explain the returned assumptions honestly. Never ask for known quick-setup answers.

PHASE 2: PLANNING (save_plan is the ONLY way to save a plan)
- To create or change a plan you MUST call save_plan. Anything you only describe in chat is NOT saved. NEVER say a plan is saved unless save_plan returned success:true. If it returns success:false, say honestly that saving failed and why.
- For "what's my task today / this week?" call get_plan first and answer only from its rows.
- Ask at most 2 short questions (goal, time per day) if unknown, then build the plan. "Today" = 1 day (today's date). "Week" = 7 days starting today (or tomorrow if asked). Each day: 1-4 specific, measurable tasks, each with duration_minutes. Use real YYYY-MM-DD dates from the "Today is" line; never use other dates.
- You plan at most 7 days at a time. If asked for more (21 days, a month), say honestly that you plan 7 days at a time, save the first 7, and offer to plan the next week after.
- After a successful save, give a 2-line summary and say "open My Plan".

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
  { name: "save_plan", description: "Save (create or replace) the user's plan. The ONLY way to save a plan. Replaces not-completed tasks on the given dates. Dates: today up to 7 days ahead, YYYY-MM-DD. 1-4 tasks per day. Returns {success, saved_count} or {success:false, error}.", parameters: { type: "object", properties: { plan_title: { type: "string" }, tasks: { type: "array", items: { type: "object", properties: { task_date: { type: "string" }, day_number: { type: "integer" }, title: { type: "string" }, description: { type: "string" }, duration_minutes: { type: "integer" } }, required: ["task_date", "title", "duration_minutes"] } } }, required: ["plan_title", "tasks"] } },
  { name: "get_plan", description: "Read the user's saved plan tasks between two dates (YYYY-MM-DD, inclusive). Call before answering what today's or this week's tasks are.", parameters: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" } }, required: ["from_date", "to_date"] } },
  { name: "get_profile_status", description: "Exact saved profile status: {percent, filled, missing, plan}. Call before answering what you know, how much is filled, or making a plan.", parameters: { type: "object", properties: {} } },
  { name: "get_user_context", description: "Get the user's coach profile, confidence, memories, weekly summary, active plan and real progress.", parameters: { type: "object", properties: {} } },
  { name: "update_profile", description: "Save one answer as field + value (or several as slots). Fields: goal, wake_time, sleep_time, daily_time_available (minutes), distraction_trigger (main distraction), intensity (gentle|balanced|hardcore), age_range (under_18|18_24|25_34|35_plus, or a number of years), energy_peak, weakest_habit, daily_schedule, coach_style (strict|friendly|calm). Returns the new percent.", parameters: { type: "object", properties: { field: { type: "string" }, value: { type: "string" }, slots: { type: "object", additionalProperties: { type: "object", properties: { value: {}, confidence: { type: "number" } }, required: ["value", "confidence"] } } } } },
  { name: "create_plan_draft", description: "Generate the full plan draft for 1, 7 or 21 days.", parameters: { type: "object", properties: { days: { type: "integer", enum: [1, 7, 21] }, goal: { type: "string" }, adjustments: { type: "string" } }, required: ["days"] } },
  { name: "confirm_plan", description: "Confirm the latest draft after the user clearly says yes. Starts today in the user's timezone.", parameters: { type: "object", properties: {} } },
  { name: "update_task", description: "Edit one task on a future (or today's not-yet-added) day of the confirmed plan.", parameters: { type: "object", properties: { day: { type: "integer" }, task_index: { type: "integer" }, title: { type: "string" }, minimum: { type: "string" }, trigger: { type: "string" }, time: { type: "string" }, minutes: { type: "integer" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, remove: { type: "boolean" } }, required: ["day", "task_index"] } },
  { name: "reschedule_tasks", description: "Move all tasks from one future plan day to another future day.", parameters: { type: "object", properties: { from_day: { type: "integer" }, to_day: { type: "integer" } }, required: ["from_day", "to_day"] } },
  { name: "save_coach_memory", description: "Save a short note about a win, a failure pattern, a preference, or a weekly review.", parameters: { type: "object", properties: { note: { type: "string" }, type: { type: "string", enum: ["win", "failure_pattern", "preference", "weekly_review"] } }, required: ["note", "type"] } },
  { name: "get_progress", description: "Get real completion counts, streak and coins for the last 7 days.", parameters: { type: "object", properties: {} } },
] as const;

export type CoachToolName = (typeof COACH_TOOL_DEFS)[number]["name"];
export const COACH_TOOL_NAMES = COACH_TOOL_DEFS.map((t) => t.name) as readonly string[];
/** Tools the model may call (text and voice). Drafting/confirming stay only behind the plan-card buttons, so save_plan is the model's single save path. */
const BUTTON_ONLY_TOOLS = ["create_plan_draft", "confirm_plan"];
export const COACH_MODEL_TOOL_DEFS = COACH_TOOL_DEFS.filter((t) => !BUTTON_ONLY_TOOLS.includes(t.name));
export const COACH_MODEL_TOOL_NAMES = COACH_MODEL_TOOL_DEFS.map((t) => t.name) as readonly string[];

/** "Today is ..." line for the system instruction, in the user's timezone. */
export function todayLine(timezone: string) {
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  const today = localDay(tz);
  return `Today is ${today}, timezone ${tz}. Allowed plan dates: ${today} to ${addDays(today, MAX_PLAN_DAYS)}.`;
}

/** Atomic replace in plan_tasks (DB function runs as the caller; user = auth.uid()). */
async function writePlanTasks({ supabase }: Ctx, title: string, tasks: ValidTask[]) {
  const { data, error } = await supabase.rpc("save_plan_tasks", { _plan_title: title, _tasks: tasks });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, saved_count: Number(data ?? tasks.length) };
}

/** Best-effort mirror into the old plan store + today's Home tasks. Never affects save_plan's result. */
async function syncHome(ctx: Ctx, title: string, tasks: ValidTask[], today: string) {
  const { supabase, userId } = ctx;
  try {
    // Mirror the full saved week (today..today+6) from plan_tasks, not just the days in this save,
    // so editing one day never wipes the others from Home. Falls back to the submitted tasks.
    const { data: saved, error: readErr } = await supabase.from("plan_tasks").select("task_date,title,duration_minutes").eq("user_id", userId).gte("task_date", today).lte("task_date", addDays(today, 6)).order("task_date").order("created_at");
    const source: Pick<ValidTask, "task_date" | "title" | "duration_minutes">[] = !readErr && saved?.length ? saved : tasks;
    const byDay = new Map<number, Pick<ValidTask, "task_date" | "title" | "duration_minutes">[]>();
    for (const t of source) {
      const day = Math.round((Date.parse(t.task_date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000) + 1;
      if (day >= 1 && day <= 7) byDay.set(day, [...(byDay.get(day) ?? []), t]);
    }
    const length = Math.max(0, ...byDay.keys()) <= 1 ? 1 : 7;
    const plan: CoachPlan = { title, summary: "", days: Array.from({ length }, (_, i) => ({ day: i + 1, tasks: (byDay.get(i + 1) ?? []).map((t) => ({ title: t.title, minimum: t.title, trigger: "", minutes: t.duration_minutes ?? 10, difficulty: "medium" as const })) })) };
    const now = new Date().toISOString();
    await supabase.from("coach_plans").update({ status: "archived", updated_at: now }).eq("user_id", userId).in("status", ["confirmed", "draft"]);
    const { data: row, error } = await supabase.from("coach_plans").insert({ user_id: userId, status: "confirmed", days: length, goal: title, plan, start_date: today, confirmed_at: now }).select("id").single();
    if (error) throw error;
    // Replace (never append): retire today's Home tasks from earlier coach plans.
    const { data: prev } = await supabase.from("coach_plan_materialized").select("task_id").eq("user_id", userId).eq("local_day", today).neq("plan_id", row.id).not("task_id", "is", null);
    const ids = ((prev ?? []) as any[]).map((r) => r.task_id);
    if (ids.length) await supabase.from("tasks").update({ is_active: false }).in("id", ids).eq("user_id", userId).eq("is_active", true);
    const added = await materializeToday(ctx);
    console.log("[coach] save_plan home sync", { added: added.added });
  } catch (e) {
    console.error("[coach] save_plan home sync failed (plan_tasks result unaffected)", e instanceof Error ? e.message : e);
  }
}

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

/** Single shared profile status for every Coach path (text, voice, plan generation, get_profile_status tool). */
export async function profileStatus(ctx: Ctx) {
  const profile = await getCoachProfile(ctx);
  const slots = (profile.slots ?? {}) as Slots;
  const c = getProfileCompleteness(slots);
  const plans = await activePlan(ctx);
  const filled = Object.fromEntries(c.filled.map((k) => [PROFILE_LABELS[k] ?? k, slots[k]?.value]));
  const p = plans.confirmed ?? plans.draft;
  const plan = p ? { status: p.status, days: p.days, start_date: p.start_date ?? null, title: (p.plan as CoachPlan)?.title ?? null } : null;
  return { percent: c.percent, filled, missing: c.missing.map((k) => PROFILE_LABELS[k] ?? k), plan };
}

/** Server-built profile block injected into every Coach session prompt. Never trusts a client percent. */
export async function profileContextBlock(ctx: Ctx, _source?: string) {
  const st = await profileStatus(ctx);
  return `<user_profile percent="${st.percent}">\n${JSON.stringify(st)}\n</user_profile>`;
}

function normalizeAge(v: unknown): unknown {
  const n = Number(String(v).match(/\d+/)?.[0]);
  if (!/^(under_18|18_24|25_34|35_plus)$/.test(String(v)) && Number.isFinite(n) && n > 0) return n < 18 ? "under_18" : n <= 24 ? "18_24" : n <= 34 ? "25_34" : "35_plus";
  return v;
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
    case "save_plan": {
      console.log("[coach] tool save_plan args", JSON.stringify(args)?.slice(0, 2000));
      const today = localDay(tz);
      const v = validatePlan(args, today);
      if (!v.ok) { console.log("[coach] save_plan rejected", v.error); return { success: false, error: v.error }; }
      const result = await writePlanTasks(ctx, v.plan_title, v.tasks);
      console.log("[coach] save_plan db result", result);
      if (result.success) await syncHome(ctx, v.plan_title, v.tasks, today);
      return result;
    }
    case "get_plan": {
      console.log("[coach] tool get_plan args", args);
      const today = localDay(tz);
      const re = /^\d{4}-\d{2}-\d{2}$/;
      const from = re.test(String(args?.from_date)) ? String(args.from_date) : today;
      const to = re.test(String(args?.to_date)) ? String(args.to_date) : addDays(today, 6);
      const { data, error } = await supabase.from("plan_tasks").select("task_date,day_number,title,description,duration_minutes,completed,plan_title").eq("user_id", userId).gte("task_date", from).lte("task_date", to).order("task_date").order("created_at");
      console.log("[coach] get_plan db result", error ? error.message : `${data?.length ?? 0} rows`);
      return error ? { success: false, error: error.message } : { success: true, today, tasks: data ?? [] };
    }
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
    case "get_profile_status":
      return profileStatus(ctx);
    case "update_profile": {
      const incoming = { ...((args?.slots ?? {}) as Slots) };
      if (typeof args?.field === "string" && args.field && args?.value !== undefined && args?.value !== "") incoming[args.field] = { value: args.value, confidence: 1 };
      if (incoming.age_range) incoming.age_range = { ...incoming.age_range, value: normalizeAge(incoming.age_range.value) };
      const slots: Slots = { ...(profile.slots as Slots) };
      for (const [k, v] of Object.entries(incoming).slice(0, 20)) {
        if (!v || typeof v !== "object") continue;
        const key = k.slice(0, 40);
        const val = (v as Slot).value;
        if (val === undefined || val === null || String(val).length > 300) continue;
        if (key === "age_range" && !["under_18", "18_24", "25_34", "35_plus"].includes(String(val))) continue;
        if (key === "intensity" && !/^(gentle|balanced|hardcore)$/i.test(String(val))) continue;
        const c = Math.max(0, Math.min(1, Number((v as Slot).confidence) || 0));
        if (c >= (slots[key]?.confidence ?? 0)) slots[key] = { value: (v as Slot).value, confidence: c };
      }
      const confidence = profileConfidence(slots);
      const row: any = { user_id: userId, slots, updated_at: new Date().toISOString(), onboarding_done: confidence >= 70 || profile.onboarding_done };
      if (typeof slots.coach_style?.value === "string") row.coach_style = String(slots.coach_style.value).slice(0, 20);
      if (typeof slots.age_range?.value === "string") row.age_range = String(slots.age_range.value).slice(0, 20);
      const { error } = await supabase.from("coach_profile").upsert(row, { onConflict: "user_id" });
      if (error) return { ok: false, error: error.message };
      const done = getProfileCompleteness(slots);
      return { ok: true, confidence, percent: done.percent, filled: Object.fromEntries(done.filled.map((k) => [PROFILE_LABELS[k] ?? k, slots[k]?.value])), missing: done.missing.map((k) => PROFILE_LABELS[k] ?? k), next_slot_to_ask: lowestSlot(slots) };
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
          { role: "system", content: `${PLAN_PROMPT}\n\nThe plan must serve the goal in this server-loaded profile:\n${await profileContextBlock(ctx)}` },
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
      const start = localDay(tz);
      const rows: ValidTask[] = ((draft.plan as CoachPlan)?.days ?? []).filter((d) => d.day >= 1 && d.day <= MAX_PLAN_DAYS)
        .flatMap((d) => d.tasks.slice(0, 4).map((t) => ({ task_date: addDays(start, d.day - 1), day_number: d.day, title: t.title, description: [t.trigger, t.minimum && `Minimum: ${t.minimum}`].filter(Boolean).join(" · ") || null, duration_minutes: t.minutes ?? null })));
      const saved = rows.length ? await writePlanTasks(ctx, (draft.plan as CoachPlan)?.title ?? "My plan", rows) : { success: false as const, error: "Empty plan" };
      console.log("[coach] confirm_plan -> plan_tasks", saved);
      return { ok: true, start_date: start, today_added: added.added, success: saved.success, saved_count: saved.success ? saved.saved_count : 0 };
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

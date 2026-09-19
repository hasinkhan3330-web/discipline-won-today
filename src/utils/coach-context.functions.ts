import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeName } from "@/lib/display-name";

/**
 * Verified coaching snapshot for the AXEN voice coach.
 *
 * Every number comes from the existing AXEN tables / RPCs. Anything that cannot
 * be derived truthfully is returned as `null` so the model can say it does not
 * know instead of inventing it.
 */

type Nullable<T> = T | null;

export type CoachContext = {
  user: {
    first_name: Nullable<string>;
    preferred_language: Nullable<string>;
    timezone: Nullable<string>;
    coaching_style: Nullable<string>;
  };
  today: {
    date: string;
    completed_tasks_count: number;
    pending_tasks_count: number;
    missed_tasks_count: number;
    completed_task_names: string[];
    pending_task_names: string[];
    missed_task_names: string[];
    coins_earned_today: number;
  };
  habits: {
    current_streak: number;
    best_streak: number;
    strongest_habit: Nullable<string>;
    most_frequently_missed_habit: Nullable<string>;
    recently_missed_habits: string[];
    seven_day_completion_rate: Nullable<number>;
    thirty_day_completion_rate: Nullable<number>;
    recent_pattern: Nullable<string>;
  };
  goals: {
    primary_goal: Nullable<string>;
    active_goals: string[];
    goal_progress: Array<{ goal: string; progress: Nullable<number> }>;
  };
  rewards: {
    total_coins: number;
    next_reward_target: Nullable<number>;
    coins_needed_for_next_target: Nullable<number>;
  };
  leaderboard: {
    current_rank: Nullable<number>;
    total_ranked_users: Nullable<number>;
    previous_rank: Nullable<number>;
    rank_change: Nullable<number>;
    user_above: Nullable<string>;
    points_or_coins_gap_to_next_rank: Nullable<number>;
  };
  coach_memory: {
    last_session_summary: Nullable<string>;
    last_committed_action: Nullable<string>;
    last_check_in_date: Nullable<string>;
  };
};

const DAY_MS = 86_400_000;
const dayKey = (value: Date) => value.toISOString().slice(0, 10);

/** Supabase client shape is generated; the snapshot only reads known columns. */
type Client = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

async function requirePremium(supabase: Client, userId: string) {
  const { data } = await supabase.rpc("has_premium_access", { _user_id: userId });
  if (!data) throw new Error("Voice Coach is part of AXEN PRO.");
}

async function loadTodaySlice(supabase: Client, userId: string) {
  const today = dayKey(new Date());
  const [{ data: tasks }, { data: doneToday }, { data: coinsToday }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,name,pts,started_on")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("task_completions")
      .select("task_id,coins_awarded")
      .eq("user_id", userId)
      .eq("completed_on", today),
    supabase
      .from("coin_transactions")
      .select("amount,created_at")
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00.000Z`),
  ]);

  const activeTasks: Array<{ id: string; name: string; started_on?: string }> = tasks ?? [];
  const doneIds = new Set<string>((doneToday ?? []).map((row: any) => row.task_id));
  const completed = activeTasks.filter((task) => doneIds.has(task.id));
  const pending = activeTasks.filter((task) => !doneIds.has(task.id));
  const coins_earned_today = (coinsToday ?? []).reduce(
    (total: number, row: any) => total + (row.amount > 0 ? row.amount : 0),
    0,
  );

  return {
    today,
    activeTasks,
    slice: {
      date: today,
      completed_tasks_count: completed.length,
      pending_tasks_count: pending.length,
      // Today's open habits are pending, never "missed" — the day is not over.
      missed_tasks_count: 0,
      completed_task_names: completed.map((task) => task.name),
      pending_task_names: pending.map((task) => task.name),
      missed_task_names: [] as string[],
      coins_earned_today,
    },
  };
}

async function loadLeaderboard(supabase: Client, userId: string) {
  const [{ data: position }, { data: board }] = await Promise.all([
    supabase.rpc("my_leaderboard_position", { _scope: "global", _period: "alltime" }),
    supabase.rpc("leaderboard_top", {
      _scope: "global",
      _period: "alltime",
      _limit: 100,
      _offset: 0,
    }),
  ]);
  const me = Array.isArray(position) ? position[0] : position;
  const rows: any[] = board ?? [];
  const myIndex = rows.findIndex((row) => row.user_id === userId);
  const above = myIndex > 0 ? rows[myIndex - 1] : null;
  return {
    current_rank: me?.rank ?? null,
    total_ranked_users: me?.total ?? null,
    // AXEN does not store historical rank snapshots yet.
    previous_rank: null,
    rank_change: null,
    user_above: above ? safeName(above.username) : null,
    points_or_coins_gap_to_next_rank: me?.points_to_next ?? null,
  } satisfies CoachContext["leaderboard"];
}

export async function buildCoachContext(supabase: any, userId: string): Promise<CoachContext> {
  const since = dayKey(new Date(Date.now() - 29 * DAY_MS));
  const [{ data: profile }, todayPart, { data: history }, { data: lastSession }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name,preferred_name,username,coins,streak,longest_streak,primary_goal,onboarding_goal,first_habit,biggest_distraction,preferred_focus_time,safe_minor_mode",
        )
        .eq("id", userId)
        .maybeSingle(),
      loadTodaySlice(supabase, userId),
      supabase
        .from("task_completions")
        .select("task_id,completed_on")
        .eq("user_id", userId)
        .gte("completed_on", since),
      supabase
        .from("coach_sessions")
        .select("short_session_summary,user_agreed_next_action,started_at,next_check_in_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const leaderboard = await loadLeaderboard(supabase, userId);

  const completions: Array<{ task_id: string; completed_on: string }> = history ?? [];
  const activeTasks = todayPart.activeTasks;
  const byTask = new Map<string, Set<string>>();
  for (const row of completions) {
    const set = byTask.get(row.task_id) ?? new Set<string>();
    set.add(row.completed_on);
    byTask.set(row.task_id, set);
  }

  const last7 = Array.from({ length: 7 }, (_, index) => dayKey(new Date(Date.now() - index * DAY_MS)));
  const last30 = Array.from({ length: 30 }, (_, index) => dayKey(new Date(Date.now() - index * DAY_MS)));
  const rate = (days: string[]) => {
    if (activeTasks.length === 0) return null;
    let hits = 0;
    for (const task of activeTasks) {
      const set = byTask.get(task.id);
      for (const day of days) if (set?.has(day)) hits += 1;
    }
    return Math.round((hits / (activeTasks.length * days.length)) * 100);
  };

  const ranked = activeTasks
    .map((task) => ({
      name: task.name,
      hits30: byTask.get(task.id)?.size ?? 0,
      recent: last7.filter((day) => byTask.get(task.id)?.has(day)).length,
    }))
    .sort((a, b) => b.hits30 - a.hits30);

  const strongest = ranked[0] && ranked[0].hits30 > 0 ? ranked[0].name : null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const recentlyMissed = ranked.filter((item) => item.recent === 0).map((item) => item.name);

  const sevenRate = rate(last7);
  const thirtyRate = rate(last30);
  const recentPattern =
    sevenRate === null || thirtyRate === null
      ? null
      : sevenRate - thirtyRate >= 8
        ? "improving"
        : thirtyRate - sevenRate >= 8
          ? "declining"
          : "steady";

  const coins = profile?.coins ?? 0;
  const ladder = [100, 250, 500, 1000, 2500, 5000, 10000];
  const nextTarget = ladder.find((step) => step > coins) ?? null;

  const goals = [profile?.primary_goal, profile?.onboarding_goal, profile?.first_habit].filter(
    (value): value is string => Boolean(value),
  );

  return {
    user: {
      first_name: safeName(profile?.preferred_name || profile?.display_name || profile?.username, "")
        .split(" ")[0] || null,
      preferred_language: null,
      timezone: null,
      coaching_style: null,
    },
    today: todayPart.slice,
    habits: {
      current_streak: profile?.streak ?? 0,
      best_streak: profile?.longest_streak ?? 0,
      strongest_habit: strongest,
      most_frequently_missed_habit: weakest && weakest.hits30 < (ranked[0]?.hits30 ?? 0) ? weakest.name : null,
      recently_missed_habits: recentlyMissed.slice(0, 4),
      seven_day_completion_rate: sevenRate,
      thirty_day_completion_rate: thirtyRate,
      recent_pattern: recentPattern,
    },
    goals: {
      primary_goal: profile?.primary_goal ?? null,
      active_goals: goals,
      goal_progress: [],
    },
    rewards: {
      total_coins: coins,
      next_reward_target: nextTarget,
      coins_needed_for_next_target: nextTarget === null ? null : nextTarget - coins,
    },
    leaderboard,
    coach_memory: {
      last_session_summary: lastSession?.short_session_summary ?? null,
      last_committed_action: lastSession?.user_agreed_next_action ?? null,
      last_check_in_date: lastSession?.started_at ? String(lastSession.started_at).slice(0, 10) : null,
    },
  };
}

/** Full verified snapshot handed to the voice session at start. */
export const getCoachContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePremium(context.supabase as unknown as Client, context.userId);
    return buildCoachContext(context.supabase as unknown as Client, context.userId);
  });

/** Lightweight refresh of today's tasks and coins. */
export const getTodayProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as Client;
    await requirePremium(client, context.userId);
    const { slice } = await loadTodaySlice(client, context.userId);
    return slice;
  });

/** Lightweight refresh of the official leaderboard position. */
export const getLeaderboardPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as Client;
    await requirePremium(client, context.userId);
    return loadLeaderboard(client, context.userId);
  });

const summarySchema = z.object({
  session_id: z.string().max(120).nullable().optional(),
  short_session_summary: z.string().min(1).max(600),
  user_agreed_next_action: z.string().max(300).nullable().optional(),
  next_check_in_at: z.string().datetime().nullable().optional(),
  model: z.string().max(120).nullable().optional(),
});

/** The only write the model can request: its own compact session memory. */
export const saveCoachSessionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => summarySchema.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as Client;
    await requirePremium(client, context.userId);
    const { error } = await client.from("coach_sessions").insert({
      user_id: context.userId,
      session_id: data.session_id ?? null,
      ended_at: new Date().toISOString(),
      short_session_summary: data.short_session_summary,
      user_agreed_next_action: data.user_agreed_next_action ?? null,
      next_check_in_at: data.next_check_in_at ?? null,
      provider: "gemini-live",
      model: data.model ?? null,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

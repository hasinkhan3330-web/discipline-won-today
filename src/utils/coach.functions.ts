import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachMessage = { role: "user" | "assistant"; content: string };

type AskInput = { messages: CoachMessage[] };

function validate(input: unknown): AskInput {
  const raw = input as AskInput;
  if (!raw || !Array.isArray(raw.messages) || raw.messages.length === 0) {
    throw new Error("No question was sent.");
  }
  const messages = raw.messages
    .slice(-12)
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (messages.length === 0) throw new Error("No question was sent.");
  return { messages };
}

/** Compact, factual snapshot of the signed-in user's discipline data. */
async function buildContext(supabase: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [{ data: profile }, { data: tasks }, { data: comps }] = await Promise.all([
    supabase.from("profiles").select("display_name, coins, streak, longest_streak, shields, onboarding_goal, onboarding_blocker").eq("id", userId).maybeSingle(),
    supabase.from("tasks").select("id, name, pts").eq("user_id", userId).eq("is_active", true),
    supabase.from("task_completions").select("task_id, completed_on").eq("user_id", userId).gte("completed_on", since),
  ]);

  const byTask = new Map<string, number>();
  const days = new Set<string>();
  for (const c of comps ?? []) {
    byTask.set(c.task_id, (byTask.get(c.task_id) ?? 0) + 1);
    days.add(c.completed_on);
  }
  const habitLines = (tasks ?? []).map((t: any) => {
    const hits = byTask.get(t.id) ?? 0;
    const doneToday = (comps ?? []).some((c: any) => c.task_id === t.id && c.completed_on === today);
    return `- ${t.name}: ${hits}/30 days in the last month, ${doneToday ? "done today" : "NOT done today"}`;
  });

  return [
    `Name: ${profile?.display_name ?? "Athlete"}`,
    `Current streak: ${profile?.streak ?? 0} days (best ${profile?.longest_streak ?? 0})`,
    `Coins: ${profile?.coins ?? 0} · Streak shields: ${profile?.shields ?? 0}`,
    `Active days in last 30: ${days.size}`,
    profile?.onboarding_goal ? `Stated goal: ${profile.onboarding_goal}` : "",
    profile?.onboarding_blocker ? `Stated blocker: ${profile.onboarding_blocker}` : "",
    "Habits:",
    ...habitLines,
  ].filter(Boolean).join("\n");
}

const SYSTEM = `You are AXEN Coach, the discipline coach inside the AXEN habit app.
Rules:
- You know the user's real data (given below). Reference the actual numbers.
- Be direct, warm and concrete. No fluff, no therapy-speak, no emoji spam.
- Keep answers under 130 words. Use short lines or at most 3 bullets.
- Always end with one specific action the user can take today.
- Never invent data you were not given. Never discuss billing or refunds.`;

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("The coach is not configured yet.");

    const { data: premium } = await context.supabase.rpc("has_premium_access", { _user_id: context.userId });
    if (!premium) throw new Error("AI Coach is part of AXEN PRO.");

    const snapshot = await buildContext(context.supabase, context.userId);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: `${SYSTEM}\n\nUSER DATA:\n${snapshot}` },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) throw new Error("The coach is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI usage credits have run out for this app.");
    if (!res.ok) throw new Error(`The coach could not answer (${res.status}).`);

    const json = (await res.json()) as any;
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("The coach returned an empty answer.");
    return { reply };
  });

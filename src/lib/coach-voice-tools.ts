// Gemini Live adapter for the same 8 Coach v2 tools used by the text Coach.
import { COACH_SYSTEM_V2, COACH_TOOL_DEFS, COACH_TOOL_NAMES, runCoachTool } from "@/lib/coach-tools";

export const MAX_VOICE_TOOL_CALLS_PER_TURN = 6;

const SLOT_KEYS = ["goal", "daily_time_available", "daily_schedule", "energy_peak", "distraction_trigger", "wake_time", "sleep_time", "coach_style", "age_range", "intensity", "weakest_habit", "other"];

/** JSON-schema → Gemini OpenAPI subset (uppercase types, no additionalProperties, no untyped values). */
function toGemini(schema: any): any {
  if (!schema || typeof schema !== "object") return { type: "STRING" };
  const out: any = { type: String(schema.type ?? "string").toUpperCase() };
  if (schema.enum) { out.enum = schema.enum.map(String); if (out.type === "INTEGER") { out.type = "STRING"; } }
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]: any) => [k, v && v.type ? toGemini(v) : { type: "STRING" }]));
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGemini(schema.items);
  return out;
}

const slot = { type: "OBJECT", properties: { value: { type: "STRING" }, confidence: { type: "NUMBER" } }, required: ["value", "confidence"] };

/** Tool declarations sent once at Live session setup. */
export const VOICE_TOOL_DECLARATIONS = [{
  functionDeclarations: COACH_TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.name === "update_profile"
      ? { type: "OBJECT", properties: { field: { type: "STRING", enum: SLOT_KEYS.filter((k) => k !== "other") }, value: { type: "STRING" }, slots: { type: "OBJECT", properties: Object.fromEntries(SLOT_KEYS.map((k) => [k, slot])) } } }
      : toGemini(t.parameters),
  })),
}];

export const VOICE_SYSTEM_V2 = `${COACH_SYSTEM_V2}

VOICE RULES
You are speaking, not writing: short natural sentences, no markdown or lists, never read tool names or field names aloud. Speak the user's language (Hindi/Hinglish welcome).
Interview one question at a time and save ALL revealed answers with update_profile. Stop immediately on an explicit plan request or after 6 questions (3 after quick setup); call create_plan_draft, even below 70%, and explain assumptions. Never repeat known quick-setup questions.
Before calling create_plan_draft, first say one short line such as "Give me a minute, I'm building your plan."
Call confirm_plan only after the user clearly says yes to the draft out loud. If unsure, ask again.
If a tool fails, say so in one short sentence and carry on. Never claim a task is done or coins were given; you cannot do either.
On SESSION_START, call get_profile_status first, then greet briefly using the user's goal from it and continue where the user is: ask the first missing field if percent < 100, otherwise coach on today's plan.`;

/** One server-built Live setup: baked into the ephemeral token (Google locks token setup and ignores client overrides) and sent by the client unchanged. */
export function buildLiveSetup(model: string, instruction: string) {
  return {
    model,
    generationConfig: { responseModalities: ["AUDIO"] },
    systemInstruction: { parts: [{ text: instruction }] },
    tools: VOICE_TOOL_DECLARATIONS,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
  };
}

type Call = { id?: string; name: string; args?: Record<string, unknown> };
type Ctx = { supabase: any; userId: string };
type Runner = (ctx: Ctx, name: string, args: any) => Promise<unknown>;

/** Runs one toolCall batch. Unknown names and calls beyond the per-turn cap are refused. */
export async function runVoiceToolCalls(ctx: Ctx, calls: Call[], run: Runner = runCoachTool) {
  const functionResponses: Array<{ id?: string; name: string; response: Record<string, unknown> }> = [];
  for (const [i, c] of calls.entries()) {
    const name = String(c.name ?? "");
    if (i >= MAX_VOICE_TOOL_CALLS_PER_TURN) { functionResponses.push({ id: c.id, name, response: { ok: false, error: "Too many tool calls this turn." } }); continue; }
    if (!COACH_TOOL_NAMES.includes(name)) { functionResponses.push({ id: c.id, name, response: { ok: false, error: `Unknown or forbidden tool: ${name}` } }); continue; }
    try {
      const result = await run(ctx, name, c.args ?? {});
      functionResponses.push({ id: c.id, name, response: { result: (result ?? null) as unknown } as Record<string, unknown> });
    } catch (e) {
      functionResponses.push({ id: c.id, name, response: { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "unavailable" } });
    }
  }
  return { functionResponses };
}

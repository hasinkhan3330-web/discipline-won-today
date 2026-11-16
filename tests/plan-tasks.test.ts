import { describe, it, expect } from "vitest";
import { validatePlan, addDays } from "../src/lib/plan-tasks";
import { COACH_MODEL_TOOL_NAMES } from "../src/lib/coach-tools";
import { VOICE_TOOL_DECLARATIONS } from "../src/lib/coach-voice-tools";

const today = "2026-11-14";
const t = (task_date: string, title = "Read 20 pages") => ({ task_date, title, duration_minutes: 20 });

describe("save_plan validation", () => {
  it("accepts today through 7 days ahead", () => {
    const r = validatePlan({ plan_title: "Week", tasks: [t(today), t(addDays(today, 7))] }, today);
    expect(r.ok).toBe(true);
  });
  it("rejects yesterday", () => {
    expect(validatePlan({ plan_title: "x", tasks: [t("2026-11-13")] }, today).ok).toBe(false);
  });
  it("rejects 8 days ahead", () => {
    expect(validatePlan({ plan_title: "x", tasks: [t(addDays(today, 8))] }, today).ok).toBe(false);
  });
  it("rejects impossible dates and empty titles", () => {
    expect(validatePlan({ tasks: [t("2026-02-30")] }, "2026-02-01").ok).toBe(false);
    expect(validatePlan({ tasks: [t(today, "  ")] }, today).ok).toBe(false);
  });
  it("rejects a 5th task on one day", () => {
    expect(validatePlan({ tasks: [1, 2, 3, 4, 5].map(() => t(today)) }, today).ok).toBe(false);
  });
  it("rejects empty plans", () => {
    expect(validatePlan({ tasks: [] }, today).ok).toBe(false);
  });
});

describe("coach tool list", () => {
  it("save_plan is the only save path the model sees", () => {
    expect(COACH_MODEL_TOOL_NAMES).toContain("save_plan");
    expect(COACH_MODEL_TOOL_NAMES).toContain("get_plan");
    expect(COACH_MODEL_TOOL_NAMES).not.toContain("create_plan_draft");
    expect(COACH_MODEL_TOOL_NAMES).not.toContain("confirm_plan");
  });
  it("voice save_plan is blocking", () => {
    const d = VOICE_TOOL_DECLARATIONS[0].functionDeclarations.find((f: any) => f.name === "save_plan") as any;
    expect(d.behavior).toBe("BLOCKING");
  });
});

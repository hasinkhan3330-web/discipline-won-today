import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0053_wake_cutoff_0730.sql", "utf8");
const fns = sql.split("CREATE OR REPLACE FUNCTION").slice(1);

test("both wake reward paths stop coins at/after 07:30 local, server clock", () => {
  expect(fns.length).toBe(2);
  for (const f of fns) {
    expect(f).toContain("WHEN now()>=((e.local_date+time '07:30') AT TIME ZONE e.timezone) THEN 'after_cutoff' ELSE 'eligible'");
    expect(f).toContain("IF result='eligible' THEN");
  }
});

test("both wake reward paths skip XP after the cutoff but keep streak", () => {
  for (const f of fns) {
    expect(f).toContain("IF result<>'after_cutoff' AND public.wake_slot_reward(");
    expect(f).toContain("UPDATE public.profiles SET streak=");
  }
});

test("Math/Science solve path also stops coins and XP at/after 07:30", () => {
  const f = readFileSync("drizzle/migrations/0054_wake_cutoff_0730_math_science.sql", "utf8");
  expect(f).toContain("WHEN clock_timestamp()>=((e.local_date+time '07:30') AT TIME ZONE e.timezone) THEN 'after_cutoff' ELSE 'eligible'");
  expect(f).toContain("IF result<>'after_cutoff' AND public.wake_slot_reward(");
  expect(f).toContain("UPDATE public.profiles SET streak=");
  expect(f).toContain("PERFORM public.wake_create_occurrence(a.id)");
});

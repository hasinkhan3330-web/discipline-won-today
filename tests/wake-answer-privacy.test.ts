import { beforeAll, expect, test } from "bun:test";
import postgres from "postgres";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import bank from "../src/lib/wake-science-bank.server.json";

// Disposable database only (WAKE_TEST_DATABASE_URL). Never defaults to the shared/live database.
const url = process.env.WAKE_TEST_DATABASE_URL;
const db = url ? test : test.skip;
const sql = url ? postgres(url, { max: 4 }) : null;
const MATH_USER = "10000000-0000-4000-8000-000000000005";
const SCIENCE_USER = "10000000-0000-4000-8000-000000000006";

// Exact allowlists of what the browser may receive.
const STATE_KEYS = ["event", "local_date", "server_now", "settings", "timezone"];
const EVENT_KEYS = ["awarded", "first_ring_at", "id", "is_test", "local_date", "question", "result", "scheduled_for", "status", "tier", "time", "timezone", "tone"];
const QUESTION_KEYS = ["correct_in_row", "id", "options", "text", "type", "version"];
const UNSOLVED_SUBMISSION_KEYS = ["correct", "event", "explanation", "solved"];
const SOLVED_SUBMISSION_KEYS = ["awarded", "correct", "event", "explanation", "result", "solved"];
type Secret = { question_answer: string; question_hash: string; question_explanation: string; question_version: number };

function db_(): postgres.Sql { if (!sql) throw new Error("WAKE_TEST_DATABASE_URL must name a disposable database"); return sql; }
async function as(uid: string, query: string) {
  return db_().begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${uid},true)`;
    return tx.unsafe(query);
  });
}
async function secret(eventId: string): Promise<Secret> {
  return (await db_()`SELECT question_answer,question_hash,question_explanation,question_version FROM public.alarm_events WHERE id=${eventId}`)[0] as unknown as Secret;
}
function sorted(o: Record<string, unknown>) { return Object.keys(o).sort(); }
function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach(x => allKeys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}
/** Asserts a client response contains no stored key, hash or explanation for `s`. */
function assertNoSecret(response: unknown, s: Secret, label: string) {
  const text = JSON.stringify(response);
  expect(text.includes(s.question_hash)).toBe(false);
  expect(text.includes(s.question_explanation)).toBe(false);
  for (const k of allKeys(response)) expect(/answer|hash|solution|key/i.test(k)).toBe(false);
  console.log(`  ${label}: hash absent, explanation absent, no answer/hash/key field names`);
}
function assertQuestionShape(state: { event: { question: Record<string, unknown> } }) {
  expect(sorted(state.event)).toEqual(EVENT_KEYS);
  expect(sorted(state.event.question)).toEqual(QUESTION_KEYS);
}

async function startRinging(uid: string, mode: "math" | "science") {
  await db_()`INSERT INTO auth.users(id) VALUES(${uid}) ON CONFLICT DO NOTHING`;
  await db_()`INSERT INTO public.profiles(id) VALUES(${uid}) ON CONFLICT DO NOTHING`;
  await db_()`DELETE FROM public.alarm_events WHERE user_id=${uid}`;
  await as(uid, `SELECT public.wake_save_settings('04:00','20:30','classic','${mode}',true,true,2::smallint)`);
  const eventId = (await as(uid, "SELECT public.wake_test_alarm() AS id"))[0]?.id as string;
  const before = (await as(uid, "SELECT public.wake_get_state() AS s"))[0]?.s;
  await db_()`UPDATE public.alarm_events SET scheduled_for=now()-interval '5 seconds' WHERE id=${eventId}`;
  const ringing = (await as(uid, "SELECT public.wake_get_state() AS s"))[0]?.s;
  return { eventId, before, ringing };
}

let math: Awaited<ReturnType<typeof startRinging>>;
let science: Awaited<ReturnType<typeof startRinging>>;
beforeAll(async () => {
  if (!sql) return;
  math = await startRinging(MATH_USER, "math");
  science = await startRinging(SCIENCE_USER, "science");
});

db("before ringing: state carries no question at all", () => {
  expect(sorted(math.before)).toEqual(STATE_KEYS);
  expect(math.before.event?.question ?? null).toBeNull();
  console.log("  scheduled-state question:", JSON.stringify(math.before.event?.question ?? null));
});

db("ringing math question returns exactly the allowlisted fields and no key", async () => {
  expect(sorted(math.ringing)).toEqual(STATE_KEYS);
  assertQuestionShape(math.ringing);
  console.log("  state keys:", sorted(math.ringing).join(","));
  console.log("  event keys:", sorted(math.ringing.event).join(","));
  console.log("  question keys:", sorted(math.ringing.event.question).join(","));
  const s = await secret(math.eventId);
  expect(s.question_answer).toBeTruthy();
  assertNoSecret(math.ringing, s, "math get_state");
  // Answer value must not appear in any field except the visible question text.
  const q = math.ringing.event.question;
  expect(q.options).toBeNull();
  const leaves = JSON.stringify({ ...math.ringing, event: { ...math.ringing.event, question: { ...q, text: "" } } });
  expect(leaves.includes(`"${s.question_answer}"`)).toBe(false);
});

db("wrong answer response reveals neither the old nor the new key", async () => {
  const old = await secret(math.eventId);
  const r = (await as(MATH_USER, `SELECT public.wake_submit_answer('${math.eventId}',${old.question_version},'999999999') AS r`))[0]?.r;
  const fresh = await secret(math.eventId);
  expect(sorted(r)).toEqual(UNSOLVED_SUBMISSION_KEYS);
  expect(r.correct).toBe(false);
  expect(r.explanation).toBeNull();
  assertQuestionShape(r);
  expect(fresh.question_version).toBe(old.question_version + 1);
  assertNoSecret(r, old, "wrong answer vs old question");
  assertNoSecret(r, fresh, "wrong answer vs new question");
  console.log("  wrong-answer response keys:", sorted(r).join(","), "| explanation:", r.explanation);
});

db("explanation appears only after a correct submission; solved event has no question", async () => {
  await db_()`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id=${math.eventId}`;
  const s = await secret(math.eventId);
  const r = (await as(MATH_USER, `SELECT public.wake_submit_answer('${math.eventId}',${s.question_version},'${s.question_answer}') AS r`))[0]?.r;
  expect(sorted(r)).toEqual(SOLVED_SUBMISSION_KEYS);
  expect(r.solved).toBe(true);
  expect(r.explanation).toBe(s.question_explanation);
  expect(r.event.question).toBeNull();
  console.log("  solved response keys:", sorted(r).join(","), "| event.question:", r.event.question);
});

db("science MCQ: options only, index key hidden; post-answer explanation never covers the next question", async () => {
  assertQuestionShape(science.ringing);
  const q = science.ringing.event.question;
  expect(q.options).toHaveLength(4);
  const first = await secret(science.eventId);
  assertNoSecret(science.ringing, first, "science get_state");
  const r = (await as(SCIENCE_USER, `SELECT public.wake_submit_answer('${science.eventId}',${first.question_version},'${first.question_answer}') AS r`))[0]?.r;
  const next = await secret(science.eventId);
  expect(r.solved).toBe(false);
  expect(r.correct).toBe(true);
  expect(r.explanation).toBe(first.question_explanation); // explains the question just answered
  assertQuestionShape(r);
  assertNoSecret(r, next, "science 1/2 correct vs next question");
  console.log("  science question keys:", sorted(q).join(","), "| options:", q.options.length);
});

db("direct reads return zero private rows even with the live table grants", async () => {
  const sentinel = new Error("rollback");
  let counts: Record<string, number> = {};
  await db_().begin(async tx => {
    // Live grants SELECT on these tables to anon/authenticated; mirror that, then rely on RLS (no policies).
    await tx.unsafe("GRANT SELECT ON public.alarm_events, public.wake_question_history TO anon, authenticated");
    for (const role of ["authenticated", "anon"]) {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      await tx`SELECT set_config('request.jwt.claim.sub',${MATH_USER},true)`;
      counts[`${role}.alarm_events`] = Number((await tx.unsafe("SELECT count(*) AS n FROM public.alarm_events"))[0]?.n);
      counts[`${role}.wake_question_history`] = Number((await tx.unsafe("SELECT count(*) AS n FROM public.wake_question_history"))[0]?.n);
      counts[`${role}.quiz_questions(wake_only)`] = Number((await tx.unsafe("SELECT count(*) AS n FROM public.quiz_questions WHERE wake_only"))[0]?.n);
      await tx.unsafe("RESET ROLE");
    }
    throw sentinel;
  }).catch(e => { if (e !== sentinel) throw e; });
  const owned = Number((await db_()`SELECT count(*) AS n FROM public.alarm_events WHERE user_id=${MATH_USER}`)[0]?.n);
  expect(owned).toBeGreaterThan(0);
  for (const n of Object.values(counts)) expect(n).toBe(0);
  console.log("  visible rows:", JSON.stringify(counts), "| rows that exist for this user:", owned);
  await expect(as(MATH_USER, `SELECT public.wake_event_payload('${math.eventId}')`)).rejects.toThrow();
  await expect(as(MATH_USER, `SELECT public.wake_issue_question('${math.eventId}')`)).rejects.toThrow();
});

// Client bundle: requires `vite build` first. Fails (not skips) when dist/client is missing.
test("client bundle contains no answer keys, explanations or private bank", () => {
  const dir = join(import.meta.dir, "..", "dist", "client");
  expect(existsSync(dir)).toBe(true);
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|css|html|json|webmanifest|txt|map)$/.test(f)) files.push(p); } };
  walk(dir);
  const body = files.map(f => readFileSync(f, "utf8")).join("\n");
  for (const marker of ["question_answer", "question_explanation", "question_hash", "correct_answer", "wake-science-bank", "wake_issue_question"]) expect(body.includes(marker)).toBe(false);
  let texts = 0, explanations = 0;
  for (const row of bank as Array<{ question_text: string; explanation: string }>) {
    if (body.includes(row.question_text)) texts++;
    if (body.includes(row.explanation)) explanations++;
  }
  expect(texts).toBe(0);
  expect(explanations).toBe(0);
  console.log(`  scanned ${files.length} client files (${(body.length / 1e6).toFixed(1)} MB): 0 of ${bank.length} bank questions, 0 of ${bank.length} explanations, 0 private column names`);
});

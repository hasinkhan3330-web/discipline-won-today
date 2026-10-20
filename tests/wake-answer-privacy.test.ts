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

const PRIVATE_TABLES = ["alarm_events", "wake_question_history", "quiz_questions"];

db("layer 1: anon and authenticated hold no table rights at all on the private tables", async () => {
  // Mirrors live after migration 0026 (REVOKE ALL ... FROM anon, authenticated).
  const rows = await db_()`SELECT t, r, has_table_privilege(r, 'public.'||t, 'SELECT') s, has_table_privilege(r, 'public.'||t, 'INSERT') i,
    has_table_privilege(r, 'public.'||t, 'UPDATE') u, has_table_privilege(r, 'public.'||t, 'DELETE') d
    FROM unnest(${PRIVATE_TABLES}::text[]) t, unnest(array['anon','authenticated']) r`;
  for (const row of rows) expect([row.s, row.i, row.u, row.d]).toEqual([false, false, false, false]);
  const denied: string[] = [];
  for (const role of ["authenticated", "anon"]) for (const t of PRIVATE_TABLES) {
    const err = await db_().begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      await tx`SELECT set_config('request.jwt.claim.sub',${MATH_USER},true)`;
      await tx.unsafe(`SELECT count(*) FROM public.${t}`);
    }).then(() => null, (e: { code?: string }) => e);
    expect(err?.code).toBe("42501"); // permission denied, before RLS is even consulted
    denied.push(`${role}.${t}`);
  }
  console.log("  permission denied (42501):", denied.join(", "));
  // Service role (private processor) keeps its access.
  const svc = await db_()`SELECT bool_and(has_table_privilege('service_role','public.'||t,'SELECT')) ok FROM unnest(${PRIVATE_TABLES}::text[]) t`;
  expect(svc[0]?.ok).toBe(true);
});

db("layer 2: even if a grant were restored, RLS still returns zero private rows", async () => {
  const sentinel = new Error("rollback");
  let counts: Record<string, number> = {};
  await db_().begin(async tx => {
    // Temporarily re-grant (rolled back) to prove RLS alone would still hide every row.
    await tx.unsafe("GRANT SELECT ON public.alarm_events, public.wake_question_history, public.quiz_questions TO anon, authenticated");
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
  console.log("  visible rows with a temporary grant:", JSON.stringify(counts), "| rows that exist for this user:", owned);
  await expect(as(MATH_USER, `SELECT public.wake_event_payload('${math.eventId}')`)).rejects.toThrow();
  await expect(as(MATH_USER, `SELECT public.wake_issue_question('${math.eventId}')`)).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// Live-site capture, Science (MCQ) question. Opt-in: WAKE_LIVE_CAPTURE=1.
// Drives the running app on the live backend with a throwaway account through
// tests/wake-live-capture.py (Playwright), then asserts on every response body the
// browser received and on device storage. The account and all its rows are deleted.
// ---------------------------------------------------------------------------
const live = process.env.WAKE_LIVE_CAPTURE === "1";
const liveTest = live ? test : test.skip;
type LiveSecret = Secret & { label: string; answered_at: number; outcome: "wrong" | "correct_1_of_2" | "solve"; question_text: string };
type LiveCapture = {
  event_id: string;
  responses: Array<{ i: number; phase: string; url: string; status: number; body: string }>;
  secrets: LiveSecret[];
  storage: Record<string, { localStorage: Record<string, string>; sessionStorage: Record<string, string>; indexedDB: string[]; cacheStorage: unknown[]; cacheNames: string[]; serviceWorkers: unknown[] }>;
  offline: Record<string, unknown>;
  final: { status: string; coins_awarded: number; reward_result: string };
  cleanup: Record<string, number | string>;
};
let cap: LiveCapture | null = null;
function capture(): LiveCapture {
  if (cap) return cap;
  const out = "/tmp/wake-live-capture/capture.json";
  const run = Bun.spawnSync(["python3", join(import.meta.dir, "wake-live-capture.py")], { env: { ...process.env, WAKE_LIVE_CAPTURE_OUT: out }, stdout: "pipe", stderr: "pipe", timeout: 280_000 });
  if (!existsSync(out)) throw new Error(`live capture produced no output: ${run.stderr.toString().slice(-800)}`);
  cap = JSON.parse(readFileSync(out, "utf8")) as LiveCapture;
  if (run.exitCode !== 0) throw new Error(`live capture failed: ${run.stderr.toString().slice(-800)}`);
  return cap;
}
/** Decodes TanStack server-function (seroval) bodies into plain values. */
function decodeSeroval(n: unknown): unknown {
  if (!n || typeof n !== "object") return n;
  const x = n as { t: number; s?: unknown; a?: unknown[]; p?: { k: string[]; v: unknown[] } };
  switch (x.t) {
    case 0: case 1: return x.s;
    case 2: return [null, undefined, true, false][x.s as number];
    case 9: return (x.a ?? []).map(decodeSeroval);
    case 10: case 11: return Object.fromEntries((x.p?.k ?? []).map((k, i) => [k, decodeSeroval(x.p!.v[i])]));
    default: return { __seroval_type: x.t };
  }
}
function objects(v: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(v)) v.forEach(x => objects(x, out));
  else if (v && typeof v === "object") { out.push(v as Record<string, unknown>); Object.values(v).forEach(x => objects(x, out)); }
  return out;
}
/** Longest plain-text run of an explanation, so escaping in transport cannot hide a match. */
function fragment(text: string) {
  return text.split(/[^A-Za-z0-9 ,.;:()-]/).sort((a, b) => b.length - a.length)[0]!.trim();
}
const PRIVATE_MARKERS = ["question_answer", "question_explanation", "question_hash", "correct_answer", "wake-science-bank", "wake_issue_question"];

liveTest("live science: no captured response contains a private field name", () => {
  const c = capture();
  expect(c.responses.length).toBeGreaterThan(50);
  const hits = c.responses.filter(r => PRIVATE_MARKERS.some(m => r.body.includes(m)));
  expect(hits.map(h => h.url)).toEqual([]);
  console.log(`  ${c.responses.length} live responses captured, ${hits.length} contain a private field name`);
}, 300_000);

liveTest("live science: wake responses return exactly the allowlisted fields (MCQ options, no key)", () => {
  const c = capture();
  const wake = c.responses.filter(r => r.url.includes("/_serverFn/") && r.body.startsWith("{")).map(r => ({ r, v: decodeSeroval(JSON.parse(r.body)) }));
  const all = wake.flatMap(w => objects(w.v));
  const questions = all.filter(o => "correct_in_row" in o && "version" in o);
  const events = all.filter(o => "scheduled_for" in o && "tone" in o);
  const states = all.filter(o => "server_now" in o);
  const submissions = all.filter(o => "solved" in o && "event" in o);
  expect(questions.length).toBeGreaterThan(0);
  for (const q of questions) {
    expect(sorted(q)).toEqual(QUESTION_KEYS);
    expect(q.type).toBe("science");
    expect(q.options as unknown[]).toHaveLength(4);
  }
  for (const e of events) expect(sorted(e)).toEqual(EVENT_KEYS);
  for (const s of states) expect(sorted(s)).toEqual(STATE_KEYS);
  for (const s of submissions) expect(sorted(s)).toEqual(s.solved ? SOLVED_SUBMISSION_KEYS : UNSOLVED_SUBMISSION_KEYS);
  const wrong = submissions.find(s => s.solved === false && s.correct === false);
  expect(wrong?.explanation).toBeNull();
  const solved = submissions.find(s => s.solved === true);
  expect((solved?.event as { question: unknown }).question).toBeNull();
  for (const k of new Set(all.flatMap(o => Object.keys(o)))) expect(/answer|hash|solution|key/i.test(k)).toBe(false);
  console.log(`  ${wake.length} wake responses decoded: ${questions.length} science questions, ${submissions.length} submissions`);
  console.log("  question keys:", sorted(questions[0]!).join(","), "| options:", (questions[0]!.options as unknown[]).length);
  console.log("  wrong-answer response keys:", sorted(wrong!).join(","), "| explanation:", wrong!.explanation);
}, 300_000);

liveTest("live science: no hash ever, and no explanation before its question is answered", () => {
  const c = capture();
  expect(c.secrets.map(s => s.outcome)).toEqual(["wrong", "correct_1_of_2", "solve"]);
  for (const s of c.secrets) {
    const frag = fragment(s.question_explanation);
    expect(frag.length).toBeGreaterThan(15);
    expect(c.responses.some(r => r.body.includes(s.question_hash))).toBe(false);
    const before = c.responses.filter(r => r.i < s.answered_at && r.body.includes(frag));
    expect(before.length).toBe(0);
    const after = c.responses.filter(r => r.i >= s.answered_at && r.body.includes(frag)).length;
    if (s.outcome === "wrong") expect(after).toBe(0); // wrong answers never reveal the explanation
    else expect(after).toBeGreaterThan(0); // positive control: the detector does find a real explanation
    console.log(`  ${s.label}: hash in 0 responses; explanation in 0 pre-answer responses, ${after} after`);
  }
}, 300_000);

liveTest("live science: device storage holds no question, answer, hash or explanation", () => {
  const c = capture();
  expect(Object.keys(c.storage)).toEqual(["scheduled", "ringing", "solved"]);
  for (const [phase, snap] of Object.entries(c.storage)) {
    const text = JSON.stringify(snap);
    for (const m of PRIVATE_MARKERS) expect(text.includes(m)).toBe(false);
    for (const s of c.secrets) {
      expect(text.includes(s.question_hash)).toBe(false);
      expect(text.includes(fragment(s.question_explanation))).toBe(false);
      expect(text.includes(s.question_text)).toBe(false); // nothing about the question is cached on the device
    }
    expect(snap.cacheNames).toEqual([]);
    expect(snap.cacheStorage).toEqual([]);
    expect(snap.serviceWorkers).toEqual([]);
    console.log(`  ${phase}: localStorage keys [${Object.keys(snap.localStorage).join(", ")}], sessionStorage keys [${Object.keys(snap.sessionStorage).join(", ")}], IndexedDB [${snap.indexedDB.join(", ")}], Cache Storage ${snap.cacheNames.length}`);
  }
}, 300_000);

liveTest("live: offline answer is queued, keeps ringing, and reaches the server once after reconnect", () => {
  const o = capture().offline;
  expect(o.notice_visible).toBe(true);
  expect(o.buttons_disabled).toBe(true);
  expect(o.awake_shown_while_offline).toBe(false);
  expect(o.server_status_while_offline).toBe("ringing");
  expect(o.server_version_while_offline).toBe(o.queued_version); // server never saw it while offline
  expect(o.server_correct_in_row_while_offline).toBe(0);
  expect(o.after_reconnect_version).toBe((o.queued_version as number) + 1); // delivered exactly once
  expect(o.after_reconnect_correct_in_row).toBe(1);
  expect(o.notice_gone).toBe(true);
  expect(o.ui_shows_one_of_two).toBe(true);
  console.log("  offline:", JSON.stringify(o));
}, 300_000);

liveTest("live: test alarm solved with no reward and the throwaway account fully deleted", () => {
  const c = capture();
  expect(c.final).toEqual({ status: "solved", coins_awarded: 0, reward_result: "test_alarm" });
  const { auth_user_http, ...rows } = c.cleanup;
  expect(auth_user_http).toBe(404);
  for (const n of Object.values(rows)) expect(n).toBe(0);
  console.log("  final:", JSON.stringify(c.final), "| leftover rows:", JSON.stringify(rows), "| auth user:", auth_user_http);
}, 300_000);

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

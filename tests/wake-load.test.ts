import { expect, test } from "bun:test";
import postgres from "postgres";
const url = process.env.WAKE_LOAD_DATABASE_URL;
const loadTest = url ? test : test.skip;

loadTest("100000 due occurrences, 500-row batches and zero duplicate mock sends", async () => {
  if (!url) throw new Error("Explicit disposable load database URL required");
  const sql = postgres(url, { max: 6 });
  await sql.unsafe(`
    INSERT INTO auth.users(id) SELECT md5('load-user-'||i)::uuid FROM generate_series(1,100000) i;
    INSERT INTO public.profiles(id) SELECT md5('load-user-'||i)::uuid FROM generate_series(1,100000) i;
    INSERT INTO public.alarms(id,user_id,time,label,wake_saved_at,wake_timezone)
    SELECT md5('load-alarm-'||i)::uuid,md5('load-user-'||i)::uuid,'04:00','AXEN Wake Protocol',now()-interval '3 hours','Asia/Kolkata' FROM generate_series(1,100000) i;
    INSERT INTO public.alarm_events(user_id,alarm_id,scheduled_for,local_date,timezone,wake_time,saved_at,question_type)
    SELECT user_id,id,now()-interval '1 minute',current_date,'Asia/Kolkata','04:00',now()-interval '3 hours','math' FROM public.alarms WHERE id IN (SELECT md5('load-alarm-'||i)::uuid FROM generate_series(1,100000) i);
    INSERT INTO public.wake_push_subscriptions(user_id,endpoint,p256dh,auth_key)
    SELECT md5('load-user-'||i)::uuid,'https://fcm.googleapis.com/load-test/'||i,'mock','mock' FROM generate_series(1,100000) i;
  `);
  const start = performance.now();
  const batches: number[] = [];
  let swept = 0;
  while (swept < 100000) {
    const began = performance.now();
    const results = await Promise.all(Array.from({ length: 6 }, () => sql`SELECT public.wake_sweep_due(500) AS n`));
    for (const rows of results) { expect(rows[0]?.n).toBeLessThanOrEqual(500); swept += rows[0]?.n ?? 0; }
    batches.push(performance.now() - began);
  }
  const dueMs = performance.now() - start;
  expect(swept).toBe(100000);
  const sent = new Set<string>();
  const deliverStart = performance.now();
  while (sent.size < 100000) {
    const claims = await Promise.all(Array.from({ length: 6 }, () => sql`SELECT public.wake_claim_push(6) AS jobs`));
    const jobs = claims.flatMap(rows => rows[0]?.jobs ?? []);
    if (!jobs.length) throw new Error("Outbox unexpectedly drained");
    for (const job of jobs) { expect(sent.has(job.id)).toBe(false); sent.add(job.id); }
    // Mock provider accepts each claimed id. No external notifications are sent.
    await sql`UPDATE public.wake_push_outbox SET status='accepted',accepted_at=now() WHERE id IN ${sql(jobs.map(j => j.id))}`;
  }
  expect(sent.size).toBe(100000);
  const totals = (await sql`SELECT count(*)::integer AS total,count(distinct (event_id,subscription_id,round))::integer AS unique_keys FROM public.wake_push_outbox WHERE round=1`)[0];
  expect(totals?.total).toBe(100000);
  expect(totals?.unique_keys).toBe(100000);
  console.log(JSON.stringify({ events: swept, dueMs: Math.round(dueMs), parallelBatchMaxMs: Math.round(Math.max(...batches)), mockDeliveryMs: Math.round(performance.now() - deliverStart), duplicateMockSends: 0, livePush: "UNVERIFIED" }));
  await sql.end();
}, 600000);
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wake/process")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["WAKE_JOB_SECRET"];
    const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!secret || !bearer) return new Response("Unauthorized", { status: 401 });
    const enc = new TextEncoder();
    const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(secret)), crypto.subtle.digest("SHA-256", enc.encode(bearer))]);
    let mismatch = 0;
    const aa = new Uint8Array(a), bb = new Uint8Array(b);
    for (let i = 0; i < aa.length; i++) mismatch |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
    if (mismatch) return new Response("Unauthorized", { status: 401 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWakePush } = await import("@/lib/wake-push.server");
    const { error } = await supabaseAdmin.rpc("wake_sweep_due", { _limit: 500 });
    if (error) return Response.json({ error: "Scheduling failed" }, { status: 503 });
    const { data, error: claimError } = await supabaseAdmin.rpc("wake_claim_push", { _limit: 6 });
    if (claimError) return Response.json({ error: "Delivery unavailable" }, { status: 503 });
    const jobs = data as unknown as import("@/lib/wake-push.server").PushJob[];
    const results = await Promise.all(jobs.map(async job => {
      const { data: current } = await supabaseAdmin.from("alarm_events").select("status").eq("id", job.event_id).maybeSingle();
      if (current?.status !== "ringing") return 0;
      const status = await sendWakePush(job);
      await supabaseAdmin.rpc("wake_finish_push", { _id: job.id, _lease: job.lease_token, _http: status });
      return status;
    }));
    return Response.json({ processed: jobs.length, accepted: results.filter(x => x >= 200 && x < 300).length });
  } } },
});
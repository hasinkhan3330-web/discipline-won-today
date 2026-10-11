import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AlarmState, AlarmSubmission } from "./wake-types";

export const readWakeState = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("wake_get_state");
  if (error) throw new Error(error.message);
  return data as unknown as AlarmState;
});
export const saveWakeSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((x) => z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), sleep: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), tone: z.enum(["superloud", "scariest", "techno", "meduzza", "classic", "morning", "retro", "emergency", "modern", "oppenheimer"]), mode: z.enum(["math", "science"]), enabled: z.boolean(), repeat: z.boolean(), difficulty: z.number().int().min(1).max(3) }).parse(x))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("wake_save_settings", { _time: data.time, _sleep: data.sleep, _tone: data.tone, _mode: data.mode, _enabled: data.enabled, _repeat: data.repeat, _difficulty: data.difficulty });
    if (error) throw new Error(error.message);
    const { data: state, error: readError } = await context.supabase.rpc("wake_get_state");
    if (readError) throw new Error(readError.message);
    return state as unknown as AlarmState;
  });
export const createWakeTest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("wake_test_alarm");
  if (error) throw new Error(error.message);
  return data;
});
export const submitWakeAnswer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((x) => z.object({ eventId: z.string().uuid(), version: z.number().int().positive(), answer: z.string().min(1).max(40) }).parse(x))
  .handler(async ({ data, context }) => {
    const { data: response, error } = await context.supabase.rpc("wake_submit_answer", { _event_id: data.eventId, _version: data.version, _answer: data.answer });
    if (error) throw new Error(error.message);
    return response as unknown as AlarmSubmission;
  });
export const registerWakePush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((x) => z.object({ endpoint: z.string().url().max(2048), p256dh: z.string().max(256), auth: z.string().max(128) }).parse(x))
  .handler(async ({ data, context }) => {
    // Known push providers only; user-supplied subscriptions cannot turn the worker into an SSRF proxy.
    const url = new URL(data.endpoint);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.port || url.username || url.password || !(host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host.endsWith(".push.apple.com") || host === "web.push.apple.com" || host.endsWith(".notify.windows.com"))) throw new Error("Unsupported push provider");
    const { error } = await context.supabase.rpc("wake_subscribe", { _endpoint: data.endpoint, _p256dh: data.p256dh, _auth: data.auth });
    if (error) throw new Error(error.message);
    return { subscribed: true };
  });
export const wakePushConfiguration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { wakeVapid } = await import("./wake-push.server");
  const vapid = await wakeVapid();
  return { publicKey: vapid.publicKey, deliveryActive: false };
});
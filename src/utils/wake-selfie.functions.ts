import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WakeSelfieResult =
  | { ok: true; awarded: number; coins: number; streak: number; longestStreak: number; already: boolean }
  | { ok: false; code: "window" | "no_face" | "service" | "error"; message: string };

function localMinutes(tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/**
 * Wake Up 4AM live-selfie check. The photo is only held in memory for the
 * detection call, then dropped — never stored, never logged, never returned.
 */
export const verifyWakeSelfie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const d = z.object({ imageBase64: z.string().min(32).max(4_000_000), tz: z.string().min(1).max(64) }).parse(input);
    const base64 = d.imageBase64.includes(",") ? d.imageBase64.slice(d.imageBase64.indexOf(",") + 1) : d.imageBase64;
    return { base64, tz: d.tz };
  })
  .handler(async ({ data, context }): Promise<WakeSelfieResult> => {
    let mins: number;
    try { mins = localMinutes(data.tz); } catch { return { ok: false, code: "error", message: "Unknown time zone." }; }
    if (mins < 240 || mins >= 270) return { ok: false, code: "window", message: "Wake check-in is open only from 4:00 to 4:30 AM." };

    const apiKey = process.env["ROBOFLOW_API_KEY"];
    const model = process.env["ROBOFLOW_MODEL"] || "coco/9";
    if (!apiKey) return { ok: false, code: "service", message: "Selfie check is not available right now." };

    let personFound = false;
    try {
      const res = await fetch(`https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(apiKey)}&confidence=40&format=json`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: data.base64,
      });
      if (!res.ok) { console.error("[wake-selfie] detect status", res.status); return { ok: false, code: "service", message: "Selfie check failed. Try again." }; }
      const json = (await res.json()) as { predictions?: { class?: string; confidence?: number }[] };
      personFound = (json.predictions ?? []).some(p => String(p.class).toLowerCase() === "person" && Number(p.confidence) >= 0.5);
    } catch {
      return { ok: false, code: "service", message: "Selfie check failed. Try again." };
    }
    data.base64 = ""; // drop the photo immediately
    if (!personFound) return { ok: false, code: "no_face", message: "We couldn't see you clearly. Face the camera and try again." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("complete_wake_selfie", { _uid: context.userId, _tz: data.tz });
    if (error) {
      const msg = String(error.message ?? "");
      return { ok: false, code: msg.includes("4:00") ? "window" : "error", message: msg.includes("4:00") ? "Wake check-in is open only from 4:00 to 4:30 AM." : "Could not save your wake-up." };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { ok: true, awarded: Number(row?.awarded ?? 0), coins: Number(row?.coins ?? 0), streak: Number(row?.streak ?? 0), longestStreak: Number(row?.longest_streak ?? 0), already: row?.result === "already_done" };
  });

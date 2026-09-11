import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Detection = { label: string; confidence: number };

export type DetectResult =
  | { ok: true; detections: Detection[]; top: Detection | null }
  | { ok: false; error: string };

/**
 * Roboflow image detection.
 *
 * The API key never reaches the browser: the image is posted from the app to
 * this server function, which calls Roboflow and returns only the labels.
 */
export const detectHabitEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageBase64: string }) => {
    const raw = typeof input?.imageBase64 === "string" ? input.imageBase64 : "";
    const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    if (!base64 || base64.length < 32) throw new Error("No image received");
    // ~8MB of base64 payload ceiling
    if (base64.length > 11_000_000) throw new Error("Image is too large — use a smaller photo");
    return { base64 };
  })
  .handler(async ({ data }): Promise<DetectResult> => {
    const apiKey = process.env["ROBOFLOW_API_KEY"];
    if (!apiKey) return { ok: false, error: "Photo checking is not configured yet (missing ROBOFLOW_API_KEY)." };

    // The private workspace project `habit-evidence` has no trained version yet,
    // so it answers 405. `coco/9` is a hosted model that covers the evidence
    // classes AXEN needs (book, laptop, sink, bench, sports ball…).
    const model = process.env["ROBOFLOW_MODEL"] || "coco/9";
    const url = `https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(apiKey)}&confidence=30&overlap=30&format=json`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.base64,
      });

      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        console.error("[roboflow] status", res.status, "model", model, body);
        // Surface the real technical cause — never a blanket "did not respond".
        return {
          ok: false,
          error: `Vision model "${model}" returned HTTP ${res.status}. ${body || "No response body."}`,
        };
      }

      const json = (await res.json()) as { predictions?: { class?: string; confidence?: number }[] };
      const detections: Detection[] = (json.predictions ?? [])
        .map(p => ({ label: String(p.class ?? "unknown"), confidence: Number(p.confidence ?? 0) }))
        .sort((a, b) => b.confidence - a.confidence);

      return { ok: true, detections, top: detections[0] ?? null };
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[roboflow] request failed", detail);
      return { ok: false, error: `Could not reach the vision service (${detail}).` };
    }
  });

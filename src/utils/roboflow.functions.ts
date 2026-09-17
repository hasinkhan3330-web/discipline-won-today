import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Detection = {
  label: string;
  confidence: number;
  /** Centre-point box in source-image pixels, as returned by the model. */
  x: number; y: number; width: number; height: number;
};

export type DetectResult =
  | { ok: true; detections: Detection[]; top: Detection | null; image: { width: number; height: number }; model: string }
  | { ok: false; code: string; error: string };

/** Single inference must never hold the camera loop hostage. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Roboflow object detection (hosted inference).
 *
 * The private key never reaches the browser: the downscaled frame is posted
 * from the app to this server function, which calls Roboflow and returns only
 * labels, confidences and boxes.
 */
export const detectHabitEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { imageBase64: string }) => {
    const raw = typeof input?.imageBase64 === "string" ? input.imageBase64 : "";
    const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    if (!base64 || base64.length < 32) throw new Error("No image received");
    if (base64.length > 11_000_000) throw new Error("Image is too large — use a smaller photo");
    return { base64 };
  })
  .handler(async ({ data }): Promise<DetectResult> => {
    const apiKey = process.env["ROBOFLOW_API_KEY"];
    // The workspace projects (`habit-evidence`, `habit-verification`) have no
    // trained version, so the deployed detector is the hosted COCO model.
    const model = process.env["ROBOFLOW_MODEL"] || "coco/9";

    if (!apiKey) {
      return { ok: false, code: "no_key", error: "Camera verification is not configured on the server (missing detection key)." };
    }

    const url = `https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(apiKey)}&confidence=30&overlap=30&format=json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.base64,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        // Never log the URL (it carries the key) — only status and model id.
        console.error("[roboflow] http", res.status, "model", model, body);
        const code =
          res.status === 401 || res.status === 403 ? "auth"
          : res.status === 404 ? "model"
          : res.status === 429 ? "rate"
          : "http";
        const error =
          code === "auth" ? "The detection service rejected our key (HTTP " + res.status + "). Verification is disabled until it is fixed."
          : code === "model" ? `Detection model "${model}" was not found (HTTP 404).`
          : code === "rate" ? "The detection service is rate-limiting right now. Wait a few seconds and retry."
          : `Detection service error (HTTP ${res.status}).`;
        return { ok: false, code, error };
      }

      const json = (await res.json()) as {
        image?: { width?: number; height?: number };
        predictions?: { class?: string; confidence?: number; x?: number; y?: number; width?: number; height?: number }[];
      };

      const detections: Detection[] = (json.predictions ?? [])
        .map(p => ({
          label: String(p.class ?? "unknown").trim().toLowerCase(),
          confidence: Number(p.confidence ?? 0),
          x: Number(p.x ?? 0), y: Number(p.y ?? 0),
          width: Number(p.width ?? 0), height: Number(p.height ?? 0),
        }))
        .sort((a, b) => b.confidence - a.confidence);

      return {
        ok: true,
        detections,
        top: detections[0] ?? null,
        image: { width: Number(json.image?.width ?? 0), height: Number(json.image?.height ?? 0) },
        model,
      };
    } catch (e) {
      const aborted = (e as { name?: string })?.name === "AbortError";
      console.error("[roboflow] request failed", aborted ? "timeout" : (e instanceof Error ? e.name : "unknown"));
      return aborted
        ? { ok: false, code: "timeout", error: "The detection service took too long to answer." }
        : { ok: false, code: "network", error: "Could not reach the detection service. Check your connection." };
    } finally {
      clearTimeout(timer);
    }
  });

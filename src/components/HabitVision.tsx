import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { detectHabitEvidence, type Detection } from "@/utils/roboflow.functions";
import {
  DEFAULT_SCAN_CLASSES, VISION_COPY, isAcceptedClass, unsupportedClasses, type VisionKind,
} from "@/lib/vision";
import { Camera, Loader2, Check, Timer, Image as ImageIcon } from "lucide-react";

export type { VisionKind } from "@/lib/vision";

/** Fire-and-forget record of what the vision model saw (best effort). */
export const logVision = (kind: string, source: "camera" | "photo", detections: Detection[]) => {
  void supabase
    .from("vision_verifications")
    .insert({ kind, source, detections: detections.slice(0, 10) })
    .then(() => {}, () => {});
};

/** Confidence an accepted class must clear on a frame. */
const PASS_CONFIDENCE = 0.55;
/** Accept when this many of the last WINDOW frames were hits. */
const NEEDED_HITS = 2;
const WINDOW = 3;
/** ~6 fps ceiling; one request in flight at a time, stale frames are dropped. */
const FRAME_GAP_MS = 160;
/** Downscaled inference width. */
const FRAME_WIDTH = 640;
/** Stop scanning after this long without an accepted object. */
const SCAN_TIMEOUT_MS = 8000;

type Phase = "idle" | "starting" | "scanning" | "verified" | "error";

/**
 * Live camera object-detection check for a habit.
 *
 * Frames are downscaled locally and streamed to the server, which runs the
 * deployed Roboflow model with the private key and returns labels + boxes.
 */
export function HabitVision({ visionKind, acceptedClasses, onVerified, onPhoto, onTimer }: {
  visionKind: VisionKind;
  acceptedClasses?: string[];
  onVerified: () => void;
  onPhoto?: () => void;
  onTimer?: () => void;
}) {
  const copy = VISION_COPY[visionKind] ?? VISION_COPY.custom;
  const accepted = (acceptedClasses?.length ? acceptedClasses : DEFAULT_SCAN_CLASSES[visionKind]) ?? [];
  const unsupported = unsupportedClasses(accepted);
  const configured = accepted.length > 0 && unsupported.length < accepted.length;

  const detect = useServerFn(detectHabitEvidence);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const warmedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [hits, setHits] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number; label: string; confidence: number } | null>(null);

  const stopCamera = useCallback(() => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* released */ }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Release the camera on every unmount path (close, back, navigation).
  useEffect(() => () => { doneRef.current = true; stopCamera(); }, [stopCamera]);

  /** Warm the detection route as soon as the modal opens. */
  useEffect(() => {
    if (warmedRef.current || !configured) return;
    warmedRef.current = true;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, 32, 32);
    void detect({ data: { imageBase64: c.toDataURL("image/jpeg", 0.5) } }).catch(() => undefined);
  }, [detect, configured]);

  const grabFrame = (): { data: string; w: number; h: number } | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = FRAME_WIDTH;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.6), w, h };
  };

  const fail = (message: string) => {
    doneRef.current = true;
    stopCamera();
    setBox(null);
    setPhase("error");
    setError(message);
  };

  const start = async () => {
    if (!configured) return;
    setError(null); setHits(0); setBox(null);
    doneRef.current = false;
    setPhase("starting");
    setStatus("Opening the camera…");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      fail("This device cannot open a camera here (a secure https page is required). Use Take Photo instead.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      if (name === "OverconstrainedError" || name === "NotReadableError") {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null);
      }
      if (!stream) {
        fail(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission is blocked. Allow the camera for AXEN in your browser settings, then retry."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera. Retry in a moment.",
        );
        return;
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
    }

    setPhase("scanning");
    setStatus(copy.prompt);
    void loop();
  };

  const loop = async () => {
    const deadline = Date.now() + SCAN_TIMEOUT_MS;
    const recent: boolean[] = [];
    let networkFails = 0;

    while (!doneRef.current && streamRef.current) {
      if (Date.now() > deadline) {
        fail("No accepted object detected in 8 seconds. Retry, take a photo, or use the timer.");
        return;
      }

      const t0 = Date.now();
      const frame = grabFrame();
      if (frame) {
        try {
          // One request in flight — the next frame is only grabbed after this resolves.
          const res = await detect({ data: { imageBase64: frame.data } });
          if (doneRef.current) return;

          if (!res.ok) {
            if (res.code === "network" || res.code === "timeout") {
              networkFails += 1;
              if (networkFails >= 3) { fail(res.error); return; }
              setStatus("Slow connection — retrying…");
              continue;
            }
            fail(res.error); // auth / model / rate / config: never scan forever
            return;
          }
          networkFails = 0;

          const hit = res.detections.find(d => d.confidence >= PASS_CONFIDENCE && isAcceptedClass(d.label, accepted));
          const marker = res.detections[0];

          // Bounding box over the live preview, in preview-relative percentages.
          const iw = res.image.width || frame.w;
          const ih = res.image.height || frame.h;
          const draw = hit ?? marker;
          setBox(draw && draw.width > 0
            ? {
                left: ((draw.x - draw.width / 2) / iw) * 100,
                top: ((draw.y - draw.height / 2) / ih) * 100,
                width: (draw.width / iw) * 100,
                height: (draw.height / ih) * 100,
                label: draw.label,
                confidence: draw.confidence,
              }
            : null);

          recent.push(!!hit);
          if (recent.length > WINDOW) recent.shift();
          const score = recent.filter(Boolean).length;
          setHits(score);

          if (hit) setStatus("Object detected — verifying…");
          else if (res.detections.length === 0) setStatus(copy.missing);
          else setStatus(`Seeing ${marker?.label ?? "something"} — that is not accepted for this habit.`);

          if (score >= NEEDED_HITS) {
            doneRef.current = true;
            onVerified();                       // credit first — no delay before the reward
            stopCamera();
            setPhase("verified");
            setStatus(copy.verified + ".");
            haptic("success");
            logVision(visionKind, "camera", res.detections);
            return;
          }
        } catch {
          if (doneRef.current) return;
          networkFails += 1;
          if (networkFails >= 3) {
            fail("No connection to the detection service. Check your internet and retry.");
            return;
          }
          setStatus("Connection hiccup — retrying…");
        }
      }

      const spent = Date.now() - t0;
      if (spent < FRAME_GAP_MS) await new Promise(r => setTimeout(r, FRAME_GAP_MS - spent));
    }
  };

  const scanning = phase === "scanning" || phase === "starting";

  if (!configured) {
    return (
      <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6 }}>
        This object is not supported by the current model. Pick accepted objects for this habit in the habit builder,
        or use the photo / timer options.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden",
        background: "#0F0F16", border: `1px solid ${phase === "verified" ? AX.success : AX.border}`,
        display: scanning || phase === "verified" ? "block" : "none",
      }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

        {box && scanning && (
          <div style={{
            position: "absolute",
            left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`,
            border: `2px solid ${isAcceptedClass(box.label, accepted) ? AX.success : AX.muted}`,
            borderRadius: 6, pointerEvents: "none",
          }}>
            <span style={{
              position: "absolute", top: -20, left: 0, whiteSpace: "nowrap",
              background: "rgba(10,10,15,0.8)", borderRadius: 4, padding: "1px 6px",
              fontSize: 10, fontWeight: 700, color: isAcceptedClass(box.label, accepted) ? AX.success : AX.text,
            }}>
              {box.label} {Math.round(box.confidence * 100)}%
            </span>
          </div>
        )}

        {scanning && (
          <div style={{
            position: "absolute", left: 10, bottom: 10, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(10,10,15,0.72)", borderRadius: 999, padding: "5px 10px",
            fontSize: 11, fontWeight: 600, color: AX.text,
          }}>
            <Loader2 size={12} className="ax-spin" />
            {hits}/{NEEDED_HITS} frames
          </div>
        )}
      </div>

      {phase !== "verified" && (
        <button
          onClick={() => void start()}
          disabled={scanning}
          style={{
            minHeight: 46, borderRadius: 12, cursor: scanning ? "wait" : "pointer",
            background: scanning ? "transparent" : AX.accent,
            border: `1px solid ${scanning ? AX.border : AX.accent}`,
            color: scanning ? AX.muted : "#FFFFFF",
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {scanning ? <Loader2 size={16} className="ax-spin" /> : <Camera size={16} />}
          {scanning ? "Checking your setup…" : phase === "error" ? "Retry" : "Start camera check"}
        </button>
      )}

      {phase === "verified" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          minHeight: 46, borderRadius: 12, border: `1px solid ${AX.success}`, color: AX.success,
          fontSize: 14, fontWeight: 600,
        }}>
          <Check size={16} />{copy.verified}
        </div>
      )}

      {phase === "error" && (onPhoto || onTimer) && (
        <div style={{ display: "flex", gap: 10 }}>
          {onPhoto && (
            <button onClick={onPhoto} style={{
              flex: 1, minHeight: 44, borderRadius: 12, cursor: "pointer", background: "transparent",
              border: `1px solid ${AX.border}`, color: AX.text, fontFamily: AX.font, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><ImageIcon size={15} />Take Photo</button>
          )}
          {onTimer && (
            <button onClick={onTimer} style={{
              flex: 1, minHeight: 44, borderRadius: 12, cursor: "pointer", background: "transparent",
              border: `1px solid ${AX.border}`, color: AX.text, fontFamily: AX.font, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><Timer size={15} />3-Minute Timer</button>
          )}
        </div>
      )}

      {!!status && phase !== "error" && (
        <div style={{ fontSize: 12, color: AX.muted, lineHeight: 1.5 }}>{status}</div>
      )}

      {error && <div style={{ fontSize: 12, color: AX.danger, lineHeight: 1.5 }}>{error}</div>}
    </div>
  );
}

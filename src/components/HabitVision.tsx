import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { detectHabitEvidence, type Detection } from "@/utils/roboflow.functions";
import { Camera, Loader2, Check } from "lucide-react";

/** Live-camera vision kinds mapped to their evidence classes. */
export type VisionKind = "focus" | "shower" | "workout";

export const VISION_CONFIG: Record<
  VisionKind,
  { classes: string[]; prompt: string; missing: string; timeout: string; verified: string }
> = {
  focus: {
    classes: ["book", "notebook", "laptop", "desk", "keyboard", "mouse", "tv", "monitor", "dining table"],
    prompt: "Point at your desk — keep your book, notebook or laptop in view.",
    missing: "Nothing recognised yet — show your book, notebook, laptop or desk.",
    timeout: "Could not confirm a study setup. Move closer to your desk and try again.",
    verified: "Study setup verified",
  },
  shower: {
    classes: ["shower", "bathroom", "bathtub", "faucet", "sink", "tap", "toilet", "toothbrush", "hair drier"],
    prompt: "Point the camera at your bathroom — show the shower, tap or sink.",
    missing: "Nothing recognised yet — show your shower, tap, sink or bathroom.",
    timeout: "Could not confirm a shower setup. Move closer and try again.",
    verified: "Shower setup verified",
  },
  workout: {
    classes: [
      "dumbbell", "barbell", "gym", "treadmill", "kettlebell", "weight", "bench", "machine", "equipment",
      "sports ball", "bicycle", "skateboard", "tennis racket", "frisbee",
    ],
    prompt: "Point the camera at your equipment — dumbbell, bench, ball or bike.",
    missing: "Nothing recognised yet — show your dumbbell, bench, ball, bike or gym machine.",
    timeout: "Could not confirm workout equipment. Move closer and try again.",
    verified: "Workout setup verified",
  },
};

export const matchesEvidence = (labels: string[], kind: VisionKind) => {
  const cfg = VISION_CONFIG[kind];
  return labels.some(l => cfg.classes.some(c => l.toLowerCase().includes(c)));
};

/** Fire-and-forget record of what the vision model saw (best effort). */
export const logVision = (kind: string, source: "camera" | "photo", detections: Detection[]) => {
  void supabase
    .from("vision_verifications")
    .insert({ kind, source, detections: detections.slice(0, 10) })
    .then(() => {}, () => {});
};

/** Two consecutive confident frames end the scan instantly. */
const REQUIRED_STREAK = 2;
/** Confidence needed on each of those frames. */
const PASS_CONFIDENCE = 0.6;
/** Frame pacing ceiling (~8 fps) — inference itself is the real limiter. */
const FRAME_GAP_MS = 120;
/** Downscaled inference width: small frames keep round trips well under a second. */
const FRAME_WIDTH = 320;
/** Nudge the user again after this long without a confident hit. */
const RETRY_HINT_MS = 5000;
/** Give up after this long without a confirmed setup. */
const TIMEOUT_MS = 90_000;
/** Consecutive failed round trips before showing a network error. */
const MAX_TRANSIENT = 3;

type Phase = "idle" | "starting" | "scanning" | "verified" | "error";

/**
 * Live camera check for a habit's setup (study desk, shower, workout gear).
 *
 * Frames are downscaled locally and streamed to the server, which runs the
 * Roboflow model with the private key and returns only labels. Detections
 * describe what is visible, so results are worded as "setup verified".
 */
export function HabitVision({ visionKind, onVerified }: { visionKind: VisionKind; onVerified: () => void }) {
  const cfg = VISION_CONFIG[visionKind];
  const detect = useServerFn(detectHabitEvidence);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const streakRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const warmedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [streak, setStreak] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);

  const stopCamera = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
    } catch { /* already released */ }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Release the camera on every unmount path (close, back, navigation).
  useEffect(() => () => { doneRef.current = true; stopCamera(); }, [stopCamera]);

  /** Warm the detection route once so the first real frame is not a cold start. */
  useEffect(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, 32, 32);
    void detect({ data: { imageBase64: c.toDataURL("image/jpeg", 0.5) } }).catch(() => undefined);
  }, [detect]);

  const grabFrame = (): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = FRAME_WIDTH;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 240;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.5);
  };

  const start = async () => {
    setError(null); setSeen([]); setStreak(0);
    streakRef.current = 0; doneRef.current = false;
    setPhase("starting");
    setStatus("Opening the camera…");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError("This device cannot open a camera here. Use the scanner or photo option instead.");
      return;
    }

    // Rear camera first; fall back to any camera rather than failing outright.
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
        setPhase("error");
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission is blocked. Allow the camera for AXEN, then try again."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera. Try again in a moment.",
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
    setStatus(cfg.prompt);
    void loop();
  };

  const loop = async () => {
    const deadline = Date.now() + TIMEOUT_MS;
    let transient = 0;
    let lastHint = Date.now();

    const succeed = (detections: Detection[]) => {
      doneRef.current = true;
      // Credit first, everything else after — no delay before the reward.
      onVerified();
      stopCamera();
      setPhase("verified");
      setStatus(cfg.verified + ".");
      haptic("success");
      logVision(visionKind, "camera", detections);
    };

    while (!doneRef.current && streamRef.current) {
      if (Date.now() > deadline) {
        stopCamera();
        setPhase("error");
        setError(cfg.timeout);
        return;
      }

      const t0 = Date.now();
      const frame = grabFrame();
      if (frame) {
        try {
          const res = await detect({ data: { imageBase64: frame } });
          if (doneRef.current) return;

          if (!res.ok) {
            transient += 1;
            if (transient >= MAX_TRANSIENT) {
              stopCamera();
              setPhase("error");
              setError(res.error);
              return;
            }
            setStatus("Connection hiccup — retrying…");
            await new Promise(r => setTimeout(r, 400));
            continue;
          }
          transient = 0;

          const labels = res.detections.map(d => d.label);
          setSeen(labels.slice(0, 4));

          const best = res.detections.find(d => matchesEvidence([d.label], visionKind));
          const confident = (best?.confidence ?? 0) >= PASS_CONFIDENCE;

          if (confident) {
            streakRef.current += 1;
            setStreak(streakRef.current);
            if (streakRef.current >= REQUIRED_STREAK) { succeed(res.detections); return; }
            setStatus("Setup detected — hold steady…");
          } else {
            streakRef.current = 0;
            setStreak(0);
            if (Date.now() - lastHint > RETRY_HINT_MS) {
              lastHint = Date.now();
              setStatus(cfg.missing);
            } else if (!status) {
              setStatus(cfg.prompt);
            }
          }
        } catch {
          if (doneRef.current) return;
          transient += 1;
          if (transient >= MAX_TRANSIENT) {
            stopCamera();
            setPhase("error");
            setError("No connection to the check service. Check your internet and try again.");
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

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden",
        background: "#0F0F16", border: `1px solid ${phase === "verified" ? AX.success : AX.border}`,
        display: scanning || phase === "verified" ? "block" : "none",
      }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {scanning && (
          <div style={{
            position: "absolute", left: 10, bottom: 10, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(10,10,15,0.72)", borderRadius: 999, padding: "5px 10px",
            fontSize: 11, fontWeight: 600, color: AX.text,
          }}>
            <Loader2 size={12} className="ax-spin" />
            {streak}/{REQUIRED_STREAK} checks
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
          {scanning ? "Checking your setup…" : phase === "error" ? "Try again" : "Start camera check"}
        </button>
      )}

      {phase === "verified" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          minHeight: 46, borderRadius: 12, border: `1px solid ${AX.success}`, color: AX.success,
          fontSize: 14, fontWeight: 600,
        }}>
          <Check size={16} />{cfg.verified}
        </div>
      )}

      {!!status && phase !== "error" && (
        <div style={{ fontSize: 12, color: AX.muted, lineHeight: 1.5 }}>{status}</div>
      )}

      {seen.length > 0 && phase === "scanning" && (
        <div style={{ fontSize: 12, color: AX.muted }}>Seeing: {seen.join(", ")}</div>
      )}

      {error && <div style={{ fontSize: 12, color: AX.danger, lineHeight: 1.5 }}>{error}</div>}
    </div>
  );
}

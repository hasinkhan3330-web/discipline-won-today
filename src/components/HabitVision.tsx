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

/** How many consecutive checks must find one of the classes. */
const REQUIRED_STREAK = 2;
/** A single very confident hit is enough — no waiting for a streak. */
const INSTANT_CONFIDENCE = 0.62;
/** Minimum gap between frame checks (checks are otherwise back-to-back). */
const CHECK_MS = 250;
/** Give up after this long without a confirmed setup. */
const TIMEOUT_MS = 90_000;
/** If the API is this slow on average, accept the first plausible hit. */
const SLOW_API_MS = 2200;
const MIN_CONFIDENCE = 0.35;

type Phase = "idle" | "starting" | "scanning" | "verified" | "error";

/**
 * Live camera check for a habit's setup (study desk, shower, workout gear).
 *
 * Frames are captured locally and sent to the server, which calls the vision
 * model with the private key. Detections only describe what is visible, so
 * results are worded as "setup verified" — never as proof of the activity.
 */
export function HabitVision({ visionKind, onVerified }: { visionKind: VisionKind; onVerified: () => void }) {
  const cfg = VISION_CONFIG[visionKind];
  const detect = useServerFn(detectHabitEvidence);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const streakRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [streak, setStreak] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const grabFrame = (): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = 416;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.6);
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
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

    setPhase("scanning");
    setStatus(cfg.prompt);
    void loop();
  };

  const loop = async () => {
    const deadline = Date.now() + TIMEOUT_MS;
    let calls = 0;
    let totalMs = 0;
    let transient = 0;

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

      const frame = grabFrame();
      if (frame) {
        const t0 = Date.now();
        try {
          const res = await detect({ data: { imageBase64: frame } });
          if (doneRef.current) return;
          calls += 1;
          totalMs += Date.now() - t0;

          if (!res.ok) {
            // One bad answer should not end the session — retry a couple of times.
            transient += 1;
            if (transient >= 3) {
              stopCamera();
              setPhase("error");
              setError(res.error);
              return;
            }
            await new Promise(r => setTimeout(r, CHECK_MS));
            continue;
          }
          transient = 0;

          const strong = res.detections.filter(d => d.confidence >= MIN_CONFIDENCE);
          const labels = strong.map(d => d.label);
          setSeen(labels.slice(0, 4));

          const hit = matchesEvidence(labels, visionKind);
          const best = strong.find(d => matchesEvidence([d.label], visionKind));
          const slow = calls >= 2 && totalMs / calls > SLOW_API_MS;

          if (hit) {
            // Instant pass on a confident hit, or when the API is running slow.
            if ((best?.confidence ?? 0) >= INSTANT_CONFIDENCE || slow) {
              succeed(res.detections);
              return;
            }
            streakRef.current += 1;
            setStreak(streakRef.current);
            setStatus(`Setup seen (${streakRef.current}/${REQUIRED_STREAK} checks)…`);
          } else {
            streakRef.current = 0;
            setStreak(0);
            setStatus(cfg.missing);
          }

          if (streakRef.current >= REQUIRED_STREAK) {
            succeed(res.detections);
            return;
          }
        } catch {
          if (doneRef.current) return;
          transient += 1;
          if (transient >= 3) {
            stopCamera();
            setPhase("error");
            setError("The check could not be completed. Please try again.");
            return;
          }
        }
      }

      await new Promise(r => setTimeout(r, CHECK_MS));
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

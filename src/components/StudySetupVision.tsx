import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { detectHabitEvidence } from "@/utils/roboflow.functions";
import { Camera, Loader2, Check } from "lucide-react";

/** Classes accepted as evidence of a study setup. */
const REQUIRED_CLASSES = ["book", "notebook", "laptop", "desk"];
/** How many consecutive checks must find one of the classes. */
const REQUIRED_STREAK = 3;
/** Gap between frame checks. */
const CHECK_MS = 2500;
/** Give up after this long without a confirmed setup. */
const TIMEOUT_MS = 90_000;
const MIN_CONFIDENCE = 0.4;

type Phase = "idle" | "starting" | "scanning" | "verified" | "error";

const matches = (labels: string[]) =>
  labels.some(l => REQUIRED_CLASSES.some(c => l.toLowerCase().includes(c)));

/**
 * Live camera check for the Deep Focus habit.
 *
 * Frames are captured locally and sent to the server, which calls the vision
 * model with the private key. Detections only describe what is visible, so the
 * result is worded as "Study setup verified" — never as proof of studying.
 */
export function StudySetupVision({ onVerified }: { onVerified: () => void }) {
  const detect = useServerFn(detectHabitEvidence);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const streakRef = useRef(0);

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
    const w = 640;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72);
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
    setStatus("Point at your desk — keep your book, notebook or laptop in view.");
    void loop();
  };

  const loop = async () => {
    const deadline = Date.now() + TIMEOUT_MS;

    while (!doneRef.current && streamRef.current) {
      if (Date.now() > deadline) {
        stopCamera();
        setPhase("error");
        setError("Could not confirm a study setup. Move closer to your desk and try again.");
        return;
      }

      const frame = grabFrame();
      if (frame) {
        try {
          const res = await detect({ data: { imageBase64: frame } });
          if (doneRef.current) return;

          if (!res.ok) {
            stopCamera();
            setPhase("error");
            setError(res.error);
            return;
          }

          const labels = res.detections
            .filter(d => d.confidence >= MIN_CONFIDENCE)
            .map(d => d.label);
          setSeen(labels.slice(0, 4));

          if (matches(labels)) {
            streakRef.current += 1;
            setStreak(streakRef.current);
            setStatus(`Study setup seen (${streakRef.current}/${REQUIRED_STREAK} checks)…`);
          } else {
            streakRef.current = 0;
            setStreak(0);
            setStatus("Nothing recognised yet — show your book, notebook, laptop or desk.");
          }

          if (streakRef.current >= REQUIRED_STREAK) {
            doneRef.current = true;
            stopCamera();
            setPhase("verified");
            setStatus("Study setup verified.");
            haptic("success");
            onVerified();
            return;
          }
        } catch {
          if (doneRef.current) return;
          stopCamera();
          setPhase("error");
          setError("The check could not be completed. Please try again.");
          return;
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
          <Check size={16} />Study setup verified
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

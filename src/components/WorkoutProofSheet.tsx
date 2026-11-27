import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { verifyWorkoutProof } from "@/lib/workout-proof.functions";

const PRESETS = ["Gym", "Pushups", "Home Workout", "Running", "Yoga"] as const;
const MAX_WIDTH = 600;
const JPEG_QUALITY = 0.7;

async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare image.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function WorkoutProofSheet({
  taskId,
  onCompleted,
  onBack,
}: {
  taskId: string;
  onCompleted: (result: { coins: number; streak: number; awarded: number }) => void;
  onBack: () => void;
}) {
  const runVerify = useServerFn(verifyWorkoutProof);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [workoutType, setWorkoutType] = useState<string>("Gym");
  const [custom, setCustom] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const activeWorkout = (custom.trim() || workoutType).trim();

  const openCamera = () => {
    if (!activeWorkout || busy || cooldown > 0) return;
    haptic("tap");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const onCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const compressed = await compressPhoto(file);
      const res = await runVerify({
        data: { taskId, workoutType: activeWorkout, imageBase64: compressed },
      });
      if (res.verified) {
        haptic("success");
        const awarded = res.awarded ?? 0;
        setFeedback({
          ok: true,
          text:
            awarded > 0
              ? `${res.reason} +${awarded} coins credited.`
              : `${res.reason} Workout logged.`,
        });
        onCompleted({
          coins: res.coins ?? 0,
          streak: res.streak ?? 0,
          awarded,
        });
      } else {
        haptic("warn");
        setFeedback({ ok: false, text: res.reason });
        if (!res.retryAllowed) {
          setCooldown(res.retryAfterSec && res.retryAfterSec > 0 ? res.retryAfterSec : 60);
        }
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Could not verify photo.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.45 }}>
        Pick or type your workout, then take a live photo to earn +10 coins.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {PRESETS.map(p => {
          const active = !custom.trim() && workoutType === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => { setWorkoutType(p); setCustom(""); }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${active ? AX.accent : AX.border}`,
                background: active ? "#1D1D28" : "#181820",
                color: active ? AX.text : AX.muted,
                fontFamily: AX.font,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={custom}
        onChange={e => setCustom(e.target.value)}
        placeholder="Or type another workout (e.g. Cycling)"
        maxLength={80}
        style={{
          width: "100%",
          minHeight: 42,
          padding: "0 12px",
          borderRadius: 10,
          border: `1px solid ${AX.border}`,
          background: "#14141B",
          color: AX.text,
          fontFamily: AX.font,
          fontSize: 14,
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCapture}
        style={{ display: "none" }}
      />

      <button
        type="button"
        onClick={openCamera}
        disabled={busy || cooldown > 0 || !activeWorkout}
        style={{
          minHeight: 46,
          padding: "0 16px",
          borderRadius: 12,
          cursor: busy || cooldown > 0 ? "not-allowed" : "pointer",
          fontFamily: AX.font,
          fontSize: 14,
          fontWeight: 600,
          background: AX.accent,
          border: `1px solid ${AX.accent}`,
          color: "#FFFFFF",
          opacity: busy || cooldown > 0 ? 0.65 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
        }}
      >
        {busy ? (
          <><Loader2 size={16} className="animate-spin" />Verifying live photo...</>
        ) : cooldown > 0 ? (
          <><RotateCcw size={16} />Try again in {cooldown}s</>
        ) : feedback && !feedback.ok ? (
          <><RotateCcw size={16} />Retry Live Camera</>
        ) : (
          <><Camera size={16} />Verify &amp; Complete Workout</>
        )}
      </button>

      {feedback && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${feedback.ok ? AX.accent : "#EF4444"}`,
            background: feedback.ok ? "rgba(184,224,0,0.08)" : "rgba(239,68,68,0.1)",
            color: AX.text,
            fontSize: 13,
            lineHeight: 1.45,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {feedback.ok && <Check size={16} color={AX.accent} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        style={{
          minHeight: 42,
          padding: "0 14px",
          borderRadius: 12,
          cursor: "pointer",
          fontFamily: AX.font,
          fontSize: 13,
          fontWeight: 600,
          background: "transparent",
          border: `1px solid ${AX.border}`,
          color: AX.text,
          width: "100%",
        }}
      >
        Other verification options
      </button>
    </div>
  );
}
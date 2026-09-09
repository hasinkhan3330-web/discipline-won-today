import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { detectHabitEvidence, type Detection } from "@/utils/roboflow.functions";
import { matchesEvidence, VISION_CONFIG, logVision, type VisionKind } from "@/components/HabitVision";
import { Camera, Loader2, Check } from "lucide-react";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that photo"));
    r.readAsDataURL(file);
  });

const MIN_CONFIDENCE = 0.4;

/**
 * Photo evidence for a habit: the user picks/takes a picture, it is checked by
 * the image model on the server, and only the matching evidence labels count.
 */
export function PhotoProof({ visionKind, onVerified }: { visionKind: VisionKind; onVerified: () => void }) {
  const cfg = VISION_CONFIG[visionKind];
  const detect = useServerFn(detectHabitEvidence);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Detection[] | null>(null);
  const [checked, setChecked] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    setMatched(null);
    setChecked(false);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const res = await detect({ data: { imageBase64: dataUrl } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const hits = res.detections.filter(
        d => d.confidence >= MIN_CONFIDENCE && matchesEvidence([d.label], visionKind),
      );
      setMatched(hits);
      setChecked(true);
      if (hits.length > 0) {
        logVision(visionKind, "photo", hits);
        haptic("success");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo check failed");
    } finally {
      setBusy(false);
    }
  };

  const found = !!matched && matched.length > 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; void pick(f); }}
      />

      {preview && (
        <img
          src={preview}
          alt="Your habit photo"
          style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12, border: `1px solid ${AX.border}` }}
        />
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          minHeight: 46, borderRadius: 12, cursor: busy ? "wait" : "pointer",
          background: AX.accent, border: `1px solid ${AX.accent}`, color: "#FFFFFF",
          fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {busy ? <Loader2 size={16} className="ax-spin" /> : <Camera size={16} />}
        {busy ? "Checking your photo…" : preview ? "Take another photo" : "Take / upload a photo"}
      </button>

      {checked && (
        <div style={{ background: "#181820", border: `1px solid ${found ? AX.success : AX.border}`, borderRadius: 12, padding: 12 }}>
          {found ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: AX.text, marginBottom: 8 }}>Evidence found in your photo</div>
              {matched!.slice(0, 5).map((d, i) => (
                <div key={`${d.label}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: AX.muted, padding: "3px 0" }}>
                  <span style={{ color: AX.text }}>{d.label}</span>
                  <span>{Math.round(d.confidence * 100)}%</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5 }}>
              That photo doesn't show the right evidence. {cfg.missing.charAt(0).toUpperCase() + cfg.missing.slice(1).replace(/^Nothing recognised yet — /, "")}
            </div>
          )}
        </div>
      )}

      {found && (
        <button
          onClick={() => { haptic("success"); onVerified(); }}
          style={{
            minHeight: 46, borderRadius: 12, cursor: "pointer",
            background: "transparent", border: `1px solid ${AX.success}`, color: AX.success,
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Check size={16} />Log this habit
        </button>
      )}

      {error && <div style={{ fontSize: 12, color: AX.danger, lineHeight: 1.5 }}>{error}</div>}
    </div>
  );
}

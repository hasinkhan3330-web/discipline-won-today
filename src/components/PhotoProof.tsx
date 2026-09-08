import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { detectHabitEvidence, type Detection } from "@/utils/roboflow.functions";
import { Camera, Loader2, Check } from "lucide-react";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that photo"));
    r.readAsDataURL(file);
  });

/**
 * Photo evidence for a habit: the user picks/takes a picture, it is checked by
 * the image model on the server, and the labels found are shown back.
 */
export function PhotoProof({ onVerified }: { onVerified: () => void }) {
  const detect = useServerFn(detectHabitEvidence);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Detection[] | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    setResults(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const res = await detect({ data: { imageBase64: dataUrl } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResults(res.detections);
      if (res.detections.length > 0) haptic("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo check failed");
    } finally {
      setBusy(false);
    }
  };

  const found = !!results && results.length > 0;

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

      {results && (
        <div style={{ background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 12, padding: 12 }}>
          {found ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: AX.text, marginBottom: 8 }}>Found in your photo</div>
              {results.slice(0, 5).map((d, i) => (
                <div key={`${d.label}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: AX.muted, padding: "3px 0" }}>
                  <span style={{ color: AX.text }}>{d.label}</span>
                  <span>{Math.round(d.confidence * 100)}%</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5 }}>
              Nothing recognisable in that photo. Try again with a clearer shot.
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

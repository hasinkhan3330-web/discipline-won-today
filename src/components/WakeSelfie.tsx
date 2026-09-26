import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyWakeSelfie, type WakeSelfieResult } from "@/utils/wake-selfie.functions";

/** Live front-camera capture for Wake Up 4AM. No gallery, no upload, nothing kept. */
export function WakeSelfie({ onDone, onClose }: { onDone: (r: Extract<WakeSelfieResult, { ok: true }>) => void; onClose: () => void }) {
  const verify = useServerFn(verifyWakeSelfie);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [msg, setMsg] = useState("AXEN needs your camera for a quick live selfie to confirm you're awake. It is deleted instantly.");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setReady(true);
      } catch {
        setMsg("Camera access was denied or unavailable. Allow the camera to check in.");
      }
    })();
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const grab = (v: HTMLVideoElement, w: number) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = Math.round(w * (v.videoHeight || 640) / (v.videoWidth || 480));
    const ctx = c.getContext("2d"); ctx?.drawImage(v, 0, 0, c.width, c.height);
    return { c, ctx };
  };
  const grey = (v: HTMLVideoElement) => {
    const { c, ctx } = grab(v, 32);
    const px = ctx?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
    const out: number[] = [];
    for (let i = 0; i < px.length; i += 4) out.push(((px[i] ?? 0) + (px[i + 1] ?? 0) + (px[i + 2] ?? 0)) / 3);
    c.width = 0; return out;
  };
  const jpeg = (v: HTMLVideoElement) => { const { c } = grab(v, 480); const d = c.toDataURL("image/jpeg", 0.7); c.width = 0; return d; };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !ready || busy) return;
    setBusy(true);
    setMsg("Hold still and look at the camera…");
    let a = jpeg(v); let b = "";
    // Liveness: ~2 s of 32x32 greyscale samples; a live face shows small natural motion.
    let prev = grey(v); let total = 0; let n = 0;
    for (let i = 0; i < 13; i++) {
      await new Promise(r => setTimeout(r, 150));
      const cur = grey(v);
      let d = 0; for (let k = 0; k < cur.length; k++) d += Math.abs((cur[k] ?? 0) - (prev[k] ?? 0));
      total += d / Math.max(1, cur.length); n++; prev = cur;
    }
    const motion = total / Math.max(1, n);
    if (motion < 0.6) { a = ""; setMsg("No natural movement detected. Use your live face, not a photo."); setBusy(false); return; }
    b = jpeg(v);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await verify({ data: { frames: [a, b], motion, tz } });
      a = ""; b = "";
      if (r.ok) { streamRef.current?.getTracks().forEach(t => t.stop()); onDone(r); return; }
      setMsg(r.message);
    } catch { setMsg("Selfie check failed. Try again."); }
    finally { a = ""; b = ""; setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Wake Up 4AM selfie check" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", background: "rgb(0 0 0 / .82)", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(360px, 100%)", borderRadius: 20, padding: 16, background: "oklch(0.14 0.02 250)", border: "1px solid oklch(0.45 0.12 240 / .6)", color: "oklch(0.95 0.01 240)", textAlign: "center" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 14, transform: "scaleX(-1)", background: "#000" }} />
        <p style={{ fontSize: 13, margin: "12px 0" }}>{msg}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, background: "transparent", color: "inherit", border: "1px solid oklch(0.45 0.05 240)" }}>Cancel</button>
          <button type="button" onClick={capture} disabled={!ready || busy} style={{ flex: 2, padding: 12, borderRadius: 12, border: 0, fontWeight: 700, background: "oklch(0.85 0.2 130)", color: "oklch(0.15 0.02 250)", opacity: !ready || busy ? .6 : 1 }}>{busy ? "Checking…" : "Take live selfie"}</button>
        </div>
      </div>
    </div>
  );
}

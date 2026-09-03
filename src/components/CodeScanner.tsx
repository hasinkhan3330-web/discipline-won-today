import { useEffect, useRef, useState } from "react";
import { AX } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { CameraOff, ScanLine } from "lucide-react";

/**
 * High-performance in-app QR / barcode scanner.
 * Loads html5-qrcode lazily (browser only) and reports the first decoded code.
 * Never throws: camera / permission failures surface as a friendly message.
 */
export function CodeScanner({
  onDetected,
  onError,
  height = 260,
}: {
  onDetected: (text: string) => void;
  onError?: (message: string) => void;
  height?: number;
}) {
  const idRef = useRef(`ax-scan-${Math.random().toString(36).slice(2)}`);
  const [err, setErr] = useState<string>("");
  const doneRef = useRef(false);
  const hitRef = useRef(onDetected);
  hitRef.current = onDetected;

  useEffect(() => {
    let scanner: any = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod as any;
        scanner = new Html5Qrcode(idRef.current, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
        });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 25, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0, disableFlip: false },
          (text: string) => {
            if (doneRef.current) return;
            doneRef.current = true;
            haptic("success");
            hitRef.current(text);
          },
          () => { /* per-frame miss — ignore */ },
        );
      } catch (e: any) {
        if (cancelled) return;
        const msg =
          e?.name === "NotAllowedError" || /permission|denied/i.test(String(e?.message))
            ? "Camera permission denied. Allow camera access to verify this task."
            : "Camera unavailable on this device.";
        setErr(msg);
        onError?.(msg);
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
        else scanner?.clear?.();
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) {
    return (
      <div style={{
        display: "grid", gap: 8, justifyItems: "center", padding: 18, borderRadius: 12,
        background: "#181820", border: `1px solid ${AX.border}`, color: AX.muted,
        fontSize: 13, textAlign: "center", lineHeight: 1.5,
      }}>
        <CameraOff size={22} strokeWidth={1.8} />
        {err}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
      <style>{`
        #${idRef.current} video { width: 100% !important; height: 100% !important; object-fit: cover; }
        @keyframes ax-scanline { 0%{top:0} 100%{top:100%} }
      `}</style>
      <div id={idRef.current} style={{ width: "100%", height }} />
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2, background: AX.accent,
        boxShadow: `0 0 12px ${AX.accent}`, animation: "ax-scanline 1.6s linear infinite",
      }} />
      <div style={{
        position: "absolute", bottom: 8, left: 0, right: 0, display: "flex",
        alignItems: "center", justifyContent: "center", gap: 6,
        color: "#FFFFFF", fontSize: 12, fontFamily: AX.font, opacity: 0.85,
      }}>
        <ScanLine size={14} /> Hold the code steady in frame
      </div>
    </div>
  );
}

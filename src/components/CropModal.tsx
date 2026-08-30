import { useEffect, useRef, useState } from "react";

export function CropModal({ src, accent, accent2, busy, onCancel, onConfirm }: {
  src: string; accent: string; accent2: string; busy: boolean;
  onCancel: () => void; onConfirm: (blob: Blob) => void;
}) {
  const BOX = 280; // preview viewport (square)
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const baseScale = natural ? Math.max(BOX / natural.w, BOX / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural ? natural.w * scale : 0;
  const dispH = natural ? natural.h * scale : 0;

  const clamp = (x: number, y: number) => {
    const minX = BOX - dispW, minY = BOX - dispH;
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
  };

  useEffect(() => { if (natural) setPos(p => clamp(p.x, p.y));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural]);

  const onDown = (cx: number, cy: number) => {
    drag.current = { sx: cx, sy: cy, px: pos.x, py: pos.y };
  };
  const onMove = (cx: number, cy: number) => {
    if (!drag.current) return;
    const nx = drag.current.px + (cx - drag.current.sx);
    const ny = drag.current.py + (cy - drag.current.sy);
    setPos(clamp(nx, ny));
  };
  const onUp = () => { drag.current = null; };

  const doConfirm = async () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const OUT = 512;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const srcX = -pos.x / scale;
    const srcY = -pos.y / scale;
    const srcSize = BOX / scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
    canvas.toBlob(b => { if (b) onConfirm(b); }, "image/jpeg", 0.9);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 360, maxHeight: "88dvh", overflowY: "auto", background: "#0a0a19",
        border: `1px solid ${accent}`, borderLeft: `4px solid ${accent}`,
        boxShadow: `0 0 40px ${accent}66`, padding: 18, fontFamily: "monospace",
      }}>
        <div style={{ fontSize: 10, color: accent, letterSpacing: 4, marginBottom: 4 }}>◈ CROP & FIT</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: 2, marginBottom: 12 }}>
          POSITION YOUR FACE
        </div>

        <div
          onMouseDown={e => { e.preventDefault(); onDown(e.clientX, e.clientY); }}
          onMouseMove={e => onMove(e.clientX, e.clientY)}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }}
          onTouchMove={e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }}
          onTouchEnd={onUp}
          style={{
            position: "relative", width: BOX, height: BOX, margin: "0 auto",
            overflow: "hidden", background: "#000",
            border: `1px solid ${accent}66`, cursor: drag.current ? "grabbing" : "grab",
            touchAction: "none", userSelect: "none",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            ref={imgRef}
            src={src}
            draggable={false}
            onLoad={e => {
              const el = e.currentTarget;
              const w = el.naturalWidth, h = el.naturalHeight;
              const bs = Math.max(BOX / w, BOX / h);
              const dW = w * bs, dH = h * bs;
              setNatural({ w, h });
              setPos({ x: (BOX - dW) / 2, y: (BOX - dH) / 2 });
              setZoom(1);
            }}
            style={{
              position: "absolute",
              left: pos.x, top: pos.y,
              width: dispW || "auto", height: dispH || "auto",
              maxWidth: "none", pointerEvents: "none",
            }}
          />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
            borderRadius: "50%",
          }} />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            border: `2px dashed ${accent}`, borderRadius: "50%",
            boxShadow: `0 0 20px ${accent}88`,
          }} />
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: accent, letterSpacing: 2 }}>ZOOM</span>
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: accent }}
          />
          <span style={{ fontSize: 10, color: "#888", width: 32, textAlign: "right" }}>{zoom.toFixed(1)}x</span>
        </div>

        <div style={{ fontSize: 9, color: "#666", letterSpacing: 1, marginTop: 8, textAlign: "center" }}>
          DRAG TO REPOSITION · CIRCLE = FINAL CROP
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: 10, background: "transparent", border: `1px solid #333`,
              color: "#aaa", fontFamily: "monospace", fontSize: 11, fontWeight: 800,
              letterSpacing: 3, cursor: busy ? "wait" : "pointer",
            }}
          >CANCEL</button>
          <button
            onClick={doConfirm}
            disabled={busy || !natural}
            style={{
              padding: 10, background: `linear-gradient(90deg, ${accent}, ${accent2})`,
              border: "none", color: "#000", fontFamily: "monospace", fontSize: 11, fontWeight: 900,
              letterSpacing: 3, cursor: busy ? "wait" : "pointer",
              boxShadow: `0 0 15px ${accent}88`,
              opacity: busy ? 0.7 : 1,
            }}
          >{busy ? "SAVING…" : "USE PHOTO"}</button>
        </div>
      </div>
    </div>
  );
}

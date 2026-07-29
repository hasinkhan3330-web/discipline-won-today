import type { ReactNode } from "react";

/**
 * Post-trial soft gate: content stays visible but is blurred / frozen until
 * the user subscribes. No hard lock screen.
 */
export function BlurLock({
  G,
  G2,
  active,
  blur = true,
  note,
  onUnlock,
  children,
}: {
  G: string;
  G2: string;
  active: boolean;
  blur?: boolean;
  note?: string;
  onUnlock: () => void;
  children: ReactNode;
}) {
  if (!active) return <>{children}</>;

  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden={blur}
        style={{
          filter: blur ? "blur(9px) saturate(0.7)" : undefined,
          opacity: blur ? 0.75 : 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>

      <div style={{ position: "sticky", bottom: 12, zIndex: 5, marginTop: -70 }}>
        <div
          style={{
            background: "rgba(8,8,20,0.9)",
            backdropFilter: "blur(14px)",
            border: `1px solid ${G}66`,
            borderLeft: `3px solid ${G}`,
            boxShadow: `0 0 26px ${G}33`,
            padding: 14,
            textAlign: "center",
            borderRadius: 2,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: 3, color: G, fontWeight: 900 }}>◉ PRO LOCKED</div>
          <div style={{ fontSize: 11, color: "#bbb", letterSpacing: 1, lineHeight: 1.6, margin: "6px 0 12px" }}>
            {note ?? "Your 3-day free access has ended. Subscribe to reveal this."}
          </div>
          <button
            onClick={onUnlock}
            style={{
              padding: "11px 26px",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${G}, ${G2})`,
              border: "none",
              color: "#000",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 3,
              boxShadow: `0 0 20px ${G}88`,
            }}
          >
            ▸ UNLOCK PRO
          </button>
        </div>
      </div>
    </div>
  );
}

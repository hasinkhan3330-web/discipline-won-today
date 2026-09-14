import type { Entitlement } from "@/hooks/useEntitlement";

const CYAN = "#20E7F2";
const VIOLET = "#8257FF";

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Compact live trial strip: day, remaining time, 3-stage progress, upgrade. */
export function TrialBanner({ ent, onUpgrade }: { ent: Entitlement; onUpgrade: () => void }) {
  if (ent.accessStatus !== "trial") return null;
  const day = Math.min(3, Math.max(1, ent.trialDay || 1));

  return (
    <div
      style={{
        margin: "10px 12px 0",
        padding: "10px 12px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(32,231,242,0.10), rgba(130,87,255,0.12))",
        border: `1px solid ${CYAN}44`,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: CYAN, fontSize: 10, letterSpacing: 2, fontWeight: 900 }}>AXEN PRO TRIAL</span>
        <span style={{ color: "#91A0B6", fontSize: 10, letterSpacing: 1 }}>Day {day} of 3</span>
        <span style={{ marginLeft: "auto", color: "#F5F7FF", fontSize: 11, fontWeight: 700 }}>
          {fmt(ent.remainingSeconds)}
        </span>
        <button
          onClick={onUpgrade}
          style={{
            minHeight: 32, padding: "6px 12px", borderRadius: 10, border: "none",
            background: VIOLET, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
          }}
        >
          Upgrade
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[1, 2, 3].map(stage => (
          <div
            key={stage}
            style={{
              flex: 1, height: 4, borderRadius: 3,
              background: stage <= day
                ? `linear-gradient(90deg, ${CYAN}, ${VIOLET})`
                : "rgba(145,160,182,0.22)",
              transition: "background 400ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** One-time welcome shown on the first authenticated session of the trial. */
export function TrialWelcome({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="AXEN Pro trial started"
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(3,7,17,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 340, background: "#091221",
          border: `1px solid ${CYAN}44`, borderRadius: 18, padding: "26px 20px", textAlign: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div style={{ color: CYAN, fontSize: 10, letterSpacing: 3, fontWeight: 900 }}>AXEN PRO TRIAL</div>
        <h2 style={{ color: "#F5F7FF", fontSize: 19, lineHeight: 1.35, margin: "12px 0 8px", fontWeight: 800 }}>
          Your complete AXEN experience is unlocked
        </h2>
        <p style={{ color: "#91A0B6", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Explore Zen, Rank and Coach free for 3 days
        </p>
        <p style={{ color: "#6D7C92", fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
          No payment required. Access ends automatically unless you subscribe.
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: "100%", minHeight: 46, borderRadius: 12, border: "none",
            background: `linear-gradient(90deg, ${CYAN}, ${VIOLET})`, color: "#02121a",
            fontSize: 13, fontWeight: 900, letterSpacing: 1, cursor: "pointer",
          }}
        >
          START MY 3 DAYS
        </button>
      </div>
    </div>
  );
}

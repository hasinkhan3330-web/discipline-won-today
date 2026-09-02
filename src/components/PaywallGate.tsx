import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { AX } from "@/tabs/styles";

/**
 * PaywallGate — wraps premium surfaces (Zen Mode, Rank, Accountability).
 *
 * hasAccess === true  → children render seamlessly (Days 1–3 feel fully free;
 *                       no counters, no lock badges, no upgrade prompts).
 * hasAccess === false → blurred background preview + elegant paywall card
 *                       with a single "Upgrade Account" action.
 */
export function PaywallGate({
  hasAccess,
  featureName,
  onUpgrade,
  children,
}: {
  hasAccess: boolean;
  featureName?: string;
  onUpgrade: () => void;
  children: ReactNode;
}) {
  if (hasAccess) return <>{children}</>;

  return (
    <div style={{ position: "relative", minHeight: 320, borderRadius: 16, overflow: "hidden" }}>
      {/* Blurred preview of the locked surface */}
      <div
        aria-hidden
        style={{
          filter: "blur(10px) saturate(0.6)",
          opacity: 0.55,
          pointerEvents: "none",
          userSelect: "none",
          maxHeight: 340,
          overflow: "hidden",
        }}
      >
        {children}
      </div>

      {/* Paywall card overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "rgba(10,10,15,0.55)",
        }}
      >
        <div
          role="dialog"
          aria-label="Unlock full access"
          style={{
            width: "100%",
            maxWidth: 320,
            background: AX.card,
            border: `1px solid ${AX.border}`,
            borderRadius: 16,
            padding: "26px 22px",
            textAlign: "center",
            animation: "fadeUp 0.4s ease-out",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: `${AX.accent}1A`,
              border: `1px solid ${AX.accent}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={20} color={AX.accent} strokeWidth={2} />
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: AX.text, letterSpacing: 0.2 }}>
            Unlock Full Access
          </div>
          <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6, marginTop: 8 }}>
            Your trial period has ended. Upgrade your account to continue using
            Zen Mode, Rank, and Accountability.
          </div>

          <button
            onClick={onUpgrade}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "13px 0",
              background: AX.accent,
              border: "none",
              borderRadius: 12,
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: AX.font,
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
          >
            Upgrade Account
          </button>
        </div>
      </div>
    </div>
  );
}

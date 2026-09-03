import { AX } from "@/tabs/styles";

/** Neutral loading state shown until the server entitlement verdict resolves. */
export function GateSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 4 }}>
      {[120, 80, 80, 160].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: 16,
            background: AX.surface,
            border: `1px solid ${AX.border}`,
            opacity: 0.7,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

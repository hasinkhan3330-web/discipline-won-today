import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformCheckout } from "@/components/PlatformCheckout";
import { PRICING, type Cycle } from "@/lib/pricing";
import axenLogo from "@/assets/axen-logo.png";

export const Route = createFileRoute("/pro")({
  head: () => ({
    title: "AXEN PRO — Unlock Full Access",
    meta: [
      { name: "description", content: "Upgrade to AXEN PRO. ₹99/month or ₹499/year with a 3-day free trial. Unlock Accountability, Zen, Rank Scan, and AI Assistant." },
      { property: "og:title", content: "AXEN PRO — Unlock Full Access" },
      { property: "og:description", content: "Upgrade to AXEN PRO. 3-day free trial, cancel anytime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN PRO — Unlock Full Access" },
      { name: "twitter:description", content: "Upgrade to AXEN PRO. ₹99/month or ₹499/year, 3-day free trial." },
    ],
  }),
  component: ProPage,
});

const G = "#00d4ff";
const G2 = "#a855f7";

const BASIC_PERKS = ["Alarm", "Daily Quotes"];
const PRO_PERKS = [
  "Full App Access",
  "Accountability Mode",
  "Zen Mode",
  "Rank Scan",
  "AI Assistant",
];

const PLAN_COPY: Record<Cycle, { title: string; price: string; per: string; note: string; save?: string }> = {
  monthly: {
    title: "MONTHLY",
    price: "₹99",
    per: "/month",
    note: "3 days free, then billed via the app store",
  },
  yearly: {
    title: "YEARLY",
    price: "₹499",
    per: "/year",
    note: "3 days free, then billed via the app store",
    save: "SAVE 58%",
  },
};

function CyanCheck({ glow = false }: { glow?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={glow ? G : "#7c8ea0"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        marginTop: 2,
        filter: glow ? `drop-shadow(0 0 6px ${G})` : "none",
      }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ProPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
      }
      setReady(true);
    });
  }, []);

  return (
    <div
      className="axen-page ax-shell"
      style={{
        position: "relative",
        background: "#0A0A0F",
        color: "#e8e8e8",
        overflowX: "clip",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ambient nebula */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 18%, ${G2}18, transparent 48%), radial-gradient(circle at 82% 86%, ${G}18, transparent 50%)`,
          pointerEvents: "none",
        }}
      />
      {/* subtle grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.08,
          backgroundImage: `linear-gradient(${G}22 1px, transparent 1px), linear-gradient(90deg, ${G}22 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          animation: "axen-grid-move 12s linear infinite",
          pointerEvents: "none",
          maskImage: "radial-gradient(circle at 50% 30%, #000 8%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 30%, #000 8%, transparent 70%)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          padding: "32px 18px calc(28px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          flex: 1,
        }}
      >
        {/* header */}
        <div style={{ position: "relative", textAlign: "center", animation: "axen-float-up 700ms ease both" }}>
          {[280, 200].map((s, i) => (
            <div
              key={s}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: s,
                height: s,
                marginLeft: -s / 2,
                marginTop: -s / 2,
                borderRadius: "50%",
                border: `1px solid ${i ? G2 : G}22`,
                borderTopColor: i ? G2 : G,
                animation: `axen-orbit ${i ? 6 : 10}s linear infinite ${i ? "reverse" : ""}`,
                pointerEvents: "none",
              }}
            />
          ))}
          <img
            src={axenLogo}
            alt="AXEN"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 130,
              margin: "0 auto",
              display: "block",
              animation: "axen-glow 3.4s ease-in-out infinite",
            }}
          />
          <h1
            className="axen-display"
            style={{
              position: "relative",
              marginTop: 10,
              fontSize: "clamp(16px, 5vw, 22px)",
              fontWeight: 900,
              letterSpacing: "clamp(4px, 1.4vw, 8px)",
              color: "#fff",
              textShadow: `0 0 18px ${G}, 0 0 42px ${G}55`,
            }}
          >
            AXEN
          </h1>
          <p
            className="axen-display"
            style={{
              position: "relative",
              marginTop: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 4,
              color: G,
              textShadow: `0 0 10px ${G}88`,
            }}
          >
            HABIT &amp; DISCIPLINE — ACCESS TERMINAL
          </p>
          <div
            style={{
              position: "relative",
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 2,
              background: "rgba(0, 212, 255, 0.10)",
              border: `1px solid ${G}44`,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: 3,
              color: G,
              textShadow: `0 0 8px ${G}66`,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: G,
                boxShadow: `0 0 8px ${G}`,
                animation: "axen-flicker 2s linear infinite",
              }}
            />
            3 DAYS FREE
          </div>
        </div>

        {/* comparison card */}
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: 10,
            borderRadius: 8,
            background: "linear-gradient(160deg, rgba(20,20,28,0.92), rgba(12,12,18,0.92))",
            border: "1px solid #23232E",
            boxShadow: "inset 0 0 40px rgba(0,212,255,0.04), 0 10px 40px rgba(0,0,0,0.35)",
            animation: "axen-float-up 700ms ease 120ms both",
          }}
        >
          {/* basic column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 12,
              borderRadius: 6,
              background: "rgba(10,10,15,0.55)",
              border: "1px solid #23232E",
            }}
          >
            <div
              className="axen-display"
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 3,
                color: "#7c8ea0",
                textAlign: "center",
                paddingBottom: 8,
                borderBottom: "1px solid #23232E",
              }}
            >
              BASIC
            </div>
            {BASIC_PERKS.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: "#9fb3c4",
                }}
              >
                <CyanCheck glow={false} />
                {p}
              </div>
            ))}
          </div>

          {/* pro column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 12,
              borderRadius: 6,
              background: "rgba(0, 212, 255, 0.06)",
              border: `1px solid ${G}66`,
              boxShadow: `0 0 18px ${G}22, inset 0 0 30px ${G}0a`,
            }}
          >
            <div
              className="axen-display"
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 3,
                color: "#fff",
                textAlign: "center",
                paddingBottom: 8,
                borderBottom: `1px solid ${G}44`,
                textShadow: `0 0 10px ${G}66`,
              }}
            >
              PRO
            </div>
            {PRO_PERKS.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: "#eaf7ff",
                }}
              >
                <CyanCheck glow />
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* pricing cards */}
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            animation: "axen-float-up 700ms ease 220ms both",
          }}
        >
          {(["monthly", "yearly"] as const).map((c) => {
            const p = PLAN_COPY[c];
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className="axen-btn"
                style={{
                  position: "relative",
                  textAlign: "left",
                  padding: 14,
                  cursor: "pointer",
                  background: active
                    ? `linear-gradient(135deg, ${G}18, ${G2}18)`
                    : "rgba(20,20,28,0.85)",
                  border: `1px solid ${active ? G : "#23232E"}`,
                  borderRadius: 6,
                  color: "#fff",
                  fontFamily: "inherit",
                  boxShadow: active ? `0 0 22px ${G}33` : "none",
                  transition: "transform 180ms ease, box-shadow 300ms ease, border-color 300ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    className="axen-display"
                    style={{
                      letterSpacing: 2,
                      fontWeight: 800,
                      fontSize: 10,
                      color: active ? "#fff" : "#7c8ea0",
                    }}
                  >
                    {p.title}
                  </div>
                  {p.save && (
                    <div
                      style={{
                        background: G,
                        color: "#000",
                        fontSize: 8,
                        fontWeight: 900,
                        padding: "2px 6px",
                        letterSpacing: 1,
                        borderRadius: 2,
                      }}
                    >
                      {p.save}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 22,
                    fontWeight: 900,
                    color: active ? G : "#eaf7ff",
                    textShadow: active ? `0 0 14px ${G}66` : "none",
                  }}
                >
                  {p.price}
                  <span style={{ fontSize: 11, color: "#6f8296", fontWeight: 600 }}>{p.per}</span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 9,
                    color: "#6f8296",
                    letterSpacing: 0.5,
                    lineHeight: 1.4,
                  }}
                >
                  {p.note}
                </div>
              </button>
            );
          })}
        </div>

        {/* checkout / cta */}
        <div
          style={{
            position: "relative",
            marginTop: "auto",
            animation: "axen-float-up 700ms ease 320ms both",
          }}
        >
          {ready && userId ? (
            <PlatformCheckout userId={userId} cycle={cycle} email={email} />
          ) : ready ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="axen-btn axen-btn-primary"
              style={{
                width: "100%",
                padding: "16px 20px",
                background: `linear-gradient(90deg, ${G}, ${G2})`,
                color: "#04070f",
                fontWeight: 900,
                letterSpacing: 3,
                fontSize: 12,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                boxShadow: `0 0 28px ${G}55`,
              }}
            >
              UNLOCK PRO ACCESS →
            </button>
          ) : (
            <div
              style={{
                width: "100%",
                padding: "16px 20px",
                textAlign: "center",
                background: "rgba(0, 212, 255, 0.08)",
                border: `1px solid ${G}33`,
                borderRadius: 4,
                color: G,
                fontSize: 11,
                letterSpacing: 3,
              }}
            >
              INITIALIZING…
            </div>
          )}

          <p
            style={{
              marginTop: 10,
              fontSize: 9,
              color: "#46586a",
              letterSpacing: 1,
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            Cancel anytime · Subscription required
          </p>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironmentSafe } from "@/lib/stripe";


const G = "#00d4ff";
const G2 = "#a855f7";

export const Route = createFileRoute("/_authenticated/checkout/success")({
  head: () => ({
    meta: [
      { title: "Welcome to DWT PRO" },
      { name: "description", content: "Your DWT PRO trial is now active. The full system is unlocked." },
      { property: "og:title", content: "Welcome to DWT PRO" },
      { property: "og:description", content: "Your DWT PRO trial is now active." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", u.user.id)
        .eq("environment", (getStripeEnvironmentSafe() ?? "sandbox"))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setReady(true);
        // Auto-navigate a moment after the celebration animation.
        setTimeout(() => { if (!cancelled) navigate({ to: "/dashboard" }); }, 2200);
        return;
      }
      tries++;
      if (tries < 20) setTimeout(check, 1500);
      else setReady(true);
    };
    check();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace",
      backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{
          fontSize: 72, marginBottom: 10, filter: `drop-shadow(0 0 24px ${G})`,
          animation: "fadeUp 0.6s ease-out",
        }}>◉</div>
        <div style={{ letterSpacing: 4, fontSize: 11, color: G, marginBottom: 8 }}>◈ ACCESS GRANTED</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: `0 0 20px ${G}`, margin: "6px 0 14px" }}>
          DWT PRO
        </h1>
        <p style={{ fontSize: 13, color: "#bbb", letterSpacing: 1, lineHeight: 1.6, margin: "0 auto 6px", maxWidth: 380 }}>
          Your <span style={{ color: G, fontWeight: 900 }}>3-day free trial</span> is active. The full system is unlocked — meditation, wake protocol, victories, the legend library, and your PRO badge.
        </p>
        <p style={{ fontSize: 10, color: "#666", letterSpacing: 1, margin: "10px 0 24px" }}>
          Cancel anytime before the trial ends. No charge until then.
        </p>

        <Link
          to="/dashboard"
          style={{
            display: "inline-block", padding: "16px 28px",
            background: ready ? G : "#333",
            color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 13,
            textDecoration: "none", borderRadius: 2,
            boxShadow: ready ? `0 0 28px ${G}77` : "none",
            pointerEvents: ready ? "auto" : "none",
          }}
        >
          {ready ? "ENTER THE SYSTEM →" : "◌ ACTIVATING…"}
        </Link>

        <div style={{ marginTop: 18, fontSize: 9, color: "#555", letterSpacing: 2 }}>
          The world sleeps. You rise.
        </div>
      </div>
    </div>
  );
}

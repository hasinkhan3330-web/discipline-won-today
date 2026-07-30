import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DWT — Discipline Won Today" },
      { name: "description", content: "Ultra-futuristic discipline tracker. Sign in to start your streak, missions, and cosmic meditation." },
      { property: "og:title", content: "DWT — Discipline Won Today" },
      { property: "og:description", content: "Ultra-futuristic discipline tracker. Sign in to start your streak, missions, and cosmic meditation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        const stored = typeof window !== "undefined" ? sessionStorage.getItem("dwt.post_auth_next") : null;
        if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
          sessionStorage.removeItem("dwt.post_auth_next");
          window.location.href = stored;
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else setChecking(false);
    });
    return () => { mounted = false; };
  }, [navigate]);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 44, fontWeight: 900, letterSpacing: 6, margin: 0, color: "#fff", textShadow: `0 0 30px ${G}` }}>DWT</h1>
        <p style={{ letterSpacing: 4, fontSize: 11, color: G, marginTop: 8 }}>DISCIPLINE WON TODAY</p>
        <p style={{ marginTop: 32, fontSize: 15, lineHeight: 1.7, color: "#bbb" }}>
          The ultra-futuristic discipline tracker. Wake at 4AM. Solve a math challenge to prove it. Meditate with WHO 4-4-4-4 box breathing. Rise through 9 victory milestones from Day 1 to Day 360.
        </p>
        <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6, color: "#888" }}>
          Every day: a rotating quote from a legend of history. Every mission: coins. Every miss: penalty. Real discipline, tracked.
        </p>
        {!checking && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
            <Link to="/auth" style={{ padding: "14px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, textDecoration: "none", borderRadius: 2, boxShadow: `0 0 30px ${G}88` }}>
              START 3-DAY FREE TRIAL
            </Link>
            <Link to="/pricing" style={{ padding: "12px 20px", background: "transparent", color: G, border: `1px solid ${G}55`, fontWeight: 700, letterSpacing: 3, fontSize: 11, textDecoration: "none", borderRadius: 2 }}>
              SEE PRICING
            </Link>
          </div>
        )}

        <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "left" }}>
          <Feature title="4AM PROTOCOL" body="Alarm + math verification. Prove you're awake." />
          <Feature title="COSMIC ZEN" body="WHO 4-4-4-4 breathing. 5–20 min sessions." />
          <Feature title="LEGENDS" body="Daily quote rotation from history's giants." />
        </div>

        <footer style={{ marginTop: 60, fontSize: 10, color: "#555", letterSpacing: 2 }}>
          <div>DWT · A PRODUCT OF NX AI</div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 16 }}>
            <Link to="/pricing" style={{ color: "#888", textDecoration: "none" }}>PRICING</Link>
            <Link to="/privacy" style={{ color: "#888", textDecoration: "none" }}>PRIVACY</Link>
            <Link to="/terms" style={{ color: "#888", textDecoration: "none" }}>TERMS</Link>
            <Link to="/refund" style={{ color: "#888", textDecoration: "none" }}>REFUND</Link>
          </div>
          <div style={{ marginTop: 12, fontSize: 9, color: "#444" }}>Payments processed securely by Stripe</div>
        </footer>
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: 12, background: "#0a0a0a", border: "1px solid #00d4ff22", borderRadius: 4 }}>
      <div style={{ color: "#00d4ff", fontSize: 9, letterSpacing: 2, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#999", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}


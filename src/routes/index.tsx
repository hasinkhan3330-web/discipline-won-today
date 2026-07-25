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
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    return () => { mounted = false; };
  }, [navigate]);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 44, fontWeight: 900, letterSpacing: 6, margin: 0, color: "#fff", textShadow: `0 0 30px ${G}` }}>DWT</h1>
        <p style={{ letterSpacing: 4, fontSize: 11, color: G, marginTop: 8 }}>DISCIPLINE WON TODAY</p>
        <p style={{ marginTop: 32, fontSize: 14, lineHeight: 1.6, color: "#aaa" }}>
          The ultra-futuristic discipline tracker. Wake at 4AM. Meditate. Rise.
        </p>
        {!checking && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
            <Link to="/auth" style={{ padding: "14px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, textDecoration: "none", borderRadius: 2, boxShadow: `0 0 30px ${G}88` }}>
              SIGN IN — START YOUR STREAK
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

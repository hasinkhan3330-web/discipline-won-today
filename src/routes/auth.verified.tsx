import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/verified")({
  head: () => ({
    meta: [
      { title: "Email verified — DWT" },
      { name: "description", content: "Your DWT account email is verified. Sign in to begin." },
      { property: "og:title", content: "Email verified — DWT" },
      { property: "og:description", content: "Your DWT account email is verified. Sign in to begin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifiedPage,
});

function VerifiedPage() {
  const navigate = useNavigate();
  const [count, setCount] = useState(4);

  useEffect(() => {
    // Ensure the user lands on the login screen even if the verify link
    // auto-signed them in. Clear the session, then redirect.
    supabase.auth.signOut().catch(() => {});
  }, []);

  useEffect(() => {
    if (count <= 0) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, navigate]);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ width: 96, height: 96, margin: "0 auto", borderRadius: "50%", border: `2px solid ${G}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${G}77, inset 0 0 30px ${G}33`, fontSize: 48, color: G }}>
          ✓
        </div>
        <h1 style={{ marginTop: 24, fontSize: 26, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: `0 0 20px ${G}` }}>
          EMAIL VERIFIED
        </h1>
        <p style={{ marginTop: 10, fontSize: 11, letterSpacing: 3, color: G }}>
          IDENTITY CONFIRMED
        </p>
        <p style={{ marginTop: 20, fontSize: 13, lineHeight: 1.6, color: "#c8c8d8" }}>
          Your account is active. Sign in to begin your discipline protocol.
        </p>

        <button
          onClick={() => navigate({ to: "/auth", replace: true })}
          style={{ marginTop: 28, width: "100%", padding: "14px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: "pointer", borderRadius: 2, boxShadow: `0 0 20px ${G}66`, fontFamily: "monospace" }}
        >
          GO TO SIGN IN
        </button>

        <p style={{ marginTop: 16, fontSize: 10, letterSpacing: 2, color: "#666" }}>
          REDIRECTING IN {count}s
        </p>
      </div>
    </div>
  );
}

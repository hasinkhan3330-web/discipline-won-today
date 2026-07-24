import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — DWT" },
      { name: "description", content: "Set a new password for your DWT account." },
      { property: "og:title", content: "Reset password — DWT" },
      { property: "og:description", content: "Set a new password for your DWT account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

const passSchema = z.string().min(6, "Password must be at least 6 characters").max(72);

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  useEffect(() => {
    // Supabase handles the recovery link automatically and fires PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setTimeout(() => setReady(r => r || (setInvalid(true), false)), 1500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const parsed = passSchema.safeParse(pw);
    if (!parsed.success) { setErr(parsed.error.issues[0].message); return; }
    if (pw !== pw2) { setErr("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth", replace: true }), 2500);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "rgba(10,10,25,0.7)",
    border: `1px solid ${G}55`, color: "#fff", fontFamily: "monospace",
    fontSize: 14, borderRadius: 2, outline: "none", letterSpacing: 1,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: 5, textAlign: "center", color: "#fff", textShadow: `0 0 20px ${G}` }}>DWT</h1>
        <p style={{ textAlign: "center", letterSpacing: 3, fontSize: 10, color: G, marginTop: 4 }}>
          {done ? "PASSWORD UPDATED" : "SET NEW PASSWORD"}
        </p>

        {done ? (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ width: 88, height: 88, margin: "0 auto", borderRadius: "50%", border: `2px solid ${G}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${G}77, inset 0 0 30px ${G}33`, fontSize: 42, color: G }}>✓</div>
            <p style={{ marginTop: 18, fontSize: 13, color: "#c8c8d8" }}>Redirecting to sign in...</p>
          </div>
        ) : invalid && !ready ? (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "#ff9a9a" }}>
              This reset link is invalid or expired.
            </p>
            <button onClick={() => navigate({ to: "/auth/forgot", replace: true })}
              style={{ marginTop: 20, width: "100%", padding: "14px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: "pointer", borderRadius: 2, fontFamily: "monospace" }}>
              REQUEST A NEW LINK
            </button>
          </div>
        ) : !ready ? (
          <p style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "#888", letterSpacing: 2 }}>VERIFYING LINK...</p>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={input} type="password" placeholder="NEW PASSWORD" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
            <input style={input} type="password" placeholder="CONFIRM PASSWORD" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
            {err && (
              <div style={{ fontSize: 11, letterSpacing: 1, padding: "10px 12px", borderRadius: 2, background: "#3a0f0f", border: `1px solid #ff4d4d55`, color: "#ff9a9a" }}>{err}</div>
            )}
            <button type="submit" disabled={loading} style={{ padding: "14px 20px", background: loading ? "#333" : G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 2, boxShadow: `0 0 20px ${G}66` }}>
              {loading ? "UPDATING..." : "UPDATE PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({
    meta: [
      { title: "Forgot password — AXEN Habit & Discipline" },
      { name: "description", content: "Reset your AXEN account password with a secure email link." },
      { property: "og:title", content: "Forgot password — AXEN Habit & Discipline" },
      { property: "og:description", content: "Reset your AXEN account password with a secure email link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

function ForgotPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setErr(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes("rate") || m.includes("too many")) throw new Error("Too many attempts. Wait a minute and try again.");
        throw error;
      }
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not send reset email.");
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
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: 5, textAlign: "center", color: "#fff", textShadow: `0 0 20px ${G}` }}>AXEN</h1>
        <p style={{ textAlign: "center", letterSpacing: 3, fontSize: 10, color: G, marginTop: 4 }}>
          {sent ? "TRANSMISSION SENT" : "RECOVER ACCESS"}
        </p>

        {sent ? (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ width: 88, height: 88, margin: "0 auto", borderRadius: "50%", border: `2px solid ${G}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${G}77, inset 0 0 30px ${G}33`, fontSize: 42, color: G }}>✓</div>
            <h2 style={{ marginTop: 20, fontSize: 18, fontWeight: 900, letterSpacing: 3, color: "#fff" }}>CHECK YOUR INBOX</h2>
            <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "#c8c8d8" }}>
              A reset link was sent to <span style={{ color: G }}>{email}</span>. Open it to set a new password. Also check spam.
            </p>
            <button onClick={() => navigate({ to: "/", replace: true })}
              style={{ marginTop: 24, width: "100%", padding: "14px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: "pointer", borderRadius: 2, boxShadow: `0 0 20px ${G}66`, fontFamily: "monospace" }}>
              BACK TO SIGN IN
            </button>
            <button onClick={() => { setSent(false); setErr(null); }}
              style={{ marginTop: 12, width: "100%", background: "transparent", border: "none", color: "#888", fontSize: 11, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace" }}>
              USE A DIFFERENT EMAIL
            </button>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 20, fontSize: 12, lineHeight: 1.6, color: "#a8a8b8", textAlign: "center" }}>
              Enter the email you signed up with. We'll send a secure link to reset your password.
            </p>
            <form onSubmit={submit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={input} type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              {err && (
                <div style={{ fontSize: 11, letterSpacing: 1, padding: "10px 12px", borderRadius: 2, background: "#3a0f0f", border: `1px solid #ff4d4d55`, color: "#ff9a9a" }}>{err}</div>
              )}
              <button type="submit" disabled={loading} style={{ padding: "14px 20px", background: loading ? "#333" : G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 2, boxShadow: `0 0 20px ${G}66` }}>
                {loading ? "SENDING..." : "SEND RESET LINK"}
              </button>
            </form>
            <button onClick={() => navigate({ to: "/", replace: true })}
              style={{ marginTop: 20, width: "100%", background: "transparent", border: "none", color: "#888", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>
              ← BACK TO SIGN IN
            </button>
          </>
        )}
      </div>
    </div>
  );
}

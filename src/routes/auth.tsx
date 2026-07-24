import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DWT" },
      { name: "description", content: "Sign in or create an account to start tracking discipline on DWT." },
      { property: "og:title", content: "Sign in — DWT" },
      { property: "og:description", content: "Sign in or create an account to start tracking discipline on DWT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);

  const resendVerification = async () => {
    const parsed = schema.safeParse({ email, password: password || "placeholder" });
    if (!parsed.success && !z.string().email().safeParse(email.trim()).success) {
      setMsg({ kind: "err", text: "Enter your email above first." });
      return;
    }
    setResending(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/_authenticated/dashboard` },
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Verification email sent. Check your inbox (and spam)." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Could not resend email." });
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/_authenticated/dashboard", replace: true });
    });
  }, [navigate]);

  const G = "#00d4ff";
  const G2 = "#a855f7";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setMsg({ kind: "err", text: parsed.error.issues[0].message });
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/_authenticated/dashboard` },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) {
            const { error: sErr } = await supabase.auth.signInWithPassword({
              email: parsed.data.email,
              password: parsed.data.password,
            });
            if (sErr) throw new Error("This email is already registered. Wrong password?");
            navigate({ to: "/_authenticated/dashboard", replace: true });
            return;
          }
          throw error;
        }
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          navigate({ to: "/_authenticated/dashboard", replace: true });
        } else {
          const { error: sErr } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });
          if (sErr) { setMsg({ kind: "ok", text: "Account created. You can now sign in." }); setMode("signin"); }
          else navigate({ to: "/_authenticated/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          const m = error.message.toLowerCase();
          if (m.includes("email not confirmed") || m.includes("not confirmed")) {
            setNeedsVerify(true);
            throw new Error("Email not verified yet. Check your inbox for the confirmation link, or resend it below.");
          }
          if (m.includes("invalid email") || m.includes("email address")) {
            throw new Error("That email address looks invalid. Double-check the spelling.");
          }
          if (m.includes("rate") || m.includes("too many")) {
            throw new Error("Too many attempts. Wait a minute and try again.");
          }
          if (m.includes("invalid login") || m.includes("invalid credentials")) {
            // Distinguish missing account vs wrong password by attempting a signup probe
            const probe = await supabase.auth.signUp({
              email: parsed.data.email,
              password: "__probe__" + Math.random().toString(36).slice(2, 10) + "Aa1!",
            });
            const pm = probe.error?.message?.toLowerCase() || "";
            if (probe.error && (pm.includes("registered") || pm.includes("exists") || pm.includes("already"))) {
              throw new Error("Wrong password for this email. Try again or reset your password.");
            }
            throw new Error("No account found for this email. Tap 'CREATE AN ACCOUNT' below to sign up.");
          }
          throw new Error(error.message);
        }
        navigate({ to: "/_authenticated/dashboard", replace: true });
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
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
      <div style={{ maxWidth: 400, width: "100%" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 5, textAlign: "center", color: "#fff", textShadow: `0 0 20px ${G}` }}>DWT</h1>
        <p style={{ textAlign: "center", letterSpacing: 3, fontSize: 10, color: G, marginTop: 4 }}>
          {mode === "signin" ? "ENTER THE SYSTEM" : "INITIATE PROTOCOL"}
        </p>

        <form onSubmit={submit} style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={input} type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <input style={input} type="password" placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          {msg && (
            <div style={{ fontSize: 11, letterSpacing: 1, padding: "10px 12px", borderRadius: 2, background: msg.kind === "err" ? "#3a0f0f" : "#0f3a1a", border: `1px solid ${msg.kind === "err" ? "#ff4d4d" : "#3ddc84"}55`, color: msg.kind === "err" ? "#ff9a9a" : "#9affbf" }}>
              {msg.text}
            </div>
          )}
          <button type="submit" disabled={loading} style={{ padding: "14px 20px", background: loading ? "#333" : G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 2, boxShadow: `0 0 20px ${G}66` }}>
            {loading ? "..." : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
          {needsVerify && mode === "signin" && (
            <button type="button" onClick={resendVerification} disabled={resending} style={{ padding: "12px 16px", background: "transparent", color: G, border: `1px solid ${G}66`, fontFamily: "monospace", fontWeight: 700, letterSpacing: 2, fontSize: 11, cursor: resending ? "wait" : "pointer", borderRadius: 2 }}>
              {resending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
            </button>
          )}
        </form>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
          style={{ marginTop: 20, width: "100%", background: "transparent", border: "none", color: "#888", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}
        >
          {mode === "signin" ? "NEW HERE? CREATE AN ACCOUNT →" : "← BACK TO SIGN IN"}
        </button>
      </div>
    </div>
  );
}

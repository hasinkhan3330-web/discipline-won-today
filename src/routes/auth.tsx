import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},

  head: () => ({
    meta: [
      { title: "Sign in — AXEN" },
      { name: "description", content: "Sign in or create an account to start tracking discipline on AXEN." },
      { property: "og:title", content: "Sign in — AXEN" },
      { property: "og:description", content: "Sign in or create an account to start tracking discipline on AXEN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeNext(v: string | undefined): string | null {
  if (!v) return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}
const NEXT_KEY = "dwt.post_auth_next";

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const { next: nextParam } = Route.useSearch();
  const next = safeNext(nextParam);

  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard", replace: true });
  };

  const signInWithGoogle = async () => {
    setMsg(null);
    setGoogleLoading(true);
    try {
      if (next) sessionStorage.setItem(NEXT_KEY, next);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      goNext();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Google sign-in failed" });
    } finally {
      setGoogleLoading(false);
    }
  };

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
        options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
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
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) {
            const { error: sErr } = await supabase.auth.signInWithPassword({
              email: parsed.data.email,
              password: parsed.data.password,
            });
            if (sErr) throw new Error("This email is already registered. Wrong password?");
            goNext();
            return;
          }
          throw error;
        }
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          goNext();
        } else {
          const { error: sErr } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });
          if (sErr) { setMsg({ kind: "ok", text: "Account created. You can now sign in." }); setMode("signin"); }
          else goNext();
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
            const { error: createErr } = await supabase.auth.signUp({
              email: parsed.data.email,
              password: parsed.data.password,
              options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
            });
            if (!createErr) {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData.session) {
                goNext();
                return;
              }
              setMsg({ kind: "ok", text: "Account created. Check your inbox once, then sign in here." });
              setMode("signin");
              return;
            }
            if (/registered|exists|already/i.test(createErr.message)) {
              throw new Error("This email already has an account. Use the correct password, tap FORGOT PASSWORD, or continue with Google.");
            }
            throw new Error(createErr.message || "Could not create account. Try Google sign-in.");
          }
          throw new Error(error.message);
        }
        goNext();
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
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 5, textAlign: "center", color: "#fff", textShadow: `0 0 20px ${G}` }}>AXEN</h1>
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

        {mode === "signin" && (
          <button
            onClick={() => navigate({ to: "/auth/forgot" })}
            style={{ marginTop: 14, width: "100%", background: "transparent", border: "none", color: G, fontFamily: "monospace", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}
          >
            FORGOT PASSWORD?
          </button>
        )}

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: `${G}33` }} />
          <span style={{ fontSize: 10, letterSpacing: 2, color: "#666" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: `${G}33` }} />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googleLoading}
          style={{ marginTop: 12, width: "100%", padding: "12px 16px", background: "#fff", color: "#000", fontFamily: "monospace", fontWeight: 700, letterSpacing: 2, fontSize: 12, border: "none", borderRadius: 2, cursor: googleLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 0 20px ${G}44` }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.1 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z"/>
          </svg>
          {googleLoading ? "OPENING GOOGLE..." : "CONTINUE WITH GOOGLE"}
        </button>


        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
          style={{ marginTop: 8, width: "100%", background: "transparent", border: "none", color: "#888", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}
        >
          {mode === "signin" ? "NEW HERE? CREATE AN ACCOUNT →" : "← BACK TO SIGN IN"}
        </button>
      </div>
    </div>
  );
}

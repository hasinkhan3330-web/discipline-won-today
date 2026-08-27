import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PaymentOptions } from "@/components/PaymentOptions";
import { PRICING, STRIPE_DISPLAY, type Cycle } from "@/lib/pricing";
import axenLogo from "@/assets/axen-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AXEN Habit & Discipline — Start Your 3-Day Free Trial" },
      { name: "description", content: "Sign in and unlock AXEN Habit & Discipline. ₹99/month or ₹999/year (₹83/mo). International $2.99/mo or $29.99/yr. 3-day free trial." },
      { property: "og:title", content: "AXEN Habit & Discipline — Start Your 3-Day Free Trial" },
      { property: "og:description", content: "Sign in and unlock AXEN. ₹99/month or ₹999/year. International $2.99/mo or $29.99/yr. 3-day free trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN Habit & Discipline — Start Your 3-Day Free Trial" },
      { name: "twitter:description", content: "Sign in and unlock AXEN. 3-day free trial, cancel anytime." },
    ],
  }),
  component: Landing,
});

const G = "#00d4ff";
const G2 = "#a855f7";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const PLAN_COPY: Record<Cycle, { title: string; price: string; per: string; note: string; intl: string; save?: string }> = {
  monthly: {
    title: "MONTHLY",
    price: "₹99",
    per: "/month",
    note: "Billed ₹99/mo after your 3-day free trial",
    intl: STRIPE_DISPLAY.monthly,
  },
  yearly: {
    title: "YEARLY",
    price: "₹83",
    per: "/month",
    note: "₹999/yr total · Billed ₹999/yr after your 3-day free trial",
    intl: STRIPE_DISPLAY.yearly,
    save: "SAVE 16%",
  },
};

function Landing() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true);
        setSessionEmail(data.session.user.email ?? null);
      }
    });
  }, []);

  const signInWithGoogle = async () => {
    setMsg(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      setAuthed(true);
      setCheckout(true);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Google sign-in failed" });
    } finally {
      setGoogleLoading(false);
    }
  };

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
        if (error) throw error;
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setAuthed(true);
          setSessionEmail(parsed.data.email);
          setCheckout(true);
        } else {
          setMsg({ kind: "ok", text: "Check your inbox to verify your email, then sign in." });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          const m = error.message.toLowerCase();
          if (m.includes("not confirmed")) throw new Error("Email not verified yet. Check your inbox for the confirmation link.");
          if (m.includes("invalid login") || m.includes("invalid credentials")) throw new Error("Wrong email or password. Try again, or continue with Google.");
          throw error;
        }
        setAuthed(true);
        setSessionEmail(parsed.data.email);
        setCheckout(true);
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  const startTrial = () => {
    if (authed) setCheckout(true);
    else document.getElementById("axen-auth")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "rgba(10,10,25,0.7)",
    border: `1px solid ${G}55`, color: "#fff", fontFamily: "monospace",
    fontSize: 14, borderRadius: 2, outline: "none", letterSpacing: 1,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", backgroundImage: `radial-gradient(circle at 20% 15%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 85%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "36px 20px 60px" }}>
        {/* AXEN animation */}
        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 260, height: 260, marginLeft: -130, marginTop: -130, borderRadius: "50%", border: `1px solid ${G}2e`, animation: "axen-ring 14s linear infinite" }} />
          <img
            src={axenLogo}
            alt="AXEN Habit & Discipline"
            style={{ position: "relative", width: "100%", maxWidth: 240, margin: "0 auto", display: "block", animation: "axen-enter 1100ms cubic-bezier(0.16,1,0.3,1) both, axen-glow 3s ease-in-out 1100ms infinite" }}
          />
          <h1 style={{ position: "relative", marginTop: 10, fontSize: 16, fontWeight: 900, letterSpacing: 5, color: "#fff", textShadow: `0 0 20px ${G}` }}>AXEN HABIT &amp; DISCIPLINE</h1>
          <p style={{ position: "relative", marginTop: 6, letterSpacing: 3, fontSize: 10, color: G }}>3 DAYS FREE · CANCEL ANYTIME</p>
        </div>

        {/* Plans */}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {(["yearly", "monthly"] as const).map((c) => {
            const p = PLAN_COPY[c];
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                style={{
                  textAlign: "left", padding: 16, cursor: "pointer",
                  background: active ? `linear-gradient(135deg, ${G}22, ${G2}22)` : "rgba(10,10,25,0.7)",
                  border: `2px solid ${active ? G : "#333"}`, borderRadius: 4,
                  color: "#fff", fontFamily: "monospace",
                  boxShadow: active ? `0 0 20px ${G}55` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 13 }}>{p.title}</div>
                  {p.save && <div style={{ background: G, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", letterSpacing: 2, borderRadius: 2 }}>{p.save}</div>}
                </div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: G }}>
                  {p.price}<span style={{ fontSize: 12, color: "#888" }}>{p.per}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888", letterSpacing: 1 }}>{p.note}</div>
                <div style={{ marginTop: 4, fontSize: 10, color: "#666", letterSpacing: 1 }}>International: {p.intl}</div>
              </button>
            );
          })}
        </div>

        {!checkout && (
          <button
            type="button"
            onClick={startTrial}
            style={{ marginTop: 18, width: "100%", padding: "16px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, border: "none", borderRadius: 2, cursor: "pointer", boxShadow: `0 0 26px ${G}77` }}
          >
            START 3-DAY FREE TRIAL
          </button>
        )}

        {/* Checkout or auth */}
        {checkout ? (
          <>
            <PaymentOptions cycle={cycle} email={sessionEmail} />
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              style={{ marginTop: 16, width: "100%", background: "transparent", border: `1px solid ${G}44`, color: G, fontFamily: "monospace", fontSize: 11, letterSpacing: 2, padding: "12px 16px", borderRadius: 2, cursor: "pointer" }}
            >
              GO TO DASHBOARD →
            </button>
          </>
        ) : (
          <div id="axen-auth" style={{ marginTop: 26 }}>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading}
              style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#1f1f1f", border: "none", borderRadius: 2, fontFamily: "monospace", fontWeight: 900, letterSpacing: 2, fontSize: 12, cursor: googleLoading ? "wait" : "pointer" }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.7 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.1 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              {googleLoading ? "OPENING GOOGLE..." : "CONTINUE WITH GOOGLE"}
            </button>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: `${G}33` }} />
              <span style={{ fontSize: 10, letterSpacing: 2, color: "#666" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: `${G}33` }} />
            </div>

            <form onSubmit={submit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={input} type="email" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <input style={input} type="password" placeholder="PASSWORD" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {msg && (
                <div style={{ fontSize: 11, letterSpacing: 1, padding: "10px 12px", borderRadius: 2, background: msg.kind === "err" ? "#3a0f0f" : "#0f3a1a", border: `1px solid ${msg.kind === "err" ? "#ff4d4d" : "#3ddc84"}55`, color: msg.kind === "err" ? "#ff9a9a" : "#9affbf" }}>
                  {msg.text}
                </div>
              )}
              <button type="submit" disabled={loading} style={{ padding: "14px 20px", background: loading ? "#333" : "transparent", color: loading ? "#888" : G, fontWeight: 900, letterSpacing: 3, fontSize: 12, border: `1px solid ${G}66`, cursor: loading ? "wait" : "pointer", borderRadius: 2, fontFamily: "monospace" }}>
                {loading ? "..." : mode === "signin" ? "SIGN IN & CONTINUE" : "CREATE ACCOUNT & CONTINUE"}
              </button>
            </form>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }} style={{ background: "transparent", border: "none", color: "#888", fontFamily: "monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer" }}>
                {mode === "signin" ? "NEW? CREATE ACCOUNT" : "← BACK TO SIGN IN"}
              </button>
              <button onClick={() => navigate({ to: "/auth/forgot" })} style={{ background: "transparent", border: "none", color: G, fontFamily: "monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer" }}>
                FORGOT PASSWORD?
              </button>
            </div>
          </div>
        )}

        <p style={{ marginTop: 22, fontSize: 9, color: "#555", letterSpacing: 1, textAlign: "center", lineHeight: 1.8 }}>
          Razorpay (UPI · cards · netbanking) for INR · Stripe for international cards.
          <br />Inside the Android app, Google Play Billing is used.
        </p>
      </div>
    </div>
  );
}

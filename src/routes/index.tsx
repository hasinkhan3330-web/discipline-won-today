import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PlatformCheckout } from "@/components/PlatformCheckout";
import { INTL_DISPLAY, type Cycle } from "@/lib/pricing";
import axenLogo from "@/assets/axen-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AXEN Habit & Discipline — Sign In & Start Free Trial" },
      { name: "description", content: "Enter AXEN Habit & Discipline. Sign in with Google or email, then unlock PRO — ₹99/month or ₹999/year, charged in INR worldwide, 3-day free trial." },
      { property: "og:title", content: "AXEN Habit & Discipline — Sign In & Start Free Trial" },
      { property: "og:description", content: "Sign in to AXEN and unlock PRO. ₹99/mo or ₹999/yr, charged in INR. 3-day free trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN Habit & Discipline — Sign In & Start Free Trial" },
      { name: "twitter:description", content: "Sign in to AXEN and unlock PRO. 3-day free trial, cancel anytime." },
    ],
  }),
  component: Landing,
});

const G = "#00d4ff";
const G2 = "#a855f7";
const INTRO_MS = 5000;

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
    intl: INTL_DISPLAY.monthly,
  },
  yearly: {
    title: "YEARLY",
    price: "₹83",
    per: "/month",
    note: "₹999/yr total · Billed ₹999/yr after your 3-day free trial",
    intl: INTL_DISPLAY.yearly,
    save: "SAVE 16%",
  },
};

/** 5-second cinematic AXEN boot sequence. */
function Intro({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden={done}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", pointerEvents: done ? "none" : "auto",
        animation: done ? "axen-boot-out 700ms ease forwards" : undefined,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 50% 45%, ${G}22, transparent 55%), radial-gradient(circle at 80% 90%, ${G2}22, transparent 55%)`, animation: "axen-nebula 4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.22, backgroundImage: `linear-gradient(${G}33 1px, transparent 1px), linear-gradient(90deg, ${G}33 1px, transparent 1px)`, backgroundSize: "60px 60px", animation: "axen-grid-move 6s linear infinite", maskImage: "radial-gradient(circle at 50% 50%, #000 10%, transparent 72%)", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 10%, transparent 72%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)`, animation: "axen-scan 2.5s linear infinite" }} />

      <div style={{ position: "relative", textAlign: "center", width: "100%", maxWidth: 360, padding: "0 24px" }}>
        {[300, 220].map((s, i) => (
          <div key={s} style={{ position: "absolute", left: "50%", top: "50%", width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2, borderRadius: "50%", border: `1px solid ${i ? G2 : G}44`, borderTopColor: i ? G2 : G, animation: `axen-orbit ${i ? 5 : 8}s linear infinite ${i ? "reverse" : ""}` }} />
        ))}
        <img
          src={axenLogo}
          alt="AXEN Habit & Discipline"
          style={{ position: "relative", width: "100%", maxWidth: 220, display: "block", margin: "0 auto", animation: "axen-boot-in 1400ms cubic-bezier(0.16,1,0.3,1) both, axen-glow 2.6s ease-in-out 1400ms infinite" }}
        />
        <div className="axen-display" style={{ position: "relative", marginTop: 18, fontSize: 15, fontWeight: 800, letterSpacing: 9, color: "#fff", textShadow: `0 0 18px ${G}, 0 0 46px ${G}66`, animation: "axen-float-up 800ms ease 900ms both, axen-flicker 2.2s linear 1700ms infinite" }}>
          A X E N
        </div>
        <div className="axen-display" style={{ position: "relative", marginTop: 8, fontSize: 9, fontWeight: 700, letterSpacing: 5, color: G, animation: "axen-float-up 800ms ease 1400ms both" }}>
          HABIT &amp; DISCIPLINE
        </div>
        <div style={{ position: "relative", marginTop: 26, height: 2, background: "#0e1a26", overflow: "hidden", borderRadius: 2 }}>
          <div style={{ height: "100%", background: `linear-gradient(90deg, ${G}, ${G2})`, boxShadow: `0 0 14px ${G}`, animation: `axen-bar ${INTRO_MS - 600}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
        </div>
        <div style={{ position: "relative", marginTop: 10, fontFamily: "monospace", fontSize: 8, letterSpacing: 4, color: "#4d6478" }}>
          INITIALIZING DISCIPLINE CORE…
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [intro, setIntro] = useState(true);
  const [introGone, setIntroGone] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIntro(false), INTRO_MS);
    const t2 = setTimeout(() => setIntroGone(true), INTRO_MS + 750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      if (!session) return;
      setAuthed(true);
      setSessionEmail(session.user.email ?? null);
      setSessionUserId(session.user.id);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setMsg(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      setAuthed(true);
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
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="axen-page" style={{ minHeight: "100vh", position: "relative", background: "#000", color: "#e8e8e8", overflow: "hidden" }}>
      {!introGone && <Intro done={!intro} />}

      {/* ambient futuristic backdrop */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(circle at 18% 12%, ${G2}22, transparent 52%), radial-gradient(circle at 84% 88%, ${G}22, transparent 52%)` }} />
      <div style={{ position: "fixed", inset: 0, opacity: 0.14, backgroundImage: `linear-gradient(${G}22 1px, transparent 1px), linear-gradient(90deg, ${G}22 1px, transparent 1px)`, backgroundSize: "60px 60px", animation: "axen-grid-move 10s linear infinite", maskImage: "radial-gradient(circle at 50% 30%, #000 5%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle at 50% 30%, #000 5%, transparent 70%)" }} />

      <div style={{ position: "relative", maxWidth: 430, margin: "0 auto", padding: "44px 20px 56px" }}>
        {/* Header mark */}
        <div style={{ position: "relative", textAlign: "center", animation: "axen-float-up 700ms ease both" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 240, height: 240, marginLeft: -120, marginTop: -120, borderRadius: "50%", border: `1px solid ${G}22`, borderTopColor: `${G}88`, animation: "axen-orbit 16s linear infinite" }} />
          <img src={axenLogo} alt="AXEN Habit & Discipline" style={{ position: "relative", width: "100%", maxWidth: 190, margin: "0 auto", display: "block", animation: "axen-glow 3.4s ease-in-out infinite" }} />
          <h1 className="axen-display" style={{ position: "relative", marginTop: 12, fontSize: 14, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: `0 0 22px ${G}, 0 0 60px ${G}55` }}>AXEN HABIT &amp; DISCIPLINE</h1>
          <p className="axen-display" style={{ position: "relative", marginTop: 6, letterSpacing: 5, fontSize: 9, fontWeight: 700, color: G, textShadow: `0 0 14px ${G}88` }}>ACCESS TERMINAL · 3 DAYS FREE</p>
        </div>

        {authed ? (
          <div style={{ marginTop: 30, animation: "axen-float-up 600ms ease both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["yearly", "monthly"] as const).map((c) => {
                const p = PLAN_COPY[c];
                const active = cycle === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    className="axen-btn"
                    style={{
                      textAlign: "left", padding: 16, cursor: "pointer",
                      background: active ? `linear-gradient(135deg, ${G}22, ${G2}22)` : "rgba(8,12,26,0.72)",
                      border: `1px solid ${active ? G : "#22303f"}`, borderRadius: 4,
                      color: "#fff", fontFamily: "inherit",
                      boxShadow: active ? `0 0 26px ${G}44` : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="axen-display" style={{ letterSpacing: 3, fontWeight: 800, fontSize: 12 }}>{p.title}</div>
                      {p.save && <div style={{ background: G, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", letterSpacing: 2, borderRadius: 2 }}>{p.save}</div>}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: G }}>
                      {p.price}<span style={{ fontSize: 12, color: "#6f8296" }}>{p.per}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "#7c8ea0", letterSpacing: 1 }}>{p.note}</div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "#556879", letterSpacing: 1 }}>International cards: {p.intl}</div>
                  </button>
                );
              })}
            </div>

            <PlatformCheckout cycle={cycle} email={sessionEmail} userId={sessionUserId} />

            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="axen-btn"
              style={{ marginTop: 16, width: "100%", background: "transparent", border: `1px solid ${G}44`, color: G, fontSize: 11, fontWeight: 700, letterSpacing: 3, padding: "13px 16px", borderRadius: 2, cursor: "pointer" }}
            >
              ENTER DASHBOARD →
            </button>
          </div>
        ) : (
          <div id="axen-auth" style={{ position: "relative", marginTop: 30, padding: 20, borderRadius: 6, overflow: "hidden", background: "linear-gradient(160deg, rgba(10,16,32,0.92), rgba(4,6,14,0.92))", border: `1px solid ${G}33`, boxShadow: `0 0 40px ${G}18, inset 0 0 60px rgba(0,212,255,0.05)`, animation: "axen-float-up 700ms ease 120ms both" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 120, background: `linear-gradient(90deg, transparent, ${G}0e, transparent)`, animation: "axen-sweep 6s linear infinite" }} />

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 9, letterSpacing: 4, color: "#5c7286" }}>{mode === "signin" ? "SECURE SIGN IN" : "CREATE IDENTITY"}</span>
              <span style={{ fontSize: 8, letterSpacing: 3, color: G, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: G, boxShadow: `0 0 10px ${G}`, display: "inline-block", animation: "axen-flicker 2s linear infinite" }} />
                ONLINE
              </span>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading}
              className="axen-btn axen-btn-google"
              style={{ width: "100%", padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#1f1f1f", border: "none", borderRadius: 3, fontWeight: 800, letterSpacing: 2, fontSize: 11, cursor: googleLoading ? "wait" : "pointer", boxShadow: `0 0 24px ${G}33` }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.7 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.1 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              {googleLoading ? "OPENING GOOGLE..." : "CONTINUE WITH GOOGLE"}
            </button>

            <div style={{ position: "relative", marginTop: 18, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${G}44)` }} />
              <span style={{ fontSize: 9, letterSpacing: 3, color: "#4d6478" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${G}44, transparent)` }} />
            </div>

            <form onSubmit={submit} style={{ position: "relative", marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <input className="axen-field" type="email" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <input className="axen-field" type="password" placeholder="PASSWORD" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {msg && (
                <div style={{ fontSize: 11, letterSpacing: 1, padding: "10px 12px", borderRadius: 2, background: msg.kind === "err" ? "#2a0b0f" : "#08301a", border: `1px solid ${msg.kind === "err" ? "#ff4d4d" : "#3ddc84"}55`, color: msg.kind === "err" ? "#ff9a9a" : "#9affbf" }}>
                  {msg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="axen-btn axen-btn-primary"
                style={{ padding: "15px 20px", background: loading ? "#16202c" : `linear-gradient(90deg, ${G}, ${G2})`, color: loading ? "#6f8296" : "#04070f", fontWeight: 800, letterSpacing: 3, fontSize: 11, border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 3, boxShadow: loading ? "none" : `0 0 28px ${G}55` }}
              >
                {loading ? "AUTHENTICATING…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
              </button>
            </form>

            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }} className="axen-link" style={{ background: "transparent", border: "none", color: "#7c8ea0", fontFamily: "inherit", fontWeight: 600, fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>
                {mode === "signin" ? "NEW? CREATE ACCOUNT" : "← BACK TO SIGN IN"}
              </button>
              <button onClick={() => navigate({ to: "/auth/forgot" })} className="axen-link" style={{ background: "transparent", border: "none", color: G, fontFamily: "inherit", fontWeight: 600, fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>
                FORGOT PASSWORD?
              </button>
            </div>
          </div>
        )}

        <p style={{ position: "relative", marginTop: 22, fontSize: 9, color: "#46586a", letterSpacing: 1, textAlign: "center", lineHeight: 1.9 }}>
          ₹99/month · ₹999/year · all payments charged in INR
          <br />Razorpay (UPI · cards · netbanking · international cards) on web · Google Play / App Store billing in the apps.
        </p>
      </div>
    </div>
  );
}

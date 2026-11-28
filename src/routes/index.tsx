import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PlatformCheckout } from "@/components/PlatformCheckout";
import { PricingSelector } from "@/components/PricingSelector";
import { PreSignupQuiz, type QuizAnswers } from "@/components/PreSignupQuiz";
import { saveQuizLocal, skipQuizLocal, quizSeen, flushQuizToProfile } from "@/lib/quiz";
import { type Cycle } from "@/lib/pricing";
import axenLogoAsset from "@/assets/axen-logo.png.asset.json";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AXEN — Habit & Discipline App with 4AM Wake Alarms & AI Coach" },
      { name: "description", content: "AXEN builds discipline: 4AM wake alarms you must solve, an AI coach that plans your day, Deep Focus app lock and accountability partners. 3-day free PRO trial." },
      { property: "og:title", content: "AXEN — Habit & Discipline App with 4AM Wake Alarms & AI Coach" },
      { property: "og:description", content: "AXEN builds discipline: 4AM wake alarms you must solve, an AI coach that plans your day, Deep Focus app lock and accountability partners. 3-day free PRO trial." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://axonhabit.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN — Habit & Discipline App with 4AM Wake Alarms & AI Coach" },
      { name: "twitter:description", content: "AXEN builds discipline: 4AM wake alarms you must solve, an AI coach that plans your day, Deep Focus app lock and accountability partners. 3-day free PRO trial." },
    ],
    links: [{ rel: "canonical", href: "https://axonhabit.app/" }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({"@context":"https://schema.org","@type":"SoftwareApplication","name":"AXEN Habit & Discipline","applicationCategory":"LifestyleApplication","operatingSystem":"Android, Web","url":"https://axonhabit.app/","publisher":{"@type":"Organization","name":"Aevonix","url":"https://aevonix.pro"},"offers":[{"@type":"Offer","name":"PRO Monthly","price":"99","priceCurrency":"INR"},{"@type":"Offer","name":"PRO Yearly","price":"499","priceCurrency":"INR"}]}) }],
  }),
  component: HomeGate,
});

const G = "#00d4ff";
const LIME = "#c6ff3d";
const GOLD = "#f5c542";
const G2 = "#a855f7";
const INTRO_FADE_MS = 650;
const INTRO_FADE_AT_MS = 3_900;
const INTRO_MAX_MS = 4_600;

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

/** 5-second cinematic AXEN boot sequence. */
function Intro({ done, onGone }: { done: boolean; onGone: () => void }) {
  return (
    <div
      aria-hidden={done}
      onAnimationEnd={(e) => { if (done && e.animationName === "axen-boot-out") onGone(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", pointerEvents: done ? "none" : "auto",
        animation: done ? `axen-boot-out ${INTRO_FADE_MS}ms ease forwards` : `axen-boot-force-out ${INTRO_MAX_MS}ms linear forwards`,
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
          src={axenLogoAsset.url}
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
          <div style={{ height: "100%", background: `linear-gradient(90deg, ${G}, ${G2})`, boxShadow: `0 0 14px ${G}`, animation: `axen-bar ${INTRO_FADE_AT_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
        </div>
        <div style={{ position: "relative", marginTop: 10, fontFamily: "monospace", fontSize: 8, letterSpacing: 4, color: "#4d6478" }}>
          INITIALIZING DISCIPLINE CORE…
        </div>
      </div>
    </div>
  );
}

/** Decides what a visitor sees at "/": landing page only for confirmed signed-out web visitors.
 * Native app launches, Google sign-in returns and pending invites go straight to the existing sign-in screen. */
function HomeGate() {
  const [view, setView] = useState<"checking" | "landing" | "auth">("checking");
  const [skipIntro, setSkipIntro] = useState(false);

  useEffect(() => {
    let alive = true;
    const decide = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) { if (alive) setView("auth"); return; }
      } catch { /* web */ }
      const url = window.location.search + window.location.hash;
      if (/[?&#](code|access_token|refresh_token|error|error_description|state)=/.test(url)) { if (alive) setView("auth"); return; }
      try { if (localStorage.getItem("axen.acct.join")) { if (alive) setView("auth"); return; } } catch { /* storage off */ }
      try {
        const { data } = await supabase.auth.getSession();
        if (alive) setView(data.session ? "auth" : "landing");
      } catch {
        if (alive) setView("auth");
      }
    };
    void decide();
    return () => { alive = false; };
  }, []);

  if (view === "checking") return <div className="axen-page" style={{ minHeight: "100vh", background: "#000" }} aria-busy="true" />;
  if (view === "landing") {
    const open = () => { setSkipIntro(true); setView("auth"); window.scrollTo(0, 0); };
    return <LandingPage onSignIn={open} onGetStarted={open} />;
  }
  return <Landing skipIntro={skipIntro} />;
}

function Landing({ skipIntro = false }: { skipIntro?: boolean }) {
  const navigate = useNavigate();
  const [intro, setIntro] = useState(!skipIntro);
  const [introGone, setIntroGone] = useState(skipIntro);
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
  const [quizDone, setQuizDone] = useState(true); // assume done until localStorage is read (SSR-safe)

  useEffect(() => {
    const t1 = window.setTimeout(() => setIntro(false), INTRO_FADE_AT_MS);
    const t2 = window.setTimeout(() => setIntroGone(true), INTRO_MAX_MS);
    setQuizDone(quizSeen());
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const finishQuiz = (a: QuizAnswers) => {
    saveQuizLocal(a);
    setQuizDone(true);
  };

  useEffect(() => {
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      if (!session) return;
      setAuthed(true);
      setSessionEmail(session.user.email ?? null);
      setSessionUserId(session.user.id);
      setQuizDone(true);
      void flushQuizToProfile(session.user.id);
      let pending: string | null = null; // invite opened via /join before signing in: return there to confirm
      try { const j = JSON.parse(localStorage.getItem("axen.acct.join") ?? "null"); if (j && typeof j.code === "string" && j.code && Date.now() - Number(j.at) < 86_400_000) pending = j.code; else localStorage.removeItem("axen.acct.join"); } catch { /* storage off */ }
      if (pending) void navigate({ to: "/join/$code", params: { code: pending }, replace: true });
      else void navigate({ to: "/dashboard", replace: true });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session)).catch(error => {
      console.error("AXEN session initialization failed", error instanceof Error ? error.message : "Unknown session error");
    });
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
    <div className="axen-page ax-shell" style={{ position: "relative", background: "#000", color: "#e8e8e8", overflowX: "clip" }}>
      {!introGone && <Intro done={!intro} onGone={() => setIntroGone(true)} />}
      {introGone && !authed && !quizDone && (
        <PreSignupQuiz onFinish={finishQuiz} onSkip={() => { skipQuizLocal(); setQuizDone(true); }} />
      )}

      {/* ambient futuristic backdrop */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(circle at 18% 12%, ${G2}2a, transparent 52%), radial-gradient(circle at 84% 88%, ${G}1c, transparent 52%), radial-gradient(circle at 50% 0%, ${LIME}12, transparent 45%)` }} />
      <div style={{ position: "fixed", inset: 0, opacity: 0.14, backgroundImage: `linear-gradient(${G}22 1px, transparent 1px), linear-gradient(90deg, ${G}22 1px, transparent 1px)`, backgroundSize: "60px 60px", animation: "axen-grid-move 10s linear infinite", maskImage: "radial-gradient(circle at 50% 30%, #000 5%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle at 50% 30%, #000 5%, transparent 70%)" }} />

      {/* The page mark only mounts after the boot logo is fully gone, so the two
          logos can never overlap and ghost each other during the fade. */}
      <div style={{ position: "relative", width: "100%", maxWidth: 430, margin: "0 auto", padding: "44px 20px calc(56px + env(safe-area-inset-bottom, 0px))", visibility: introGone ? "visible" : "hidden" }}>
        {/* Header mark */}
        <div style={{ position: "relative", textAlign: "center", animation: "axen-float-up 700ms ease both" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 240, height: 240, marginLeft: -120, marginTop: -120, borderRadius: "50%", border: `1px solid ${G}22`, borderTopColor: `${G}88`, animation: "axen-orbit 16s linear infinite" }} />
          <img src={axenLogoAsset.url} alt="AXEN Habit & Discipline" style={{ position: "relative", width: "100%", maxWidth: 190, margin: "0 auto", display: "block", animation: "axen-glow 3.4s ease-in-out infinite" }} />
          <h1 className="axen-display ax-wrap" style={{ position: "relative", marginTop: 12, fontSize: "clamp(11px, 3.4vw, 14px)", fontWeight: 900, letterSpacing: "clamp(3px, 1.4vw, 6px)", color: "#fff", textShadow: `0 0 22px ${G}, 0 0 60px ${G}55` }}>AXEN HABIT &amp; DISCIPLINE</h1>
          <p className="axen-display" style={{ position: "relative", marginTop: 6, letterSpacing: 5, fontSize: 9, fontWeight: 700, color: LIME, textShadow: `0 0 14px ${LIME}88` }}>SECURE ACCESS TERMINAL</p>
        </div>

        {authed ? (
          <div style={{ marginTop: 30, animation: "axen-float-up 600ms ease both" }}>
            <PricingSelector cycle={cycle} onChange={setCycle} />

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
          <div id="axen-auth" style={{ position: "relative", marginTop: 30, padding: 20, borderRadius: 16, overflow: "hidden", background: "linear-gradient(160deg, rgba(16,14,30,0.94), rgba(5,6,12,0.95))", border: `1px solid ${LIME}33`, boxShadow: `0 0 44px ${G2}22, inset 0 0 60px rgba(198,255,61,0.04)`, animation: "axen-float-up 700ms ease 120ms both" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${LIME}, transparent)` }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 120, background: `linear-gradient(90deg, transparent, ${G}0e, transparent)`, animation: "axen-sweep 6s linear infinite" }} />

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 9, letterSpacing: 4, color: "#5c7286" }}>{mode === "signin" ? "SECURE SIGN IN" : "CREATE IDENTITY"}</span>
              <span style={{ fontSize: 8, letterSpacing: 3, color: LIME, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIME, boxShadow: `0 0 10px ${LIME}`, display: "inline-block", animation: "axen-flicker 2s linear infinite" }} />
                ONLINE
              </span>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading}
              className="axen-btn axen-btn-google"
              style={{ width: "100%", minHeight: 48, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#131314", color: "#E3E3E3", border: "1px solid #8E918F", borderRadius: 12, fontFamily: "'Google Sans', Roboto, Arial, sans-serif", fontWeight: 500, fontSize: 14, lineHeight: "20px", cursor: googleLoading ? "wait" : "pointer" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              {googleLoading ? "Opening Google…" : "Continue with Google"}
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
                style={{ padding: "15px 20px", background: loading ? "#16202c" : LIME, color: loading ? "#6f8296" : "#04070f", fontWeight: 800, letterSpacing: 3, fontSize: 11, border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 12, boxShadow: loading ? "none" : `0 0 28px ${LIME}55` }}
              >
                {loading ? "AUTHENTICATING…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
              </button>
            </form>

            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }} className="axen-link" style={{ background: "transparent", border: "none", color: "#7c8ea0", fontFamily: "inherit", fontWeight: 600, fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>
                {mode === "signin" ? "NEW? CREATE ACCOUNT" : "← BACK TO SIGN IN"}
              </button>
              <button onClick={() => navigate({ to: "/auth/forgot" })} className="axen-link" style={{ background: "transparent", border: "none", color: GOLD, fontFamily: "inherit", fontWeight: 600, fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>
                FORGOT PASSWORD?
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

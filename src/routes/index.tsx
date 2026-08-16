import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import axenLogo from "@/assets/axen-logo.png";
import habitLogo from "@/assets/habit-discipline-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AXEN Habit & Discipline" },
      { name: "description", content: "AXEN Habit & Discipline — the ultra-futuristic discipline tracker by NEXT AI." },
      { property: "og:title", content: "AXEN Habit & Discipline" },
      { property: "og:description", content: "AXEN Habit & Discipline — the ultra-futuristic discipline tracker by NEXT AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN Habit & Discipline" },
      { name: "twitter:description", content: "AXEN Habit & Discipline — the ultra-futuristic discipline tracker by NEXT AI." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);
  const done = useRef(false);

  const go = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    setExiting(true);
    const { data } = await supabase.auth.getSession();
    let target = "/auth";
    if (data.session) {
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("dwt.post_auth_next") : null;
      if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        sessionStorage.removeItem("dwt.post_auth_next");
        window.location.href = stored;
        return;
      }
      target = "/dashboard";
    }
    setTimeout(() => navigate({ to: target, replace: true }), 420);
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(go, 2900);
    return () => clearTimeout(t);
  }, [go]);

  return (
    <div
      onClick={go}
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "scale(1.06)" : "scale(1)",
        transition: "opacity 420ms ease, transform 420ms ease",
      }}
    >
      {/* ambient nebula */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 50% 42%, rgba(0,212,255,0.16), transparent 55%), radial-gradient(circle at 50% 80%, rgba(168,85,247,0.14), transparent 60%)", animation: "axen-nebula 6s ease-in-out infinite" }} />
      {/* orbital ring */}
      <div style={{ position: "absolute", width: 520, height: 520, maxWidth: "120vw", maxHeight: "120vw", borderRadius: "50%", border: "1px solid rgba(0,212,255,0.18)", animation: "axen-ring 14s linear infinite" }} />
      <div style={{ position: "absolute", width: 340, height: 340, maxWidth: "88vw", maxHeight: "88vw", borderRadius: "50%", border: "1px solid rgba(168,85,247,0.16)", animation: "axen-ring 9s linear infinite reverse" }} />
      {/* scan sweep */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent, rgba(0,212,255,0.07), transparent)", height: "38%", animation: "scan-sweep 3.6s ease-in-out infinite" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 460, padding: 24, textAlign: "center" }}>
        <img
          src={axenLogo}
          alt="AXEN"
          style={{ width: "100%", maxWidth: 300, display: "block", margin: "0 auto", animation: "axen-enter 1200ms cubic-bezier(0.16,1,0.3,1) both, axen-glow 3s ease-in-out 1200ms infinite" }}
        />
        <img
          src={habitLogo}
          alt="Habit & Discipline"
          style={{ width: "100%", maxWidth: 260, display: "block", margin: "10px auto 0", animation: "axen-enter 1200ms cubic-bezier(0.16,1,0.3,1) 380ms both, axen-glow 3s ease-in-out 1600ms infinite" }}
        />
        <div style={{ margin: "26px auto 0", width: 120, height: 1, background: "linear-gradient(90deg, transparent, #00d4ff, transparent)", animation: "axen-line 1800ms ease-out 900ms both" }} />
      </div>
    </div>
  );
}

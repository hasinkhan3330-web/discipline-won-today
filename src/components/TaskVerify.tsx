import { useEffect, useState } from "react";
import { AX } from "@/tabs/styles";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { getCoords, distanceM, type Coords } from "@/lib/geo";
import { CodeScanner } from "@/components/CodeScanner";
import { Dumbbell, Droplets, BookOpen, Home, MapPin, QrCode, Timer, X, Check, type LucideIcon } from "lucide-react";

export type VerifyKind = "gym" | "shower" | "focus";

const MODE_KEY = "axen_workout_mode";
const HOME_TIMER_S = 15 * 60;
const FOCUS_TIMER_S = 25 * 60;

const META: Record<VerifyKind, { title: string; Icon: LucideIcon; hint: string }> = {
  gym: { title: "Verify your workout", Icon: Dumbbell, hint: "Prove you showed up — gym GPS check or a gym-tag scan." },
  shower: { title: "Verify your cold shower", Icon: Droplets, hint: "Scan your bathroom QR / barcode to prove you physically moved there." },
  focus: { title: "Verify deep focus", Icon: BookOpen, hint: "Scan your book, laptop screen or desk tag, then hold a strict focus timer." },
};

const btn = (primary?: boolean): React.CSSProperties => ({
  minHeight: 46, padding: "0 16px", borderRadius: 12, cursor: "pointer",
  fontFamily: AX.font, fontSize: 14, fontWeight: 600,
  background: primary ? AX.accent : "transparent",
  border: `1px solid ${primary ? AX.accent : AX.border}`,
  color: primary ? "#FFFFFF" : AX.text,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
});

const tile = (active: boolean): React.CSSProperties => ({
  flex: 1, minWidth: 0, padding: "16px 12px", borderRadius: 14, cursor: "pointer",
  background: active ? "#1D1D28" : "#181820",
  border: `1px solid ${active ? AX.accent : AX.border}`,
  color: active ? AX.text : AX.muted,
  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
  fontFamily: AX.font, fontSize: 13, fontWeight: 600,
});

type Step = "pick" | "scan" | "timer";

/**
 * Unified anti-cheat verification sheet for Gym, Cold Shower and Deep Focus.
 * Gym: Supabase-saved geofence OR gym-tag scan. Shower: scan. Focus: scan + strict timer.
 */
export function TaskVerify({ kind, startInScan = false, onVerified, onClose }: {
  kind: VerifyKind;
  startInScan?: boolean;
  onVerified: () => void;
  onClose: () => void;
}) {
  const { title, Icon, hint } = META[kind];
  const [mode, setMode] = useState<"gym" | "home" | null>(kind === "gym" ? null : "home");
  const [step, setStep] = useState<Step>(startInScan ? "scan" : "pick");
  const [gym, setGym] = useState<Coords | null>(null);
  const [radius, setRadius] = useState(150);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [left, setLeft] = useState(kind === "focus" ? FOCUS_TIMER_S : HOME_TIMER_S);
  const [running, setRunning] = useState(false);

  // load saved gym spot from Supabase (falls back silently)
  useEffect(() => {
    if (kind !== "gym") return;
    let alive = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase
          .from("profiles")
          .select("gym_lat, gym_lng, gym_radius_m")
          .eq("id", u.user.id)
          .maybeSingle();
        if (!alive || !data) return;
        if (data.gym_lat != null && data.gym_lng != null) setGym({ lat: data.gym_lat, lng: data.gym_lng });
        if (data.gym_radius_m) setRadius(data.gym_radius_m);
      } catch { /* offline — user can re-save */ }
    })();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "gym" || saved === "home") setMode(saved);
    }
    return () => { alive = false; };
  }, [kind]);

  const pickMode = (m: "gym" | "home") => {
    haptic("tap");
    setMode(m); setStatus(""); setStep("pick");
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, m);
  };

  const saveGymHere = async () => {
    setBusy(true); setStatus("Reading your location… this can take a few seconds.");
    const res = await getCoords();
    if (!res.ok) {
      setBusy(false);
      setStatus(
        res.reason === "denied" ? "Location permission is blocked. Enable it, or use the gym-tag scan instead."
          : res.reason === "unsupported" ? "Location is not available on this device — use the gym-tag scan instead."
          : "Could not get a location fix. Move near a window or use the gym-tag scan instead.",
      );
      return;
    }
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("profiles")
          .update({ gym_lat: res.coords.lat, gym_lng: res.coords.lng, gym_radius_m: radius })
          .eq("id", u.user.id);
      }
      setGym(res.coords);
      setStatus("Gym location saved.");
      toast.success("Gym location saved");
    } catch {
      setStatus("Saved locally, but syncing failed. Try again when you're online.");
    } finally { setBusy(false); }
  };

  const verifyGym = async () => {
    if (!gym) return;
    setBusy(true); setStatus("Checking you are at the gym…");
    const res = await getCoords();
    setBusy(false);
    if (!res.ok) {
      setStatus(
        res.reason === "denied" ? "Location permission is blocked — use the gym-tag scan instead."
          : "No location fix yet. Try again in a moment, or use the gym-tag scan.",
      );
      return;
    }
    const d = distanceM(gym, res.coords);
    if (d > radius) {
      setStatus(`You are ${Math.round(d)} m from your gym. Get within ${radius} m to log this workout.`);
      toast.error("Not at your gym yet");
      return;
    }
    haptic("success");
    toast.success(`Verified at your gym (${Math.round(d)} m)`);
    onVerified();
  };

  const onScanned = () => {
    if (kind === "focus") {
      toast.success("Workspace verified — hold the focus timer");
      setLeft(FOCUS_TIMER_S);
      setStep("timer");
      setRunning(true);
      return;
    }
    toast.success("Code verified — task logged");
    onVerified();
  };

  // timer proof
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft(s => {
        if (s <= 1) {
          window.clearInterval(id);
          setRunning(false);
          haptic("success");
          toast.success("Timer complete — task logged");
          onVerified();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, onVerified]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,5,9,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: AX.surface, border: `1px solid ${AX.border}`, borderRadius: 16, padding: 18, fontFamily: AX.font }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Icon size={18} strokeWidth={1.8} color={AX.accent} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: AX.text }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: AX.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {step === "pick" && (
          <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5, marginBottom: 12 }}>{hint}</div>
        )}

        {kind === "gym" && step === "pick" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div onClick={() => pickMode("home")} style={tile(mode === "home")}>
              <Home size={20} strokeWidth={1.8} />Home Workout
            </div>
            <div onClick={() => pickMode("gym")} style={tile(mode === "gym")}>
              <MapPin size={20} strokeWidth={1.8} />Gym Workout
            </div>
          </div>
        )}

        {step === "pick" && kind === "gym" && mode === "gym" && (
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={saveGymHere} disabled={busy} style={btn(!gym)}>
              <MapPin size={16} />{gym ? "Update gym location" : "Save this spot as my gym"}
            </button>
            {gym && (
              <button onClick={verifyGym} disabled={busy} style={btn(true)}>
                <Check size={16} />Verify I'm at the gym
              </button>
            )}
            <button onClick={() => setStep("scan")} style={btn()}><QrCode size={16} />Scan gym tag instead</button>
          </div>
        )}

        {step === "pick" && kind === "gym" && mode === "home" && (
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => setStep("scan")} style={btn(true)}><QrCode size={16} />Scan QR / barcode</button>
            <button onClick={() => { setLeft(HOME_TIMER_S); setStep("timer"); }} style={btn()}>
              <Timer size={16} />Use 15-minute timer proof
            </button>
          </div>
        )}

        {step === "pick" && kind !== "gym" && (
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => setStep("scan")} style={btn(true)}><QrCode size={16} />Open scanner</button>
          </div>
        )}

        {step === "scan" && (
          <div style={{ display: "grid", gap: 10 }}>
            <CodeScanner onDetected={onScanned} onError={m => setStatus(m)} />
            <button onClick={() => setStep("pick")} style={btn()}>Cancel scan</button>
          </div>
        )}

        {step === "timer" && (
          <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 600, color: running ? AX.accent : AX.text, letterSpacing: 1 }}>{fmt(left)}</div>
            <div style={{ fontSize: 12, color: AX.muted, textAlign: "center", lineHeight: 1.5 }}>
              Keep the app open. The task logs itself when the timer reaches zero.
            </div>
            <button onClick={() => setRunning(r => !r)} style={btn(!running)}>
              <Timer size={16} />{running ? "Pause" : "Start timer"}
            </button>
            <button onClick={() => { setRunning(false); setStep("pick"); }} style={btn()}>Back</button>
          </div>
        )}

        {!!status && <div style={{ marginTop: 12, fontSize: 12, color: AX.muted, lineHeight: 1.5 }}>{status}</div>}
      </div>
    </div>
  );
}

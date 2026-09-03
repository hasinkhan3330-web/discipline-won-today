import { useEffect, useRef, useState } from "react";
import { AX } from "@/tabs/styles";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { Dumbbell, Home, MapPin, QrCode, Timer, X, Check } from "lucide-react";

export type WorkoutMode = "gym" | "home";

const MODE_KEY = "axen_workout_mode";
const GYM_KEY = "axen_gym_coords";
const RADIUS_M = 150;
const TIMER_SECONDS = 15 * 60;

type Gym = { lat: number; lng: number };

function readGym(): Gym | null {
  if (typeof window === "undefined") return null;
  try { const r = localStorage.getItem(GYM_KEY); return r ? (JSON.parse(r) as Gym) : null; } catch { return null; }
}

/** Haversine distance in metres. */
function distanceM(a: Gym, b: Gym) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return rej(new Error("Location is not available on this device"));
    navigator.geolocation.getCurrentPosition(res, e => rej(new Error(e.message || "Location permission denied")), {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
    });
  });
}

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

/** Workout verification: GPS geofence for gym, QR scan or timer proof for home. */
export function WorkoutVerify({ onVerified, onClose }: { onVerified: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<WorkoutMode | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  // home proof
  const [proof, setProof] = useState<"pick" | "scan" | "timer">("pick");
  const [left, setLeft] = useState(TIMER_SECONDS);
  const [running, setRunning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setGym(readGym());
    const saved = localStorage.getItem(MODE_KEY) as WorkoutMode | null;
    if (saved === "gym" || saved === "home") setMode(saved);
  }, []);

  const pickMode = (m: WorkoutMode) => {
    haptic("tap");
    setMode(m);
    setStatus("");
    setProof("pick");
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, m);
  };

  const saveGymHere = async () => {
    setBusy(true); setStatus("Reading your location…");
    try {
      const p = await getPosition();
      const g = { lat: p.coords.latitude, lng: p.coords.longitude };
      localStorage.setItem(GYM_KEY, JSON.stringify(g));
      setGym(g);
      setStatus("Gym location saved.");
      toast.success("Gym location saved");
    } catch (e: any) {
      setStatus(e?.message || "Could not read your location");
      toast.error("Location failed", { description: e?.message });
    } finally { setBusy(false); }
  };

  const verifyGym = async () => {
    if (!gym) return;
    setBusy(true); setStatus("Checking you are at the gym…");
    try {
      const p = await getPosition();
      const d = distanceM(gym, { lat: p.coords.latitude, lng: p.coords.longitude });
      if (d > RADIUS_M) {
        setStatus(`You are ${Math.round(d)} m from your gym. Get within ${RADIUS_M} m to log this workout.`);
        toast.error("Not at your gym yet");
        return;
      }
      haptic("success");
      toast.success(`Verified at your gym (${Math.round(d)} m)`);
      onVerified();
    } catch (e: any) {
      setStatus(e?.message || "Could not verify your location");
    } finally { setBusy(false); }
  };

  // ---- home: QR / barcode scan ----
  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []);

  const startScan = async () => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setStatus("This device cannot scan codes — use the timer proof instead.");
      setProof("timer");
      return;
    }
    setProof("scan"); setStatus("Point the camera at your workout QR / barcode.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      const det = new Detector({ formats: ["qr_code", "code_128", "ean_13", "code_39"] });
      const loop = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await det.detect(v);
          if (codes && codes.length) {
            stopCamera();
            haptic("success");
            toast.success("Code verified — workout logged");
            onVerified();
            return;
          }
        } catch { /* frame not ready */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      stopCamera();
      setStatus(e?.message || "Camera unavailable — use the timer proof instead.");
      setProof("timer");
    }
  };

  // ---- home: timer proof ----
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft(s => {
        if (s <= 1) {
          window.clearInterval(id);
          setRunning(false);
          haptic("success");
          toast.success("Timer proof complete — workout logged");
          onVerified();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, onVerified]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const close = () => { stopCamera(); onClose(); };

  return (
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,5,9,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: AX.surface, border: `1px solid ${AX.border}`, borderRadius: 16, padding: 18, fontFamily: AX.font }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Dumbbell size={18} strokeWidth={1.8} color={AX.accent} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: AX.text }}>Verify your workout</div>
          <button onClick={close} aria-label="Close" style={{ background: "transparent", border: "none", color: AX.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div onClick={() => pickMode("home")} style={tile(mode === "home")}>
            <Home size={20} strokeWidth={1.8} />Home Workout
          </div>
          <div onClick={() => pickMode("gym")} style={tile(mode === "gym")}>
            <MapPin size={20} strokeWidth={1.8} />Gym Workout
          </div>
        </div>

        {mode === "gym" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5 }}>
              {gym
                ? `Your gym is saved. You must be within ${RADIUS_M} m to log this workout.`
                : "Save your gym location once while you are standing at the gym."}
            </div>
            <button onClick={saveGymHere} disabled={busy} style={btn(!gym)}>
              <MapPin size={16} />{gym ? "Update gym location" : "Save this spot as my gym"}
            </button>
            {gym && (
              <button onClick={verifyGym} disabled={busy} style={btn(true)}>
                <Check size={16} />Verify I'm at the gym
              </button>
            )}
          </div>
        )}

        {mode === "home" && proof === "pick" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5 }}>
              No location needed at home. Scan your workout QR / barcode, or run the in-app timer to the end.
            </div>
            <button onClick={startScan} style={btn(true)}><QrCode size={16} />Scan QR / barcode</button>
            <button onClick={() => { setLeft(TIMER_SECONDS); setProof("timer"); }} style={btn()}>
              <Timer size={16} />Use 15-minute timer proof
            </button>
          </div>
        )}

        {mode === "home" && proof === "scan" && (
          <div style={{ display: "grid", gap: 10 }}>
            <video ref={videoRef} muted playsInline style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "4 / 3", objectFit: "cover" }} />
            <button onClick={() => { stopCamera(); setProof("pick"); }} style={btn()}>Cancel scan</button>
          </div>
        )}

        {mode === "home" && proof === "timer" && (
          <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 600, color: running ? AX.accent : AX.text, letterSpacing: 1 }}>{fmt(left)}</div>
            <div style={{ fontSize: 12, color: AX.muted, textAlign: "center", lineHeight: 1.5 }}>
              Keep the app open. The workout logs itself when the timer reaches zero.
            </div>
            <button onClick={() => setRunning(r => !r)} style={btn(!running)}>
              <Timer size={16} />{running ? "Pause" : left === TIMER_SECONDS ? "Start workout timer" : "Resume"}
            </button>
            <button onClick={() => { setRunning(false); setLeft(TIMER_SECONDS); setProof("pick"); }} style={btn()}>Back</button>
          </div>
        )}

        {!!status && (
          <div style={{ marginTop: 12, fontSize: 12, color: AX.muted, lineHeight: 1.5 }}>{status}</div>
        )}
      </div>
    </div>
  );
}

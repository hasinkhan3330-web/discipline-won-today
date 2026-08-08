import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlayBillingButton } from "@/components/PlayBillingButton";
import { RazorpayPayButton } from "@/components/RazorpayPayButton";

import { isNativeBillingAvailable } from "@/lib/play-billing";
import { PRICING, type Cycle } from "@/lib/pricing";

const G = "#00d4ff";
const G2 = "#a855f7";

const PERKS = [
  "Full Wake Protocol (4AM–7AM tiers + custom ringtones)",
  "Zen Meditation (WHO 4-4-4-4 box breathing)",
  "Full Daily Quotes library + rotating legends",
  "All 9 Victory milestones (Day 1 → Day 360)",
  "PRO badge on the Leaderboard",
  "3 days free — cancel anytime",
];

export function Paywall({ userId }: { userId: string; email?: string | null }) {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [native, setNative] = useState(false);

  useEffect(() => {
    isNativeBillingAvailable().then(setNative).catch(() => setNative(false));
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };


  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: `0 0 20px ${G}` }}>DWT PRO</h1>
          <p style={{ letterSpacing: 3, fontSize: 10, color: G, marginTop: 4 }}>UNLOCK THE FULL SYSTEM</p>
          <p style={{ marginTop: 14, fontSize: 12, color: "#aaa", letterSpacing: 1 }}>
            Start with <span style={{ color: G, fontWeight: 900 }}>3 DAYS FREE</span>. Cancel anytime before you're charged.
          </p>
          <p style={{ marginTop: 6, fontSize: 9, color: "#666", letterSpacing: 2 }}>◈ SECURED BY GOOGLE PLAY BILLING</p>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {(["yearly", "monthly"] as const).map(c => {
            const active = cycle === c;
            const p = PRICING[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                style={{
                  textAlign: "left", padding: 16, cursor: "pointer",
                  background: active ? `linear-gradient(135deg, ${G}22, ${G2}22)` : "rgba(10,10,25,0.7)",
                  border: `2px solid ${active ? G : "#333"}`,
                  borderRadius: 4, color: "#fff", fontFamily: "monospace",
                  boxShadow: active ? `0 0 20px ${G}55` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 13 }}>{c.toUpperCase()}</div>
                  {p.save && <div style={{ background: G, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", letterSpacing: 2, borderRadius: 2 }}>{p.save}</div>}
                </div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 900, color: G }}>{p.display}</div>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888", letterSpacing: 1 }}>3 days free, then {p.sub.toLowerCase()}</div>
              </button>
            );
          })}
        </div>

        <ul style={{ marginTop: 24, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {PERKS.map((t, i) => (
            <li key={i} style={{ fontSize: 12, color: "#ccc", letterSpacing: 0.5, display: "flex", gap: 10 }}>
              <span style={{ color: G }}>▸</span>{t}
            </li>
          ))}
        </ul>

        {native ? (
          <PlayBillingButton userId={userId} cycle={cycle} />
        ) : (
          <RazorpayPayButton cycle={cycle} email={email} />
        )}


        <p style={{ marginTop: 12, fontSize: 10, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          {native
            ? "Billed securely through Google Play. Manage or cancel anytime in Play Store → Subscriptions."
            : "Billed securely through Razorpay (UPI, cards, netbanking). Inside the Android app, Google Play Billing is used."}
        </p>



        <button onClick={signOut} style={{ marginTop: 20, width: "100%", background: "transparent", border: "none", color: "#666", fontFamily: "monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer" }}>
          SIGN OUT
        </button>
      </div>
    </div>
  );
}


export function PaywallLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: G, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", letterSpacing: 4, fontSize: 12 }}>
      LOADING...
    </div>
  );
}

type SubRow = { status: string; current_period_end: string | null };

function isRowActive(s: SubRow): boolean {
  const end = s.current_period_end ? new Date(s.current_period_end) : null;
  const notExpired = !end || end > new Date();
  if (["active", "trialing", "past_due"].includes(s.status) && notExpired) return true;
  if (s.status === "canceled" && end && end > new Date()) return true;
  return false;
}

export function PaywallGate({ children }: { children: React.ReactNode }) {

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sub, setSub] = useState<{ status: string; current_period_end: string | null } | null>(null);

  const refresh = async (uid: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as { status: string; current_period_end: string | null }[];
    setSub(rows.find(isRowActive) ?? rows[0] ?? null);
  };



  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
        await refresh(data.user.id);
        // Inside the Android app, re-check Google Play on every launch so a
        // reinstall or a renewal unlocks PRO without any user action.
        if (await isNativeBillingAvailable().catch(() => false)) {
          try {
            const { initPlayBilling } = await import("@/lib/play-billing");
            const { syncPlayEntitlement } = await import("@/utils/play-billing.functions");
            await initPlayBilling(data.user.id);
            await syncPlayEntitlement({ data: {} } as never);
            await refresh(data.user.id);
          } catch { /* offline or not configured yet */ }
        }
      }

      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`gate_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` }, () => refresh(userId))
      .subscribe();
    const onFocus = () => refresh(userId);
    const onRefresh = () => refresh(userId);
    window.addEventListener("focus", onFocus);
    window.addEventListener("subscription:refresh", onRefresh);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("subscription:refresh", onRefresh);
    };
  }, [userId]);

  if (!ready) return <PaywallLoading />;
  if (!userId) return <PaywallLoading />;

  const active = !!sub && isRowActive(sub);


  if (!active) return <Paywall userId={userId} email={email} />;
  return <>{children}</>;
}

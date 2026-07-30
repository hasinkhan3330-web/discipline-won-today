import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { detectRegion, priceIdFor, REGION_PRICING, type Region } from "@/lib/region";


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

export function Paywall({ userId, email }: { userId: string; email?: string | null }) {
  void userId; void email;
  const [region, setRegion] = useState<Region>("ROW");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const [checkout, setCheckout] = useState<string | null>(null);

  useEffect(() => { detectRegion().then(setRegion); }, []);

  const pricing = REGION_PRICING[region];
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <PaymentTestModeBanner />
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: `0 0 20px ${G}` }}>DWT PRO</h1>
          <p style={{ letterSpacing: 3, fontSize: 10, color: G, marginTop: 4 }}>UNLOCK THE FULL SYSTEM</p>
          <p style={{ marginTop: 14, fontSize: 12, color: "#aaa", letterSpacing: 1 }}>
            Start with <span style={{ color: G, fontWeight: 900 }}>3 DAYS FREE</span>. Cancel anytime before you're charged.
          </p>
          <p style={{ marginTop: 6, fontSize: 9, color: "#666", letterSpacing: 2 }}>◈ REGION: {pricing.label}</p>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {(["yearly", "monthly"] as const).map(c => {
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => { setCycle(c); setCheckout(null); }}
                style={{
                  textAlign: "left", padding: 16, cursor: "pointer",
                  background: active ? `linear-gradient(135deg, ${G}22, ${G2}22)` : "rgba(10,10,25,0.7)",
                  border: `2px solid ${active ? G : "#333"}`,
                  borderRadius: 4, color: "#fff",
                  boxShadow: active ? `0 0 20px ${G}55` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 13 }}>{c.toUpperCase()}</div>
                  {c === "yearly" && <div style={{ background: G, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", letterSpacing: 2, borderRadius: 2 }}>{pricing.save}</div>}
                </div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 900, color: G }}>{c === "yearly" ? pricing.yearly : pricing.monthly}</div>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888", letterSpacing: 1 }}>3 days free, then billed {c}</div>
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

        {checkout ? (
          <StripeEmbeddedCheckout priceId={checkout} />
        ) : (
          <button
            onClick={() => setCheckout(priceIdFor(region, cycle))}
            style={{ marginTop: 20, width: "100%", padding: "16px 20px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 13, border: "none", borderRadius: 2, cursor: "pointer", boxShadow: `0 0 28px ${G}77` }}
          >
            START 3-DAY FREE TRIAL
          </button>
        )}

        <p style={{ marginTop: 12, fontSize: 10, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          Secure checkout. Taxes calculated for your region.
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
      .eq("environment", (getStripeEnvironmentSafe() ?? "sandbox"))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub(data as any);
  };


  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
        await refresh(data.user.id);
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
    // Refresh on tab focus (checkout modal closes elsewhere)
    const onFocus = () => refresh(userId);
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); };
  }, [userId]);

  if (!ready) return <PaywallLoading />;
  if (!userId) return <PaywallLoading />;

  const active = !!sub && (() => {
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const notExpired = !end || end > new Date();
    if (["active", "trialing", "past_due"].includes(sub.status) && notExpired) return true;
    if (sub.status === "canceled" && end && end > new Date()) return true;
    return false;
  })();

  if (!active) return <Paywall userId={userId} email={email} />;
  return <>{children}</>;
}

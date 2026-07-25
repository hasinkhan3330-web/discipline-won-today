import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const G = "#00d4ff";
const G2 = "#a855f7";

type Plan = { id: string; label: string; price: string; sub: string; tag?: string };

// Displayed prices are illustrative — Paddle shows the actual localized price at checkout.
const PLANS: Plan[] = [
  { id: "dwt_pro_yearly",  label: "YEARLY",  price: "$24.99 / yr",  sub: "US $29.99 · IN ₹999",  tag: "SAVE 47%" },
  { id: "dwt_pro_monthly", label: "MONTHLY", price: "$3.99 / mo",   sub: "US $4.99 · IN ₹49" },
];

const PERKS = [
  "Full Wake Protocol (4AM–7AM tiers + custom ringtones)",
  "Zen Meditation (WHO 4-4-4-4 box breathing)",
  "Full Daily Quotes library + rotating legends",
  "All 9 Victory milestones (Day 1 → Day 360)",
  "PRO badge on the Leaderboard",
  "3 days free — cancel anytime",
];

export function Paywall({ userId, email }: { userId: string; email?: string | null }) {
  const { openCheckout, loading } = usePaddleCheckout();
  const [selected, setSelected] = useState<string>("dwt_pro_yearly");
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => { await supabase.auth.signOut(); };

  const start = async () => {
    setError(null);
    try {
      await openCheckout({ priceId: selected, userId, customerEmail: email || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    }
  };

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
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {PLANS.map(p => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                style={{
                  textAlign: "left", padding: 16, cursor: "pointer",
                  background: active ? `linear-gradient(135deg, ${G}22, ${G2}22)` : "rgba(10,10,25,0.7)",
                  border: `2px solid ${active ? G : "#333"}`,
                  borderRadius: 4, color: "#fff",
                  boxShadow: active ? `0 0 20px ${G}55` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 13 }}>{p.label}</div>
                  {p.tag && <div style={{ background: G, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", letterSpacing: 2, borderRadius: 2 }}>{p.tag}</div>}
                </div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 900, color: G }}>{p.price}</div>
                <div style={{ marginTop: 4, fontSize: 10, color: "#888", letterSpacing: 1 }}>{p.sub}</div>
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

        {error && (
          <div style={{ marginTop: 16, fontSize: 11, padding: "10px 12px", borderRadius: 2, background: "#3a0f0f", border: "1px solid #ff4d4d55", color: "#ff9a9a" }}>{error}</div>
        )}

        <button
          onClick={start}
          disabled={loading}
          style={{ marginTop: 20, width: "100%", padding: "16px 20px", background: loading ? "#333" : G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 13, border: "none", borderRadius: 2, cursor: loading ? "wait" : "pointer", boxShadow: `0 0 28px ${G}77` }}
        >
          {loading ? "OPENING CHECKOUT..." : "START 3-DAY FREE TRIAL"}
        </button>

        <p style={{ marginTop: 12, fontSize: 10, color: "#666", letterSpacing: 1, textAlign: "center" }}>
          Payments handled by Paddle. Taxes calculated by your region.
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

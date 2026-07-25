import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { openCustomerPortal } from "@/utils/payments.functions";

// Sitewide banner: shows the orange TEST MODE strip in preview builds,
// and a red "PAYMENT FAILED — update card" strip whenever the current
// subscription is in Paddle's dunning (past_due) state. Both strips
// render at the top of every authenticated screen.
export function AccountStatusStrip() {
  const env = getPaddleEnvironment();
  const [pastDue, setPastDue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", u.user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setPastDue(data?.status === "past_due");
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); };
  }, [env]);

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await openCustomerPortal({ data: { environment: env } });
      window.open(url, "_blank", "noopener");
    } finally { setBusy(false); }
  };

  return (
    <>
      {env === "sandbox" && (
        <div style={{
          width: "100%", background: "#ff9500", color: "#111",
          padding: "6px 12px", textAlign: "center",
          fontFamily: "monospace", fontSize: 10, letterSpacing: 2, fontWeight: 900,
          borderBottom: "1px solid #cc7700",
        }}>
          ◈ TEST MODE — payments in preview are simulated · use card 4242 4242 4242 4242
        </div>
      )}
      {pastDue && (
        <div style={{
          width: "100%", background: "#3a0f0f", color: "#ffb3b3",
          padding: "8px 12px", textAlign: "center",
          fontFamily: "monospace", fontSize: 11, letterSpacing: 2, fontWeight: 800,
          borderBottom: "1px solid #ff4d4d55",
        }}>
          ⚠ PAYMENT FAILED — we're retrying. <button
            onClick={openPortal} disabled={busy}
            style={{
              marginLeft: 8, background: "#ff4d4d", color: "#000", border: "none",
              padding: "3px 10px", fontFamily: "monospace", fontSize: 10, fontWeight: 900,
              letterSpacing: 2, cursor: busy ? "wait" : "pointer", borderRadius: 2,
            }}
          >{busy ? "…" : "UPDATE CARD"}</button>
        </div>
      )}
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cancelSubscription, switchSubscriptionPlan } from "@/utils/payments.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { PRICING, planLabelFor } from "@/lib/pricing";

export function ManageSubscriptionCard() {
  const G = "#00d4ff";
  const R = "#ff4d4d";
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted.current) setUid(session?.user?.id ?? null);
    });
    supabase.auth.getUser().then(({ data }) => { if (mounted.current) setUid(data.user?.id ?? null); });
    return () => listener.subscription.unsubscribe();
  }, []);

  const { sub, reload } = useSubscription(uid);

  const isYearly = !!sub?.price_id?.includes("yearly");
  const targetPriceKey = isYearly ? PRICING.monthly.priceKey : PRICING.yearly.priceKey;
  const targetLabel = isYearly ? "SWITCH TO MONTHLY (₹49/mo)" : "UPGRADE TO YEARLY (₹999/yr · SAVE 30%)";

  const endDate = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const endStr = endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  const isTrial = sub?.status === "trialing";
  const isCanceled = sub?.status === "canceled" || sub?.cancel_at_period_end;
  const isPastDue = sub?.status === "past_due";

  const doCancel = async () => {
    if (!confirm(`Cancel DWT PRO?\n\nYou keep full access until ${endStr ?? "the end of your current cycle"}. No further charges after that.`)) return;
    setBusy(true);
    try {
      const res = await cancelSubscription({ data: { immediate: false } });
      if ("error" in res) throw new Error(res.error);
      toast.success("Subscription canceled", { description: endStr ? `Access continues until ${endStr}.` : "Access continues until your cycle ends." });
      setTimeout(() => { if (mounted.current) reload(); }, 1200);
    } catch (e) {
      toast.error("Couldn't cancel", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const doSwitch = async () => {
    if (!confirm(isYearly
      ? "Switch to monthly billing? Your yearly plan runs to the end of its cycle, then monthly billing starts — you are never double-charged."
      : "Upgrade to yearly billing? Your monthly plan runs to the end of its cycle, then yearly billing starts — you are never double-charged."
    )) return;
    setSwitching(true);
    try {
      const res = await switchSubscriptionPlan({ data: { targetPriceKey } });
      if ("error" in res) throw new Error(res.error);
      toast.success(isYearly ? "Switching to monthly" : "Upgrading to yearly", { description: endStr ? `Takes effect on ${endStr}.` : "Takes effect at the end of your cycle." });
      setTimeout(() => { if (mounted.current) reload(); }, 1500);
    } catch (e) {
      toast.error("Plan switch failed", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      if (mounted.current) setSwitching(false);
    }
  };

  const planLabel = planLabelFor(sub?.price_id);

  const statusLine = isPastDue
    ? { color: R, text: "⚠ PAYMENT FAILED — Razorpay is retrying your mandate." }
    : isCanceled && endStr
      ? { color: "#ffb84d", text: `◌ CANCELED — access ends ${endStr}` }
      : isTrial && endStr
        ? { color: G, text: `◉ FREE TRIAL — first charge on ${endStr}` }
        : endStr
          ? { color: G, text: `◉ ACTIVE — renews on ${endStr}` }
          : { color: G, text: "◉ ACTIVE" };

  return (
    <div style={{
      marginTop: 14, padding: 16, background: "rgba(10,10,25,0.7)",
      border: `1px solid ${isPastDue ? R : G}44`, borderLeft: `3px solid ${isPastDue ? R : G}`, borderRadius: 4,
    }}>
      <div style={{ fontSize: 10, color: isPastDue ? R : G, letterSpacing: 3, marginBottom: 6, fontFamily: "monospace" }}>◈ SUBSCRIPTION</div>
      <div style={{ fontSize: 14, color: "#fff", letterSpacing: 2, fontWeight: 900, fontFamily: "monospace" }}>{planLabel}</div>
      <div style={{ marginTop: 6, fontSize: 11, color: statusLine.color, letterSpacing: 1.5, fontFamily: "monospace", lineHeight: 1.5 }}>
        {statusLine.text}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "#888", letterSpacing: 1, fontFamily: "monospace", lineHeight: 1.5 }}>
        Billed by Razorpay. Invoices and payment receipts are emailed to you after every charge.
      </div>

      {sub?.short_url && (
        <a
          href={sub.short_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", marginTop: 12, padding: "12px 16px", textAlign: "center",
            background: `linear-gradient(135deg, ${isPastDue ? R : G}33, transparent)`,
            border: `1px solid ${isPastDue ? R : G}`, color: isPastDue ? R : G,
            fontFamily: "monospace", fontSize: 11, fontWeight: 900, letterSpacing: 3,
            textDecoration: "none", borderRadius: 2, boxShadow: `0 0 12px ${isPastDue ? R : G}44`,
          }}
        >{isPastDue ? "⚠ UPDATE PAYMENT METHOD →" : "⚙ VIEW BILLING PAGE →"}</a>
      )}

      {sub && !isCanceled && (
        <button
          onClick={doSwitch}
          disabled={switching}
          style={{
            marginTop: 8, width: "100%", padding: "10px 16px",
            background: "transparent",
            border: `1px dashed ${G}77`, color: G,
            fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: 2.5,
            cursor: switching ? "wait" : "pointer", borderRadius: 2,
          }}
        >{switching ? "◌ SWITCHING…" : targetLabel}</button>
      )}

      {sub && !isCanceled && (
        <button
          onClick={doCancel}
          disabled={busy}
          style={{
            marginTop: 8, width: "100%", padding: "10px 16px",
            background: "transparent",
            border: `1px solid ${R}55`, color: R,
            fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: 2.5,
            cursor: busy ? "wait" : "pointer", borderRadius: 2,
          }}
        >{busy ? "◌ CANCELING…" : "CANCEL SUBSCRIPTION"}</button>
      )}
    </div>
  );
}

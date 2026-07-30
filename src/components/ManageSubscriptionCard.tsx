import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openCustomerPortal, switchSubscriptionPlan } from "@/utils/payments.functions";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { useSubscription } from "@/hooks/useSubscription";

const planLabelFor = (id?: string) =>
  !id ? "DWT PRO" : id.includes("yearly") ? "DWT PRO · YEARLY" : "DWT PRO · MONTHLY";

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

  const open = async () => {
    setBusy(true);
    // Open the tab synchronously (Safari/iOS blocks popups opened after await).
    const tab = window.open("", "_blank", "noopener");
    try {
      const res = await openCustomerPortal({ data: { environment: (getStripeEnvironmentSafe() ?? "sandbox") } });
      if ("error" in res) throw new Error(res.error);
      if (res.url) {
        if (tab) tab.location.href = res.url;
        else window.open(res.url, "_blank", "noopener");
      } else {
        tab?.close();
        toast.message("No active subscription to manage yet.");
      }

    } catch (e) {
      tab?.close();
      toast.error("Couldn't open portal", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const isYearly = !!sub?.price_id?.includes("yearly");
  const targetPriceId = isYearly ? (sub?.price_id ?? "").replace("yearly", "monthly") : (sub?.price_id ?? "").replace("monthly", "yearly");
  const targetLabel   = isYearly ? "SWITCH TO MONTHLY" : "UPGRADE TO YEARLY (SAVE ~47%)";

  const doSwitch = async () => {
    if (!confirm(isYearly
      ? "Switch to monthly billing? Stripe will credit any unused time from your yearly plan."
      : "Upgrade to yearly billing? Stripe will charge the prorated difference now."
    )) return;
    setSwitching(true);
    try {
      const res = await switchSubscriptionPlan({ data: { environment: (getStripeEnvironmentSafe() ?? "sandbox"), targetPriceId } });
      if ("error" in res) throw new Error(res.error);
      toast.success(isYearly ? "Switched to monthly" : "Upgraded to yearly");
      const t = setTimeout(() => { if (mounted.current) reload(); }, 1500);
      void t;
    } catch (e) {
      toast.error("Plan switch failed", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      if (mounted.current) setSwitching(false);
    }
  };

  const planLabel = planLabelFor(sub?.price_id);
  const endDate   = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const endStr    = endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  const isTrial   = sub?.status === "trialing";
  const isCanceled = sub?.status === "canceled" || sub?.cancel_at_period_end;
  const isPastDue  = sub?.status === "past_due";

  const statusLine = isPastDue
    ? { color: R, text: "⚠ PAYMENT FAILED — update your card to keep access." }
    : isCanceled && endStr
      ? { color: "#ffb84d", text: `◌ CANCELED — access ends ${endStr}` }
      : isTrial && endStr
        ? { color: G, text: `◉ FREE TRIAL — renews on ${endStr}` }
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
        View your plan, update your card, download invoices, or cancel anytime.
      </div>
      <button
        onClick={open}
        disabled={busy}
        style={{
          marginTop: 12, width: "100%", padding: "12px 16px",
          background: busy ? "#333" : `linear-gradient(135deg, ${isPastDue ? R : G}33, transparent)`,
          border: `1px solid ${isPastDue ? R : G}`, color: isPastDue ? R : G,
          fontFamily: "monospace", fontSize: 11, fontWeight: 900, letterSpacing: 3,
          cursor: busy ? "wait" : "pointer", borderRadius: 2,
          boxShadow: `0 0 12px ${isPastDue ? R : G}44`,
        }}
      >{busy ? "◌ OPENING…" : isPastDue ? "⚠ UPDATE PAYMENT METHOD →" : "⚙ MANAGE SUBSCRIPTION →"}</button>

      {sub && !isCanceled && !isPastDue && (
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
    </div>
  );
}

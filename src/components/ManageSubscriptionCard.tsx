import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { planLabelFor } from "@/lib/pricing";
import {
  isNativeBillingAvailable,
  playManageUrl,
  restorePlayPurchases,
  PLAY_PRODUCT_ID,
} from "@/lib/play-billing";
import { syncPlayEntitlement } from "@/utils/play-billing.functions";
import { usePlatform } from "@/hooks/usePlatform";

export function ManageSubscriptionCard() {
  const G = "#00d4ff";
  const R = "#ff4d4d";
  const [restoring, setRestoring] = useState(false);
  const [native, setNative] = useState(false);
  const { platform: billingPlatform } = usePlatform();
  const [uid, setUid] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    isNativeBillingAvailable().then(v => { if (mounted.current) setNative(v); }).catch(() => {});
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
  // Web checkout writes provider "razorpay"; store billing writes "play"/"revenuecat"/"appstore".
  // Inside a native shell we ALWAYS show store wording — Play/App Store policy forbids
  // surfacing any external payment provider or link in the app build.
  const isPlay =
    native ||
    (sub?.provider ?? "play").toLowerCase().includes("play") ||
    (sub?.provider ?? "").toLowerCase().includes("revenuecat");
  const isApple = billingPlatform === "ios";
  const storeName = isApple ? "the App Store" : "Google Play";
  const manageUrl = isApple
    ? "https://apps.apple.com/account/subscriptions"
    : isPlay
      ? playManageUrl(isYearly ? PLAY_PRODUCT_ID.yearly : PLAY_PRODUCT_ID.monthly)
      : (sub?.short_url ?? "/");

  const endDate = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const endStr = endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  const isTrial = sub?.status === "trialing";
  const isCanceled = sub?.status === "canceled" || sub?.cancel_at_period_end;
  const isPastDue = sub?.status === "past_due";

  const doRestore = async () => {
    if (!uid) return;
    setRestoring(true);
    try {
      if (native) await restorePlayPurchases(uid);
      const res = await syncPlayEntitlement({ data: {} } as never);
      if ("error" in res) throw new Error(res.error);
      if (res.active) toast.success("Purchase restored", { description: "AXEN PRO is unlocked." });
      else toast.message("No active purchase found", { description: "Sign in with the store account used for the purchase." });
      window.dispatchEvent(new Event("subscription:refresh"));
      setTimeout(() => { if (mounted.current) reload(); }, 1200);
    } catch (e) {
      toast.error("Restore failed", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      if (mounted.current) setRestoring(false);
    }
  };

  const planLabel = planLabelFor(sub?.price_id);

  const statusLine = isPastDue
    ? { color: R, text: isPlay ? "⚠ PAYMENT FAILED — Google Play is retrying your payment." : "⚠ PAYMENT FAILED — please renew to keep AXEN PRO." }
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
        {isPlay
          ? `Billed by ${storeName}. Upgrade, downgrade or cancel anytime in your ${storeName} subscriptions.`
          : "Billed on the web (₹99/month · ₹999/year). Your plan does not auto-renew — renew or change it here, or email support to cancel."}
      </div>

      <a
        href={manageUrl}
        target={isPlay || manageUrl.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        style={{
          display: "block", marginTop: 12, padding: "12px 16px", textAlign: "center",
          background: `linear-gradient(135deg, ${isPastDue ? R : G}33, transparent)`,
          border: `1px solid ${isPastDue ? R : G}`, color: isPastDue ? R : G,
          fontFamily: "monospace", fontSize: 11, fontWeight: 900, letterSpacing: 3,
          textDecoration: "none", borderRadius: 2, boxShadow: `0 0 12px ${isPastDue ? R : G}44`,
        }}
      >{isPlay
        ? (isPastDue ? `⚠ FIX PAYMENT IN ${storeName.toUpperCase()} →` : `⚙ MANAGE IN ${storeName.toUpperCase()} →`)
        : (isPastDue ? "⚠ RENEW YOUR PLAN →" : "⚙ VIEW PLANS & BILLING →")}</a>

      <button
        onClick={doRestore}
        disabled={restoring || !uid}
        style={{
          marginTop: 8, width: "100%", padding: "10px 16px",
          background: "transparent",
          border: `1px dashed ${G}77`, color: G,
          fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: 2.5,
          cursor: restoring ? "wait" : "pointer", borderRadius: 2,
        }}
      >{restoring ? "◌ RESTORING…" : "RESTORE PURCHASES"}</button>
    </div>
  );
}

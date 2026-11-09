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
import { ArrowRight, Info } from "lucide-react";
import s from "@/components/account/account.module.css";

export function ManageSubscriptionCard() {
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
  const isApple = billingPlatform === "ios";
  const storeName = isApple ? "the App Store" : "Google Play";
  const manageUrl = isApple
    ? "https://apps.apple.com/account/subscriptions"
    : playManageUrl(isYearly ? PLAY_PRODUCT_ID.yearly : PLAY_PRODUCT_ID.monthly);

  const endDate = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const endStr = endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
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

  // Same words as before; split into a chip + muted detail line.
  const statusLine: { tone: string; chip: string; detail: string | null } = isPastDue
    ? { tone: "red", chip: "⚠ PAYMENT FAILED", detail: `${storeName} is retrying your payment.` }
    : isCanceled && endStr
      ? { tone: "gold", chip: "◌ CANCELED", detail: `access ends ${endStr}` }
      : endStr
          ? { tone: sub?.status === "trialing" ? "violet" : "lime", chip: "◉ ACTIVE", detail: `renews on ${endStr}` }
          : { tone: sub ? (sub.status === "trialing" ? "violet" : "lime") : "slate", chip: "◉ ACTIVE", detail: null };

  return (
    <section className={s.card}>
      <div className={s.micro}><span className={s.diamond} aria-hidden />Subscription</div>
      <h2 className={s.plan}>{planLabel}</h2>
      <span className={`${s.chip} ${s[`tone-${statusLine.tone}`]}`}>{statusLine.chip}</span>
      {statusLine.detail && <p className={s.chipSub}>{statusLine.detail}</p>}
      <p className={s.billing}>
        <Info size={14} aria-hidden />
        <span>{`Billed by ${storeName} (₹99/month · ₹499/year). Upgrade, downgrade or cancel anytime in your ${storeName} subscriptions.`}</span>
      </p>

      <a href={manageUrl} target="_blank" rel="noopener noreferrer" className={`${s.primary} ${s.primaryBlock}`}>
        {isPastDue ? `Fix payment in ${storeName}` : `Manage in ${storeName}`} <ArrowRight size={18} aria-hidden />
      </a>

      <button
        className={`${s.secondary} ${s.secondaryBlock}`}
        onClick={doRestore}
        disabled={restoring || !uid}
        style={{ cursor: restoring ? "wait" : undefined }}
      >{restoring ? "Restoring…" : "Restore purchases"}</button>
    </section>
  );
}

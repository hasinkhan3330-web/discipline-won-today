import { useState } from "react";
import { toast } from "sonner";
import { purchaseCycle, restorePlayPurchases, isUserCancelled } from "@/lib/play-billing";
import { syncPlayEntitlement } from "@/utils/play-billing.functions";
import type { Cycle } from "@/lib/pricing";

const G = "#00d4ff";

/**
 * Official Google Play Billing checkout (via RevenueCat) + Restore Purchase.
 * Rendered only inside the Android app; the web build keeps Razorpay.
 */
export function PlayBillingButton({
  userId,
  cycle,
  label = "SUBSCRIBE WITH GOOGLE PLAY",
  onSuccess,
}: {
  userId: string;
  cycle: Cycle;
  label?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const unlock = async (via: "purchase" | "restore") => {
    const result = await syncPlayEntitlement({ data: {} } as never);
    if ("error" in result) throw new Error(result.error);
    if (!result.active) {
      toast.message(via === "restore" ? "No active purchase found" : "Purchase not active yet", {
        description: "Google Play may take a few seconds to confirm. Try Restore Purchase shortly.",
      });
      return;
    }
    toast.success(via === "restore" ? "Purchase restored" : "Payment successful", {
      description: "DWT PRO unlocked.",
    });
    window.dispatchEvent(new Event("subscription:refresh"));
    onSuccess?.();
  };

  const buy = async () => {
    setBusy(true);
    try {
      await purchaseCycle(userId, cycle);
      await unlock("purchase");
    } catch (e) {
      if (isUserCancelled(e)) {
        toast.message("Checkout closed", { description: "You were not charged." });
      } else {
        toast.error("Couldn't complete purchase", {
          description: e instanceof Error ? e.message : "Try again in a moment.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      await restorePlayPurchases(userId);
      await unlock("restore");
    } catch (e) {
      toast.error("Restore failed", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setRestoring(false);
    }
  };

  const disabled = busy || restoring;

  return (
    <>
      <button
        type="button"
        onClick={buy}
        disabled={disabled}
        style={{
          marginTop: 20, width: "100%", padding: "16px 20px",
          background: disabled ? "#333" : G, color: disabled ? "#888" : "#000",
          fontWeight: 900, letterSpacing: 3, fontSize: 13,
          border: "none", borderRadius: 2, fontFamily: "monospace",
          cursor: disabled ? "wait" : "pointer",
          boxShadow: disabled ? "none" : `0 0 28px ${G}77`,
        }}
      >
        {busy ? "◌ OPENING GOOGLE PLAY…" : label}
      </button>

      <button
        type="button"
        onClick={restore}
        disabled={disabled}
        style={{
          marginTop: 10, width: "100%", padding: "12px 20px",
          background: "transparent", color: disabled ? "#555" : G,
          fontWeight: 900, letterSpacing: 3, fontSize: 11,
          border: `1px solid ${disabled ? "#333" : G}55`, borderRadius: 2,
          fontFamily: "monospace", cursor: disabled ? "wait" : "pointer",
        }}
      >
        {restoring ? "◌ RESTORING…" : "RESTORE PURCHASE"}
      </button>
    </>
  );
}

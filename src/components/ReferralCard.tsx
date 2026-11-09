import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { Gift, Copy } from "lucide-react";
import s from "@/components/account/account.module.css";

const REASONS: Record<string, string> = {
  invalid_code: "That code doesn't exist.",
  self_referral: "You can't use your own code.",
  already_referred: "You've already redeemed a referral.",
  account_too_old: "Referral codes only work in your first 14 days.",
};

export function ReferralCard({ referredBy, onCoins }: {
  referredBy: string | null;
  onCoins?: (coins: number) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [redeemed, setRedeemed] = useState(!!referredBy);

  useEffect(() => { setRedeemed(!!referredBy); }, [referredBy]);

  useEffect(() => {
    let cancelled = false;
    (supabase.rpc as any)("get_or_create_referral_code").then(({ data }: { data: string | null }) => {
      if (!cancelled && data) setCode(data as string);
    });
    return () => { cancelled = true; };
  }, []);

  const share = async () => {
    if (!code) return;
    const link = `${window.location.origin}/?ref=${code}`;
    haptic("tap");
    try {
      const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "AXEN", text: `Join me on AXEN. Use my code ${code} and we both get 50 coins.`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.message(link);
    }
  };

  const redeem = async () => {
    const c = input.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("redeem_referral_code", { _code: c });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.applied) {
        haptic("success");
        setRedeemed(true);
        setInput("");
        if (typeof row.coins === "number") onCoins?.(row.coins);
        toast.success("+50 coins", { description: "Your friend received 50 coins too." });
      } else {
        toast.error(REASONS[row?.reason] || "That code could not be used.");
      }
    } catch (e: any) {
      toast.error("Could not redeem that code", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const redeemDisabled = busy || !input.trim();

  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <span className={s.well}><Gift size={18} strokeWidth={1.8} /></span>
        <h2 className={s.cardTitle}>Invite a friend</h2>
      </div>
      <p className={s.body}>
        Share your code. When a new user signs up with it, you both get 50 coins — once per account.
      </p>

      <div className={s.codeRow}>
        <div className={`${s.code} ${code ? "" : s.codeLoading}`}>{code ?? "Generating…"}</div>
        <button className={s.primary} onClick={share} disabled={!code} aria-label="Share invite">
          <Copy size={16} strokeWidth={2} /> Share
        </button>
      </div>

      {redeemed ? (
        <p className={s.note}>Referral bonus already claimed.</p>
      ) : (
        <div className={s.redeemRow}>
          <input
            className={s.input}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") redeem(); }}
            placeholder="Have a code?"
          />
          <button className={s.secondary} onClick={redeem} disabled={redeemDisabled}>
            {busy ? "…" : "Redeem"}
          </button>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { Gift, Copy } from "lucide-react";

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
  const CARD = cardStyle();
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

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <Gift size={16} strokeWidth={1.8} color={AX.accent} />
        Invite a friend
      </div>

      <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6 }}>
        Share your code. When a new user signs up with it, you both get 50 coins — once per account.
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 14px",
        background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: AX.text, letterSpacing: 1 }}>
          {code ?? "Generating…"}
        </div>
        <button onClick={share} disabled={!code} aria-label="Share invite" style={{
          minHeight: 44, padding: "0 14px", borderRadius: 12, cursor: code ? "pointer" : "not-allowed",
          background: code ? AX.accent : "#1D1D28", border: `1px solid ${code ? AX.accent : AX.border}`,
          color: code ? "#FFFFFF" : AX.muted, fontFamily: AX.font, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <Copy size={15} strokeWidth={1.8} /> Share
        </button>
      </div>

      {redeemed ? (
        <div style={{ fontSize: 13, color: AX.muted, marginTop: 12 }}>Referral bonus already claimed.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") redeem(); }}
            placeholder="Have a code?"
            style={{
              flex: 1, minHeight: 44, padding: "10px 14px", borderRadius: 12,
              background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
              fontFamily: AX.font, fontSize: 14, outline: "none", letterSpacing: 1,
            }}
          />
          <button onClick={redeem} disabled={busy || !input.trim()} style={{
            minHeight: 44, padding: "0 16px", borderRadius: 12,
            cursor: busy || !input.trim() ? "not-allowed" : "pointer",
            background: busy || !input.trim() ? "#181820" : AX.accent,
            border: `1px solid ${busy || !input.trim() ? AX.border : AX.accent}`,
            color: busy || !input.trim() ? AX.muted : "#FFFFFF",
            fontFamily: AX.font, fontSize: 14, fontWeight: 600,
          }}>
            {busy ? "…" : "Redeem"}
          </button>
        </div>
      )}
    </div>
  );
}

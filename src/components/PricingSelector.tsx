import { Check, Crown, Sparkles } from "lucide-react";
import { PRICING, type Cycle } from "@/lib/pricing";

export function PricingSelector({ cycle, onChange }: { cycle: Cycle; onChange: (cycle: Cycle) => void }) {
  return (
    <div className="ax-pricing" aria-label="Choose an AXEN Pro plan">
      <button
        type="button"
        className={`ax-pricing__plan ax-pricing__plan--yearly${cycle === "yearly" ? " is-selected" : ""}`}
        onClick={() => onChange("yearly")}
        aria-pressed={cycle === "yearly"}
      >
        <span className="ax-pricing__badge"><Crown size={13} /> BEST VALUE</span>
        <span className="ax-pricing__period">YEARLY ACCESS</span>
        <strong>{PRICING.yearly.display}</strong>
        <small>Save 58%</small>
        <i>{cycle === "yearly" && <Check size={14} />}</i>
      </button>
      <button
        type="button"
        className={`ax-pricing__plan ax-pricing__plan--monthly${cycle === "monthly" ? " is-selected" : ""}`}
        onClick={() => onChange("monthly")}
        aria-pressed={cycle === "monthly"}
      >
        <span className="ax-pricing__period">MONTHLY ACCESS</span>
        <strong>{PRICING.monthly.display}</strong>
        <i>{cycle === "monthly" && <Check size={14} />}</i>
      </button>
      <div className="ax-pricing__signal" aria-hidden="true"><Sparkles size={12} /> AXEN PRO</div>
    </div>
  );
}
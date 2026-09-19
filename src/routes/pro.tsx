import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformCheckout } from "@/components/PlatformCheckout";
import { PricingSelector } from "@/components/PricingSelector";
import { type Cycle } from "@/lib/pricing";
import axenLogo from "@/assets/axen-logo.png";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "AXEN PRO — Unlock Full Access" },
      { name: "description", content: "Unlock AXEN PRO for ₹499/year or ₹99/month." },
      { property: "og:title", content: "AXEN PRO — Unlock Full Access" },
      { property: "og:description", content: "Choose yearly or monthly AXEN PRO access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

function ProPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser()
      .then(({ data }) => { if (alive) setUserId(data.user?.id ?? null); })
      .catch(error => console.error("AXEN membership session check failed", error instanceof Error ? error.message : "Unknown session error"))
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  return (
    <main className="ax-pro-page">
      <div className="ax-pro-page__grid" aria-hidden="true" />
      <div className="ax-pro-page__shell">
        <header className="ax-pro-page__header">
          <div className="ax-pro-page__rings" aria-hidden="true"><i /><i /></div>
          <img src={axenLogo} alt="AXEN" />
          <span><Sparkles size={13} /> AXEN PRO</span>
          <h1>Unlock your full potential</h1>
        </header>

        <PricingSelector cycle={cycle} onChange={setCycle} />

        <section className="ax-pro-page__checkout">
          {ready && userId ? (
            <PlatformCheckout userId={userId} cycle={cycle} />
          ) : ready ? (
            <button type="button" className="ax-pro-page__signin" onClick={() => navigate({ to: "/" })}>
              UNLOCK AXEN PRO
            </button>
          ) : (
            <div className="ax-checkout-state">PREPARING…</div>
          )}
        </section>
      </div>
    </main>
  );
}
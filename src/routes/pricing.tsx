import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — DWT by NX AI" },
      { name: "description", content: "Simple pricing for DWT. 3-day free trial. Monthly and yearly plans available worldwide." },
      { property: "og:title", content: "DWT Pricing — 3-Day Free Trial" },
      { property: "og:description", content: "Start your discipline journey with a 3-day free trial. Cancel anytime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

const G = "#00d4ff", G2 = "#a855f7";

const PLANS = [
  { region: "Monthly", monthly: "₹49", yearly: "₹588", note: "Billed ₹49 every month after your free trial" },
  { region: "Yearly · Save 30%", monthly: "₹83", yearly: "₹999", note: "Billed ₹999 once a year after your free trial" },
];


function Pricing() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e8e8e8", fontFamily: "monospace", padding: "40px 20px", backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)` }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
          <Link to="/" style={{ color: G, textDecoration: "none", letterSpacing: 3, fontSize: 12 }}>← DWT</Link>
          <Link to="/auth" style={{ color: G, textDecoration: "none", letterSpacing: 3, fontSize: 12 }}>SIGN IN →</Link>
        </nav>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: 4, textAlign: "center", color: "#fff", textShadow: `0 0 30px ${G}` }}>PRICING</h1>
        <p style={{ textAlign: "center", color: G, letterSpacing: 3, fontSize: 11, marginTop: 8 }}>3-DAY FREE TRIAL · CANCEL ANYTIME</p>
        <p style={{ textAlign: "center", color: "#888", marginTop: 20, fontSize: 13, lineHeight: 1.7 }}>
          Every plan starts with a 3-day free trial. No charge until day 4. Cancel anytime from your account.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 40 }}>
          {PLANS.map(p => (
            <div key={p.region} style={{ background: "#0a0a0a", border: `1px solid ${G}33`, padding: 24, borderRadius: 4 }}>
              <div style={{ color: G, letterSpacing: 3, fontSize: 10 }}>{p.region.toUpperCase()}</div>
              <div style={{ marginTop: 16, fontSize: 28, color: "#fff", fontWeight: 900 }}>{p.monthly}<span style={{ fontSize: 12, color: "#888" }}>/mo</span></div>
              <div style={{ marginTop: 4, fontSize: 16, color: "#aaa" }}>{p.yearly}<span style={{ fontSize: 11, color: "#888" }}>/yr total</span></div>

              <div style={{ marginTop: 16, fontSize: 11, color: "#666", lineHeight: 1.6 }}>{p.note}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link to="/auth" style={{ display: "inline-block", padding: "16px 32px", background: G, color: "#000", fontWeight: 900, letterSpacing: 3, fontSize: 12, textDecoration: "none", borderRadius: 2, boxShadow: `0 0 30px ${G}88` }}>
            START FREE TRIAL
          </Link>
        </div>

        <div style={{ marginTop: 60, padding: 24, background: "#0a0a0a", border: `1px solid ${G}22`, borderRadius: 4 }}>
          <h2 style={{ color: G, letterSpacing: 3, fontSize: 12, marginTop: 0 }}>WHAT'S INCLUDED</h2>
          <ul style={{ color: "#aaa", fontSize: 13, lineHeight: 1.9, paddingLeft: 20 }}>
            <li>4AM Wake Protocol with math/physics verification</li>
            <li>Daily mission tracker with coin rewards</li>
            <li>WHO-standard 4-4-4-4 box breathing meditation</li>
            <li>Legend of the Day — rotating quotes from history's giants</li>
            <li>Victory milestones (Day 1 → Day 360)</li>
            <li>Cinematic UI with rotating Earth animation</li>
            <li>Cloud sync across devices</li>
          </ul>
        </div>

        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 11, color: "#555", letterSpacing: 2 }}>
          <div>DWT is a product of NX AI</div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 20 }}>
            <Link to="/privacy" style={{ color: "#888", textDecoration: "none" }}>PRIVACY</Link>
            <Link to="/terms" style={{ color: "#888", textDecoration: "none" }}>TERMS</Link>
            <Link to="/refund" style={{ color: "#888", textDecoration: "none" }}>REFUND</Link>
          </div>
          <div style={{ marginTop: 16, fontSize: 10, color: "#444" }}>
            Subscriptions are sold and billed securely through Google Play Billing
          </div>
        </footer>
      </div>
    </div>
  );
}

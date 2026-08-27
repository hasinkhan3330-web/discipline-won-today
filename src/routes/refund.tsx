import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AXEN Habit & Discipline" },
      { name: "description", content: "30-day money-back guarantee on AXEN subscriptions. How to request a refund." },
      { property: "og:title", content: "Refund Policy — AXEN Habit & Discipline" },
      { property: "og:description", content: "30-day money-back guarantee on all AXEN plans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Refund,
});

function Refund() {
  return <LegalShell title="REFUND POLICY">
    <p><b>Last updated:</b> July 25, 2026</p>
    <p>NEXT AI ("we", "us"), operator of the AXEN Habit & Discipline ("AXEN") application, offers a fair refund policy for all subscribers.</p>

    <h2>1. 30-Day Money-Back Guarantee</h2>
    <p>We offer a <b>30-day money-back guarantee</b>. If you are not satisfied with your AXEN subscription, you may request a full refund within 30 days of your order date.</p>

    <h2>2. Free Trial</h2>
    <p>Every AXEN plan starts with a <b>3-day free trial</b>. You will not be charged during the trial. Cancel any time before day 4 to avoid all charges.</p>

    <h2>3. How to Request a Refund</h2>
    <p>Refunds are processed through <b>Google Play</b>, back to the payment method used on your Google account, typically within 5–10 business days. To request a refund:</p>
    <ul>
      <li>Open the billing portal from your profile and review your invoices, or</li>
      <li>Email us at <b>support@next-ai.app</b> — we'll process your request directly.</li>
    </ul>
    <p>Refunds are returned to the original payment method within 5–10 business days.</p>

    <h2>4. Cancellation</h2>
    <p>You can cancel your subscription at any time from your account portal. Cancellation stops future renewals but does not automatically issue a refund for the current billing period — request a refund separately if within the 30-day window.</p>

    <h2>5. Questions</h2>
    <p>Contact <b>support@next-ai.app</b> for anything refund-related.</p>
  </LegalShell>;
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const G = "#00d4ff";
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
          <Link to="/" style={{ color: G, textDecoration: "none", letterSpacing: 3, fontSize: 12 }}>← AXEN</Link>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <Link to="/privacy" style={{ color: "#888", textDecoration: "none" }}>PRIVACY</Link>
            <Link to="/terms" style={{ color: "#888", textDecoration: "none" }}>TERMS</Link>
            <Link to="/refund" style={{ color: "#888", textDecoration: "none" }}>REFUND</Link>
          </div>
        </nav>
        <h1 style={{ color: "#fff", letterSpacing: 4, fontSize: 32, textShadow: `0 0 20px ${G}` }}>{title}</h1>
        <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.8 }} className="legal">{children}</div>
        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 11, color: "#555" }}>
          AXEN is a product of NEXT AI · support@next-ai.app
        </footer>
        <style>{`.legal h2{color:${G};letter-spacing:2px;font-size:14px;margin-top:32px}.legal ul{padding-left:20px}.legal li{margin:6px 0}.legal b{color:#fff}`}</style>
      </div>
    </div>
  );
}

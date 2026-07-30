import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — DWT by NX AI" },
      { name: "description", content: "Terms and conditions for using the DWT application, operated by NX AI." },
      { property: "og:title", content: "Terms & Conditions — DWT" },
      { property: "og:description", content: "The agreement between you and NX AI when using DWT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return <LegalShell title="TERMS & CONDITIONS">
    <p><b>Last updated:</b> July 25, 2026</p>
    <p>These Terms & Conditions ("Terms") govern your use of the Discipline Won Today ("DWT") application, operated by <b>NX AI</b> ("we", "us", "our"). By creating an account or continuing to use DWT, you agree to these Terms.</p>

    <h2>1. Who You Are Contracting With</h2>
    <p>You are entering into an agreement with NX AI, the operator of DWT. You confirm you are of legal age in your jurisdiction, or, if using DWT on behalf of an organization, that you have authority to bind it.</p>

    <h2>2. The Service</h2>
    <p>DWT is a discipline and habit-tracking application that provides wake-up verification, mission tracking, meditation guides, and motivational content. Features may change over time.</p>

    <h2>3. Acceptance & Account</h2>
    <p>By continuing to use DWT, you agree to these Terms. You must provide accurate information, keep your account credentials confidential, and are responsible for all activity under your account.</p>

    <h2>4. Acceptable Use</h2>
    <p>You must not: (a) use DWT for any unlawful purpose; (b) engage in fraud, spam, or abuse; (c) infringe intellectual property rights; (d) interfere with security — including malware, probing, scraping, or automated access; (e) attempt to reverse engineer, resell, or redistribute the service; (f) circumvent technical limits or payment mechanisms.</p>

    <h2>5. Intellectual Property</h2>
    <p>NX AI retains all rights, title, and interest in DWT, including software, documentation, branding, and the DWT design system. You are granted a limited, non-exclusive, non-transferable right to use DWT within your subscribed plan.</p>

    <h2>6. Payment, Subscription & Merchant of Record</h2>
    <p>Payments are processed securely by <b>Stripe</b>. Card details are entered directly into Stripe's hosted checkout and are never stored on our servers. Payment, billing, tax, cancellation, and refund mechanics are governed by these Terms together with <a href="https://stripe.com/legal/consumer" style={{color:"#00d4ff"}}>Stripe's consumer terms</a>. Billing questions can be sent to us directly.</p>
    <p>Subscriptions renew automatically at the end of each billing period until cancelled. You may cancel at any time via the account portal. A 3-day free trial is offered on all plans — you will not be charged until day 4.</p>

    <h2>7. User Content</h2>
    <p>You retain ownership of content you upload (e.g. profile photos). You grant NX AI a limited licence to host and process it solely to provide the service.</p>

    <h2>8. Service Availability</h2>
    <p>We do not guarantee uninterrupted or error-free performance. We may perform maintenance, add or remove features, and update the service.</p>

    <h2>9. Suspension & Termination</h2>
    <p>We may suspend or terminate your access for: material breach of these Terms, non-payment, security or fraud risk, or repeated or serious policy violations. On termination, we will provide a reasonable window to export your data before deletion.</p>

    <h2>10. Warranties & Liability</h2>
    <p>To the fullest extent permitted by law, DWT is provided "as is" without warranties of merchantability or fitness for a particular purpose. Our aggregate liability is capped at the fees you paid in the 12 months preceding the claim. We exclude liability for indirect, consequential, or special damages, except where such exclusion is prohibited by law (including for fraud, death, or personal injury).</p>

    <h2>11. Indemnity</h2>
    <p>You indemnify NX AI against claims arising from your content, unlawful use of DWT, or breach of these Terms.</p>

    <h2>12. Governing Law & Disputes</h2>
    <p>These Terms are governed by the laws of the jurisdiction in which NX AI is established. Disputes will be resolved in the competent courts of that jurisdiction.</p>

    <h2>13. Assignment</h2>
    <p>You may not assign these Terms without our consent. We may assign them in connection with a merger, acquisition, or sale of assets.</p>

    <h2>14. Force Majeure</h2>
    <p>Neither party is liable for failure to perform due to events beyond reasonable control.</p>

    <h2>15. Contact</h2>
    <p>Questions? Email <b>support@nx-ai.app</b>.</p>
  </LegalShell>;
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const G = "#00d4ff";
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
          <Link to="/" style={{ color: G, textDecoration: "none", letterSpacing: 3, fontSize: 12 }}>← DWT</Link>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <Link to="/privacy" style={{ color: "#888", textDecoration: "none" }}>PRIVACY</Link>
            <Link to="/terms" style={{ color: "#888", textDecoration: "none" }}>TERMS</Link>
            <Link to="/refund" style={{ color: "#888", textDecoration: "none" }}>REFUND</Link>
          </div>
        </nav>
        <h1 style={{ color: "#fff", letterSpacing: 4, fontSize: 32, textShadow: `0 0 20px ${G}` }}>{title}</h1>
        <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.8 }} className="legal">{children}</div>
        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 11, color: "#555" }}>
          DWT is a product of NX AI · support@nx-ai.app
        </footer>
        <style>{`.legal h2{color:${G};letter-spacing:2px;font-size:14px;margin-top:32px}.legal ul{padding-left:20px}.legal li{margin:6px 0}.legal b{color:#fff}`}</style>
      </div>
    </div>
  );
}

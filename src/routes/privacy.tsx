import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — AXEN by NEXT AI" },
      { name: "description", content: "How NEXT AI collects, uses, and protects your personal data in the AXEN application." },
      { property: "og:title", content: "Privacy Notice — AXEN" },
      { property: "og:description", content: "NEXT AI's privacy practices for the AXEN app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return <LegalShell title="PRIVACY NOTICE">
    <p><b>Last updated:</b> July 25, 2026</p>
    <p>This Privacy Notice explains how <b>NEXT AI</b> ("we", "us", "our"), the operator of the AXEN - Habit & Discipline ("AXEN") application, collects, uses, and shares your personal data. NEXT AI is the data controller for the personal data described here.</p>

    <h2>1. Who We Are</h2>
    <p>NEXT AI is a technology company. AXEN is one of our products — a discipline and habit-tracking application. If you have questions about this notice, contact us at <b>support@next-ai.app</b>.</p>

    <h2>2. Personal Data We Collect</h2>
    <ul>
      <li><b>Account data:</b> email address, password (hashed), display name, profile photo.</li>
      <li><b>Usage data:</b> task completions, coin balances, meditation sessions, wake-up verification results, streaks.</li>
      <li><b>Device & log data:</b> IP address, browser type, session timestamps, error logs.</li>
      <li><b>Payment data:</b> handled entirely by Google Play Billing (and RevenueCat, our subscription infrastructure provider). We receive only a subscription ID, entitlement status, and billing period — never card or payment credentials.</li>
    </ul>

    <h2>3. How We Use Your Data</h2>
    <ul>
      <li>To create and manage your account (contract performance).</li>
      <li>To provide the AXEN service — tracking, verification, leaderboards, meditation (contract performance).</li>
      <li>To prevent fraud and abuse (legitimate interest).</li>
      <li>To respond to support requests (legitimate interest).</li>
      <li>To comply with legal obligations (legal obligation).</li>
    </ul>

    <h2>4. Data Sharing — Recipients</h2>
    <ul>
      <li><b>Google LLC (Google Play Billing)</b> — payment processing, subscriptions and invoicing.</li>
      <li><b>RevenueCat, Inc.</b> — subscription status and entitlement verification.</li>
      <li><b>Cloud hosting & database subprocessors</b> — for storing account data securely.</li>
      <li><b>Professional advisers</b> (legal, accounting) where necessary.</li>
      <li><b>Authorities</b> where required by law.</li>
    </ul>
    <p>We do not sell your personal data.</p>

    <h2>5. International Transfers</h2>
    <p>Payment data is processed and stored by Google in line with its own safeguards. Google acts as an independent controller for payment data.</p>

    <h2>6. Data Retention</h2>
    <p>We retain account data for as long as your account is active. If you delete your account, we delete or anonymise your personal data within 90 days, except where retention is required by law (e.g. tax and payment records retained for up to 10 years).</p>

    <h2>7. Your Rights</h2>
    <p>Depending on your location, you may have the right to access, rectify, erase, restrict, port, or object to processing of your personal data, and to withdraw consent. You may also lodge a complaint with your local supervisory authority. To exercise these rights, contact <b>support@next-ai.app</b>. We respond within one month.</p>

    <h2>8. Security</h2>
    <p>We use industry-standard technical and organisational measures — encryption in transit (TLS), encryption at rest, access controls, and least-privilege service credentials — to protect your data.</p>

    <h2>9. Cookies</h2>
    <p>AXEN uses only essential cookies and local storage required to keep you signed in and remember preferences. We do not use marketing or third-party analytics cookies.</p>

    <h2>10. Changes to This Notice</h2>
    <p>We will update this notice when our practices change. Material changes will be notified in the app or by email.</p>
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

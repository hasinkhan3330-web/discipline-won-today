import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://axonhabit.app/privacy-policy";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AXEN Habit & Discipline" },
      { name: "description", content: "How AXEN by NEXT AI handles account, alarm, notification, coin and payment data, and how to delete your account." },
      { property: "og:title", content: "Privacy Policy — AXEN Habit & Discipline" },
      { property: "og:description", content: "AXEN's privacy policy: data we collect, how we use it, and account deletion." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  const G = "#00d4ff";
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
          <Link to="/" style={{ color: G, textDecoration: "none", letterSpacing: 3, fontSize: 12 }}>← AXEN</Link>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <Link to="/privacy-policy" style={{ color: "#888", textDecoration: "none" }}>PRIVACY</Link>
            <Link to="/terms" style={{ color: "#888", textDecoration: "none" }}>TERMS</Link>
            <Link to="/refund" style={{ color: "#888", textDecoration: "none" }}>REFUND</Link>
          </div>
        </nav>
        <h1 style={{ color: "#fff", letterSpacing: 4, fontSize: 32, textShadow: `0 0 20px ${G}` }}>PRIVACY POLICY</h1>
        <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.8 }} className="legal">
          <p><b>Last updated:</b> November 20, 2026</p>
          <p>This Privacy Policy explains how <b>NEXT AI</b> ("we", "us"), the operator of AXEN Habit &amp; Discipline ("AXEN"), collects, uses and protects your information when you use the AXEN website and Android app.</p>

          <h2>1. Who We Are</h2>
          <p>AXEN is a discipline and habit-tracking app made by NEXT AI. Contact: <b>support@next-ai.app</b>.</p>

          <h2>2. Account &amp; Login Data</h2>
          <ul>
            <li>Email address, display name and optional profile photo.</li>
            <li><b>Google Sign-In:</b> if you sign in with Google, we receive only your name, email address and profile photo. We do not access your Gmail, contacts, Drive or other Google data.</li>
            <li>Passwords are never stored in plain text; they are hashed by our sign-in provider.</li>
            <li>Basic technical data such as sign-in times and error logs, used to keep your account secure.</li>
          </ul>

          <h2>3. Alarms &amp; Wake Protocol</h2>
          <ul>
            <li>We store your alarm times, repeat days, timezone, chosen challenge type and whether each alarm was solved and when.</li>
            <li>On Android, alarms are scheduled on your phone so they can ring even when the app is closed.</li>
            <li>If you stop an alarm while offline, the phone saves a small record (alarm, scheduled time, solve time) and sends it to our servers when you are back online so rewards can be checked. No answer keys are stored on your device.</li>
          </ul>

          <h2>4. Notifications</h2>
          <ul>
            <li>With your permission, AXEN shows alarm notifications and reminders (for example pact and habit reminders, partner nudges).</li>
            <li>On Android we ask for notification and exact-alarm permissions so alarms ring on time. You can turn these off at any time in your phone's settings; alarms may then not ring.</li>
          </ul>

          <h2>5. Coins, Streaks &amp; Rewards</h2>
          <ul>
            <li>We store task completions, coins, XP, streaks, ranks and reward history.</li>
            <li>Coins and rewards are calculated on our servers, including daily coin rules, to keep them fair.</li>
            <li>Leaderboards show only your display name and rank — never your email address.</li>
          </ul>

          <h2>6. Payments</h2>
          <ul>
            <li>Subscriptions are processed by <b>Google Play Billing</b> (Google LLC). Subscription status is managed with <b>RevenueCat, Inc.</b></li>
            <li>We receive only a subscription ID, plan and status. We never see or store your card or payment details.</li>
          </ul>

          <h2>7. Other Features</h2>
          <ul>
            <li><b>Accountability partners:</b> information you choose to share (such as daily progress, check-ins, nudges and proof photos) is visible only to your active partner. Proof photos are stored privately.</li>
            <li><b>AI Coach:</b> your chat messages, and microphone audio when you use voice coaching, are processed by Google's Gemini AI service to generate replies.</li>
            <li><b>Camera:</b> photos you take for habit proof may be checked by an image recognition service (Roboflow). Camera and microphone are used only when you start those features.</li>
            <li>Settings like your theme are saved in your browser or phone.</li>
          </ul>

          <h2>8. How We Use Your Data</h2>
          <p>To provide AXEN (accounts, alarms, tracking, coins, partners, coaching), to prevent fraud and abuse, to answer support requests and to meet legal obligations. <b>We do not sell your personal data</b> and we do not use advertising trackers.</p>

          <h2>9. Storage &amp; Security</h2>
          <p>Data is stored with our cloud hosting provider. All connections use encryption (HTTPS/TLS), and access rules ensure each user can only reach their own data, or data a partner has chosen to share.</p>

          <h2>10. Your Rights</h2>
          <p>Depending on where you live, you may access, correct, export or delete your data, or object to its use. Email <b>support@next-ai.app</b>; we reply within one month.</p>

          <h2>11. Account Deletion</h2>
          <ul>
            <li>To delete your account, email <b>support@next-ai.app</b> from the email address on your account with the subject <b>"Delete my account"</b>.</li>
            <li>We delete or anonymise your account, alarms, coins, partner data, photos and coach history within 90 days.</li>
            <li>Payment records may be kept longer where the law requires. Cancel any active subscription in Google Play first.</li>
          </ul>

          <h2>12. Children</h2>
          <p>AXEN is not intended for children under 13, and we do not knowingly collect their data.</p>

          <h2>13. Changes &amp; Contact</h2>
          <p>We will update this policy when our practices change and show the new date above. Questions: <b>support@next-ai.app</b>.</p>
        </div>
        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 11, color: "#555" }}>
          AXEN is a product of NEXT AI · support@next-ai.app
        </footer>
        <style>{`.legal h2{color:${G};letter-spacing:2px;font-size:14px;margin-top:32px}.legal ul{padding-left:20px}.legal li{margin:6px 0}.legal b{color:#fff}`}</style>
      </div>
    </div>
  );
}

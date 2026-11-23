import { Link } from "@tanstack/react-router";
import { AlarmClock, Bot, Check, Crown, Flame, Focus, HeartHandshake, Leaf, Sparkles, Target, Trophy, Users } from "lucide-react";
import { PRICING } from "@/lib/pricing";
import axenLogo from "@/assets/axen-logo.png";
import home from "@/assets/landing/home.webp.asset.json";
import wake from "@/assets/landing/wake.webp.asset.json";
import journey from "@/assets/landing/journey.webp.asset.json";
import ranks from "@/assets/landing/ranks.webp.asset.json";
import focus from "@/assets/landing/focus.webp.asset.json";
import missions from "@/assets/landing/missions.webp.asset.json";
import "./landing-mobile.css";

type Props = { onSignIn: () => void; onGetStarted: () => void };

const SHOTS = [
  { src: home.url, title: "Command Center", copy: "Your whole day in one screen" },
  { src: wake.url, title: "4AM Protocol", copy: "Wake alarms you must solve" },
  { src: missions.url, title: "Wake missions", copy: "Math, Science, Shake, Typing, Tiles" },
  { src: focus.url, title: "Deep Focus", copy: "Lock distracting apps" },
  { src: journey.url, title: "My Journey", copy: "See every day you showed up" },
  { src: ranks.url, title: "Ranks", copy: "Climb from Beginner to Unshakable" },
];

const FEATURES = [
  { Icon: Bot, tone: "axl-t-cyan", title: "AI Coach + My Plan", copy: "Talk or type. Your coach builds a plan for tomorrow or the week, with the exact hours you ask for." },
  { Icon: AlarmClock, tone: "axl-t-lime", title: "4AM Wake Protocol", copy: "Alarms that keep ringing until you solve a mission. No snooze, no excuses." },
  { Icon: Focus, tone: "axl-t-violet", title: "Deep Focus", copy: "Block YouTube, Instagram and games for 49 minutes to 3 hours of real work." },
  { Icon: HeartHandshake, tone: "axl-t-lime", title: "Accountability partner", copy: "Pair with a friend, make daily pacts, send nudges and cheers, share proof." },
  { Icon: Trophy, tone: "axl-t-gold", title: "Coins, ranks and seals", copy: "Earn coins for verified wins, unlock milestone seals and climb the leaderboard." },
  { Icon: Leaf, tone: "axl-t-cyan", title: "Zen", copy: "Guided calm sessions to reset your mind between missions." },
];

const BENEFITS = [
  { title: "Wake up on time", copy: "Your alarm only stops when your brain is awake." },
  { title: "Finish what matters", copy: "Five daily habits, one clear plan, zero clutter." },
  { title: "Stay accountable", copy: "A real partner sees if you show up." },
  { title: "See your progress", copy: "Streaks, stats and ranks that prove the work." },
];

export function LandingPage({ onSignIn, onGetStarted }: Props) {
  return (
    <div className="axl-page">
      <header className="axl-nav">
        <div className={`axl-wrap axl-nav-in`}>
          <div className="axl-brand"><img src={axenLogo} alt="" width={34} height={34} />AXEN</div>
          <div className="axl-nav-btns">
            <button type="button" className={`axl-btn axl-ghost`} onClick={onSignIn}>Sign In</button>
            <button type="button" className={`axl-btn axl-primary`} onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </header>

      <main>
        <section className={`axl-wrap axl-hero`}>
          <div>
            <span className="axl-eyebrow"><Flame size={14} aria-hidden /> Habit &amp; discipline system</span>
            <h1 className="axl-h1">Build discipline that <em>doesn't snooze.</em></h1>
            <p className="axl-lead">AXEN wakes you at 4AM, plans your day with an AI coach, locks distractions and pairs you with a partner who keeps you honest.</p>
            <div className="axl-cta-row">
              <button type="button" className={`axl-btn axl-primary`} onClick={onGetStarted}>Get Started free</button>
              <button type="button" className={`axl-btn axl-ghost`} onClick={onSignIn}>I already have an account</button>
            </div>
            <div className="axl-trust"><span><b>3-day</b> free PRO trial</span><span>Android app + web</span><span>Sign in with Google</span></div>
          </div>
          <div className="axl-phone-stage">
            <div className="axl-phone"><img src={home.url} alt="AXEN Command Center screen" width={440} height={904} fetchPriority="high" /></div>
            <div className={`axl-phone axl-phone-small`}><img src={wake.url} alt="AXEN 4AM Protocol screen" width={440} height={904} /></div>
          </div>
        </section>

        <section className={`axl-wrap axl-section`} aria-labelledby="shots">
          <div className="axl-kicker">Inside the app</div>
          <h2 id="shots" className="axl-h2">Every screen built for the hard days.</h2>
          <div className="axl-shots">
            {SHOTS.map(x => (
              <figure key={x.title} className="axl-shot">
                <img src={x.src} alt={`AXEN ${x.title} screen`} loading="lazy" decoding="async" width={440} height={904} />
                <figcaption>{x.title}<small>{x.copy}</small></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={`axl-wrap axl-section`} aria-labelledby="features">
          <div className="axl-kicker">Features</div>
          <h2 id="features" className="axl-h2">One system. Every habit.</h2>
          <div className={`axl-grid axl-grid3`}>
            {FEATURES.map(({ Icon, tone, title, copy }) => (
              <article key={title} className="axl-card">
                <span className={`axl-icon ${tone}`}><Icon size={20} aria-hidden /></span>
                <h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`axl-wrap axl-section`} aria-labelledby="benefits">
          <div className="axl-kicker">Why AXEN</div>
          <h2 id="benefits" className="axl-h2">Less motivation. More proof.</h2>
          <div className="axl-benefits">
            {BENEFITS.map(b => <div key={b.title} className="axl-benefit"><strong>{b.title}</strong><span>{b.copy}</span></div>)}
          </div>
        </section>

        <section className={`axl-wrap axl-section`} aria-labelledby="pricing">
          <div className="axl-kicker">Pricing</div>
          <h2 id="pricing" className="axl-h2">Start free. Go PRO when you're ready.</h2>
          <p className="axl-sub">PRO is billed through Google Play inside the app. Cancel anytime.</p>
          <div className="axl-prices">
            <div className="axl-price">
              <h3>Free trial</h3>
              <div className="axl-amount">₹0 <small>· 3 days of PRO</small></div>
              <ul>{["Full PRO access for 3 days", "Coach, Wake Protocol and Rank", "No card needed to start"].map(t => <li key={t}><Check size={16} aria-hidden />{t}</li>)}</ul>
              <button type="button" className={`axl-btn axl-ghost`} onClick={onGetStarted}>Start free trial</button>
            </div>
            <div className="axl-price">
              <h3>PRO Monthly</h3>
              <div className="axl-amount">{PRICING.monthly.display.replace("/month", "")} <small>/ month</small></div>
              <ul>{["Deep Focus app lock", "Verified Rank and leaderboard", "AI Coach voice and plans"].map(t => <li key={t}><Check size={16} aria-hidden />{t}</li>)}</ul>
              <button type="button" className={`axl-btn axl-ghost`} onClick={onGetStarted}>Get Started</button>
            </div>
            <div className={`axl-price axl-price-best`}>
              <span className="axl-badge">{PRICING.yearly.sub}{PRICING.yearly.save ? ` · ${PRICING.yearly.save}` : ""}</span>
              <h3>PRO Yearly</h3>
              <div className="axl-amount">{PRICING.yearly.display.replace("/year", "")} <small>/ year</small></div>
              <ul>{["Everything in Monthly", "Best price for a full year", "Keep your streak going"].map(t => <li key={t}><Check size={16} aria-hidden />{t}</li>)}</ul>
              <button type="button" className={`axl-btn axl-primary`} onClick={onGetStarted}><Crown size={16} aria-hidden /> Get PRO</button>
            </div>
          </div>
        </section>

        <section className="axl-wrap">
          <div className="axl-final">
            <div className="axl-kicker"><Sparkles size={12} aria-hidden /> Your 4AM starts now</div>
            <h2 className="axl-h2">Become the person who shows up.</h2>
            <div className="axl-cta-row">
              <button type="button" className={`axl-btn axl-primary`} onClick={onGetStarted}><Target size={16} aria-hidden /> Get Started</button>
              <button type="button" className={`axl-btn axl-ghost`} onClick={onSignIn}><Users size={16} aria-hidden /> Sign In</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="axl-footer">
        <div className={`axl-wrap axl-foot-in`}>
          <span>© {2026} Aevonix · <a href="mailto:team@aevonix.pro" style={{ color: "inherit" }}>team@aevonix.pro</a></span>
          <nav className="axl-foot-links" aria-label="Legal">
            <Link to="/privacy-policy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/refund">Refund</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

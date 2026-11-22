# AXEN public landing page at /

## What I found (route audit)
- `/` today is the sign-in screen (intro animation, Google/email sign-in, pre-signup quiz, pricing selector, checkout). Signed-in users are sent to `/dashboard`; pending invites to `/join/$code`.
- Google sign-in returns to the site root, and the Android app also opens at `/`. So the sign-in screen must keep living at `/`, or sign-in and the Android app would break.
- Other public pages stay as they are: `/pro`, `/privacy`, `/privacy-policy`, `/terms`, `/refund`, `/join/$code`, `/auth/*`, `/reset-password`. All app screens under `/_authenticated` are untouched.
- Prices already in the app: PRO ₹99/month or ₹499/year, with a free trial.

## Approach (nothing existing is moved or rewritten)
- Website visitors who are not signed in see the new landing page first at `/`.
- "Sign In" and "Get Started" open the exact current sign-in screen on the same page, unchanged (same intro, quiz, Google/email, pricing).
- Signed-in visitors still go straight to the dashboard, as now.
- The Android app skips the landing page and opens the sign-in screen exactly as today.
- Returning from Google sign-in goes straight to the dashboard (unchanged).

## Landing page sections
1. Top bar: AXEN logo, Sign In, Get Started.
2. Hero: bold headline about discipline, short subline, Get Started + Sign In, a phone mockup of the app.
3. App screenshots: Home Command Center, 4AM Wake Protocol, Coach, Rank, Accountability (real app screens captured from the preview, in Dark look).
4. Key features: AI Coach + My Plan, 4AM Wake alarms with puzzles, Deep Focus, Accountability partner and pacts, coins, ranks and seals, Zen.
5. Benefits: wake on time, finish daily tasks, stay accountable, see progress.
6. Pricing: Free trial, PRO ₹99/month, ₹499/year (shown as text; buttons lead to Get Started, payment stays inside the existing flow).
7. Final call-to-action and footer with Privacy, Terms, Refund, contact team@aevonix.pro, © Aevonix.

Look: black background, lime/cyan/violet glow and gold coin accents matching the current app; works at 360–414px phones up to desktop.

## SEO and speed
- New page title/description for the home page, canonical `https://axonhabit.app/`, share tags, SoftwareApplication structured data with the real prices.
- `robots.txt` and `sitemap.xml` listing only public pages.
- Screenshots compressed (WebP), lazy-loaded below the hero; no new libraries.

## Technical details
- New files: `src/components/landing/LandingPage.tsx`, `src/components/landing/landing.module.css`, screenshot assets in `src/assets/landing/`, `public/robots.txt`, a sitemap route.
- `src/routes/index.tsx`: only add a `showLanding` state (true on web when signed out and no pending invite/OAuth return; false on Capacitor native). When true, render `<LandingPage onSignIn onGetStarted />`; those set it false to render the existing component tree untouched. Update `head()` meta only.
- No changes to auth, database, other routes, app screens, theme or pricing logic.
- Checks: typecheck/build, Playwright at 360/390/414/1280 for landing → Sign In shows the existing screen, signed-in redirect unchanged; no account creation.

## Not verifiable here
- Real Android app launch and real Google sign-in return; requires Publish to go live.

## Safety rules (approved additions)
- No landing flash: while the session or a Google sign-in return is still loading, show the existing intro/sign-in screen, never the landing page. The landing page appears only after the session check finishes and confirms no one is signed in.
- Bypass: a Google sign-in return (callback/code/token in the URL or a sign-in in progress) and every Android app launch skip the landing page entirely.
- Sign In/Get Started render the existing sign-in component exactly as it is today; its code is not edited.
- Pricing on the landing page is checked against the existing pricing/checkout source (`src/lib/pricing`, PricingSelector, PlatformCheckout) before it is written, and reads from the same source where possible.
- No changes to sign-in, database, existing routes or app features.
- Before completion: typecheck/build, Playwright at 360/390/414/1280, regression checks (signed-out landing → Sign In shows unchanged screen; Google return URL skips landing; Android-style launch skips landing; signed-in visit still goes to dashboard; /pro, /privacy, /terms, /join still load). No account creation.

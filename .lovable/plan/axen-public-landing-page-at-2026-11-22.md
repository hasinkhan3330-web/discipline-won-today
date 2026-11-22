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

## Added scoped UI change 1: sign-in screen restyle (looks only)
- Match your app screenshots: deep black, neon-lime highlights, cyan/violet glow, gold coin accents, dark premium card with subtle border, existing AXEN logo (no new logo).
- Google button uses Google's official dark style (genuine four-colour G, "Continue with Google").
- Unchanged: Google sign-in and its return, email/password, Create Account, Forgot Password, pre-signup quiz, pricing selector, checkout, validation, loading and error messages, the intro animation timing.

## Added scoped UI change 2: AXEN SETUP card (safety check done)
- Finding: the card is the whole `Onboarding` component (`src/components/Onboarding.tsx`, 137 lines). It is not just a progress bar: it holds the 12 setup questions (name, age range/privacy, goal, wake time, etc.), Back/Continue, saving each answer, and the "Build my blueprint" finish that marks setup complete.
- It is used in one place only: Home (`dashboard.tsx` line 730), shown while setup is unfinished. There is no other way to reach it.
- So simply deleting it would leave setup unfinished forever with no way back. I will not do that.
- Approach (your choice): remove the card from the top of Home and add a "Setup" row in the You menu (same card style as the other You rows). Tapping it opens the exact same 12-question setup, starting at the saved step with saved answers; finishing uses the same completion step. Shown whether or not setup is finished, so answers can be reviewed later. `Onboarding.tsx`, the save/finish logic, database and privacy/age fields stay unchanged.
- Name, avatar, profile, rank badge, coins, PRO trial banner, missions and navigation unchanged.

## File-by-file
| File | Change |
| --- | --- |
| `src/components/landing/LandingPage.tsx` (new) | Landing page sections |
| `src/components/landing/landing.module.css` (new) | Landing-only styles |
| `src/assets/landing/*` (new) | Compressed app screenshots |
| `src/components/auth/signin.module.css` (new) | Sign-in-only styles |
| `src/components/auth/GoogleButton.tsx` (new) | Official dark Google button look; calls the existing sign-in handler passed in |
| `src/routes/index.tsx` | Landing gate (with safety rules), new SEO tags, swap sign-in styles/markup classes and Google button; no logic changes |
| `src/routes/_authenticated/dashboard.tsx` | Stop auto-showing `<Onboarding …/>` on Home; render it when a new `setupOpen` flag is true (same props, same finish handler, which also closes it); pass `onOpenSetup` to the You tab |
| `src/tabs/ProfileTab.tsx` | Add one "Setup" row in the You feature list that calls `onOpenSetup` (optional prop) |
| `public/robots.txt`, sitemap route (new) | Public pages only |

Nothing else changes. Checks: typecheck/build, Playwright 360/390/414/1280 for landing, sign-in looks and form behaviour (no account creation), Google-return and Android bypass, signed-in redirect, other public pages; Home checked for the missing setup card only where reachable without creating accounts.

## Scope guarantee
Only the items listed above change. Every other AXEN screen, icon, colour, copy, feature, sign-in logic, database rule and route stays exactly as it is.

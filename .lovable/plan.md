# Landing mobile layout — on hold for Preview fix

## Status
- No code changes. The project stays exactly as it is now.
- The Preview problem has been reported to the Lovable team with the evidence below.
- Production is NOT verified on a phone yet.

## Evidence (captured 23 Nov 2026, page "/", phone width 390px)
- Page loads (status 200), no console errors, no failed requests.
- The landing wrapper carries the landing-only style class, so the page code ran.
- Preview loads only one stylesheet (the main app stylesheet). The landing mobile stylesheet is never loaded.
- Result: the hero buttons stay side by side ("row") instead of stacking on phones.
- Same problem affects other screens' own stylesheets in Preview (for example the wake alarm screen).
- Clearing the cache and restarting Preview did not help.
- The finished production files DO contain the phone rules (a width ≤ 640px block for the landing page).

## What happens next (only after Preview is fixed or you approve)
1. Re-open Preview at "/" at 360, 390, 412, 430px and confirm buttons stack and there is no sideways scroll.
2. Compare desktop at 1280px with the previous screenshot.
3. Only after you approve publishing: publish, then test the live site on a phone width.

## Technical details
- Files already in place (unchanged now): src/components/landing/landing-mobile.module.css, one import in src/components/landing/LandingPage.tsx.
- No shared styles, other screens, database or sign-in touched.

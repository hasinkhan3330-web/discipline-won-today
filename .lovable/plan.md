# Fix AXEN onboarding, startup, and pricing

## Scope
Only change the three requested areas. Preserve AXEN’s existing authentication, navigation, dashboard, features, branding, subscription products, entitlement checks, and purchase handling.

## 1. Permanently fix onboarding name saving
- Replace the existing update-only onboarding function with an authenticated, idempotent upsert keyed to the signed-in account ID.
- Trim and validate the preferred name, preserve existing profile values when later answers are not present, and safely default privacy flags until age is answered.
- Keep profile ownership tied to the authenticated account; never accept a user ID from the phone.
- Retain current row-level privacy and grants, while making a missing profile row recoverable.
- Update the existing onboarding screen only for behavior: prevent duplicate taps, use a bounded timeout, retry transient failures, retain the typed name, log a safe diagnostic, and advance only after confirmed persistence.
- Verify new-profile, existing-profile, refresh, sign-out/sign-in, retry, and ownership behavior.

## 2. Make startup cinematic and bounded to five seconds
- Rework the existing AXEN splash rather than adding another page.
- Run session/profile initialization immediately in parallel with the animation.
- Use a single hard deadline so the web splash fades away no later than five seconds, even when auth/profile requests fail or stall.
- Route authenticated users to the existing dashboard, where the existing profile state determines onboarding versus home; unauthenticated users continue through the existing first-launch/sign-in flow.
- Keep the AXEN logo and add efficient logo reveal, energy rings, progress motion, fade-out, reduced-motion handling, and cleanup-safe timers.
- Bound the authenticated dashboard’s own startup loader so it cannot freeze indefinitely.

## 3. Redesign only pricing presentation
- Restyle the existing membership and PRO surfaces with AXEN black/navy, cyan-violet glass panels, restrained animated borders, responsive typography, and reduced-motion support.
- Show exactly two selectable offers: dominant **₹499/year — Best Value, Save 58%** and secondary **₹99/month**.
- Use one primary **Unlock AXEN Pro** purchase button while retaining the current selected-cycle purchase call, entitlement refresh, restore behavior, and error handling.
- Remove visible store/provider names, billing-channel explanations, and unnecessary instructional paragraphs from pricing surfaces and purchase status messages.

## Verification
- Apply and inspect the database migration, including grants and row-level policies.
- Run focused code checks and production build.
- Exercise the complete flow in the running app at mobile and desktop sizes: splash deadline, auth routing, onboarding name save/retry/refresh, pricing selection/CTA, and unchanged navigation.
- Confirm the published Lovable badge setting remains hidden.

# Accountability behind the existing Pro gate

## What I checked
- Rank, Zen and Coach are wrapped in `ProtectedFeatureGate` in the dashboard. It reads the shared server entitlement (`get_entitlement`: 3-day trial or active Pro) and shows the existing `PaywallGate` lock when access is missing.
- Accountability has no page address of its own. It opens only as a view inside You → Accountability (`ProfileTab`, `view === "accountability"`).
- The partner invite page `/join/$code` sits outside the dashboard, so it has no entitlement provider today. Its Join button calls `acceptInvite`.

## Changes (UI only, reuse existing gate)
1. **You → Accountability** (`src/tabs/ProfileTab.tsx`): wrap `<AccountabilitySection>` in the same `ProtectedFeatureGate` (feature name "Accountability"). Add one optional `onUpgrade` prop. Its "Continue basic" option goes back to the You menu.
2. **Dashboard** (`src/routes/_authenticated/dashboard.tsx`): pass `onUpgrade={() => setShowPaywall(true)}` to `ProfileTab`. This opens the existing ₹99 paywall.
3. **Invite link** (`src/routes/join.$code.tsx`): for signed-in users, wrap the page in the existing `EntitlementProvider` and `ProtectedFeatureGate`. While the check loads, show the existing loader. Without trial or Pro, show the same lock instead of the Join button, and its upgrade goes to the existing `/pro` page. Signed-out visitors keep seeing exactly what they see today, sign-in only, with no code check.

Same trial timer, subscription check and lock screen as Rank/Zen/Coach. Nothing else changes: no database, no other screens, no copy, no timer.

## Verification
- Typecheck and build log.
- Signed-out `/join/x` still shows sign-in.
- The lock and access states can't be tested live without a real expired account, because test accounts are not allowed. I'll report this as NOT TESTED.

## Known limit (same as Rank/Zen/Coach today)
- The lock is on screens only. Accountability's server actions (check-in, nudge, accept invite) don't check Pro themselves. A modified app could still call them. Server-side enforcement would be a separate change.
- Contract card's small partner line and incoming nudge alerts stay as they are.

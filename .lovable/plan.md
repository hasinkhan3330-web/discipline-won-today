# Final QA + Hardening — Rank Verified Badges

Scope: only the Rank Verified Badge / Verified Rank List feature. No redesign, no new features, no changes to coins, XP, rewards, ranking order, database, navigation or other tabs.

## 1. Functional flow tests (browser, signed-in)
Rank → right arrow → full-screen list → vertical scroll → X → Rank, repeated 5 times. Also test the phone Back button closing the list. Check for: duplicate overlays, stuck screens, controls that stop responding, and state after reopening. Confirm no sideways scrolling or dragging.

## 2. Badge boundary tests (fixtures only)
Run the tier function against 349, 350, 1,049, 1,050, 4,999, 5,000, 14,499, 14,500, 18,249, 18,250 and 18,251. Expected: none / pink / pink / green / green / green (no change) / green / red / red / diamond / diamond. Test the visual badge at each tier using mock rows only. No real balances changed and no test users created.

## 3. Security / data
- Confirm badges come from the signed-in lookup plus the real profile coin balance, and never from a value the user sends.
- Confirm users cannot write badges or coins directly (read-only policy/trigger check).
- Sign out, sign in, and reload to confirm badges restore correctly.

## 4. UI checks
Circular photos, alignment, small badge size, white check at every tier, white background only inside the list, no old podium/cards/animations left, no clipping or overflow, a clear empty/short-list state, and a long list (mock 100 rows) that stays usable.

## 5. Mobile sizes
Check 360x740, 390x844, 414x896, a landscape phone, and a tablet. Look at safe-area spacing, X position and tap size (at least 44px), scrolling, and horizontal overflow.

## 6. Regression
Smoke-check Home, Goals, Stats, Profile, Coach and Rank ordering/DP. Confirm the diff only touches the Rank files (RankCoinBadge, Leaderboard, Rank-only styles).

## 7. Code quality review
Look for console/runtime errors, leftover listeners (Back button, body scroll lock, Escape key), extra re-renders, repeated or duplicate badge requests, and race conditions when coins update. Fix only inside the Rank files.

## 8. Final verification
Run the typecheck, the build, any existing tests, and repeat the browser checks after each fix. The report will list: tests run, passed, issues found, fixes made, reruns, and what could not be tested (no physical Android/iOS device).

## Technical notes
- Likely fixes if missing: Android back / popstate closes the modal; body scroll lock with cleanup on unmount; `touch-action: pan-y` and `overscroll-behavior` on the list; `env(safe-area-inset-top)` for X; one shared badge query per mount.
- Nothing will be published.

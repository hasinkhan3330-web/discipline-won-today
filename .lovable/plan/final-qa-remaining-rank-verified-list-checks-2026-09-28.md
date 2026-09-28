# Final QA — Remaining Rank Verified List Checks

Testing only. No redesign and no rule, coin, XP, reward, ranking, navigation or database changes. Code changes only if a real bug is found inside the Verified Rank List.

## Tests to run
1. **Sign out / sign in / reload:** in the preview, open Rank and note the badge state, sign out, sign back in with the same session, reload, and compare. The badge state must match before and after.
2. **Mock 100-row list:** in the test browser only, intercept the leaderboard, badge and profile responses and return 100 fake members with mixed coin tiers. Nothing is written to the database. Scroll the list top to bottom, then check that nothing overflows sideways and that sideways swipes don't move it.
3. **Every badge on screen:** use the same mock data to show pink, green, red and dark-blue diamond badges. Take close-up screenshots of each and read the check colour to confirm it's white.
4. **Safe areas and layout:** at 360x740, 390x844, 844x390 and 768x1024, check the X position and tap size, the header and top/bottom spacing, circular photos, and no text clipping or overlap.
5. **Checks:** run the typecheck, a production build, and any existing tests.

## Reporting
The report will list: tests run, failures, fixes (if any), reruns, and what needs a physical Android/iPhone (hardware Back button, real notch/home-bar spacing, touch scroll feel).

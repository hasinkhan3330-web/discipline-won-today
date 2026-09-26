# Phase 8 — Validation and Release Plan (nothing released)

## Facts found so far (read-only)
- **Phases 1–7:** each has a PASSED verdict in the roadmap.
- **Branch / commit:** Lovable-managed edit branch `edt-1cc5c2a4…`, latest `34c028f`. Every save creates its own commit automatically.
- **Backend:** there is only one: `nfmgiczlthezfwgsazfc`. The staging and production refs are the same project. All Phase 1–7 database changes are already on it. They are additive, and users see nothing new until the app is published.
- **Migrations:** 72 in order. The verified-discipline ones are 20260924071606, 073015, 074047, 074123, 175423, 175517, 20260925024449, 065950, 075449. Old migration files were never edited.
- **Feature flags:** there is no existing flag system for the 8 modules. Following your rule, none will be created. They are reported as missing.
- **Native builds:** Android is set up with Capacitor (com.hasin.axen, internet and billing permissions only). There is no iOS project. The Android shell points to https://axonhabit.app.
- **Secrets:** no private keys in the branch or the built app. `.env` holds only public keys.
- **Bundle size:** 15,085,768 bytes before → 15,131,810 after, so about **+45 KB** (+0.3%).
- **Test run status:** the first automatic test run stopped at setup. Test contracts were created as drafts instead of scheduled. This was a test-script mistake, not an app failure. Everything was undone.

## Gates I cannot meet here (to state honestly)
1. **Separate staging environment:** doesn't exist. Every test runs on the one live backend inside a transaction that is fully undone afterwards.
2. **Isolated per-phase commits, clean tree, squash-free PR:** git is managed by Lovable. I can list the commits and give a diff against the pre-Phase-1 commit (`bc60747`), but I can't open a pull request.
3. **Schema-drift tool, backup/restore drill, staged rollout:** not available to me. They go on the release checklist as manual steps.
4. **Physical Android/iOS tests:** none. Browser preview only. Each device item will be marked "untestable here".
5. **Private storage / signed URLs:** proof photos are checked and then thrown away, never stored, so there are no storage paths to guess. This is reported as not applicable (I'll confirm no proof storage area exists).
6. **Feature flags:** reported as missing. Adding them would be new code, which needs your separate approval.

## What I will run after approval (all undone afterwards, no publish)
- **Flows:** success path (contract → session → proof → server verify → 20 XP + 5 coins once → leaderboard); missed → 9-minute recovery → 8 XP + 2 coins, then full reward blocked; accountability invite → accept → partner sees title/status only → fixed nudges → sharing off → revoke → no access.
- **Abuse (anonymous, User A, User B, partner, outsider):** client-set XP/coins, self-verify, forced statuses, cross-user reads/writes/sessions, duplicate/replay/concurrent rewards, duplicate recovery and recovery of recovery, self/expired/used/guessed invites, custom and over-limit nudges, invite rate limits, mute, expired sign-in, secret scan of the built app.
- **Grants review:** every protected server function, checking who can run it and its safe search path.
- **Screens (browser, phone size):** every card state that can be set up, plus offline, and all 6 tabs, Deep Focus and Zen opening.
- **Performance:** Home load time, database calls on Home, bundle size, timer save frequency (saved once per start, not every second), and live-update subscriptions cleaned up when you leave a screen.
- **Stop on the first real failure** and show it to you before any fix.

## Final report will contain
Change inventory, diff summary vs `bc60747`, migration list, security report, test matrix for Phases 1–8, performance before/after, accessibility notes, honest limitations, the device test list, rollback steps per phase, the release checklist, and a verdict. Given gates 1, 4 and 6, the expected verdict is **BLOCKED — FIX THESE ITEMS** (feature flags, physical device tests, Android URL review) unless you accept them as known exceptions.

Nothing is merged, published or promoted without **APPROVE PRODUCTION PROMOTION**.
